"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = normalizePhoneNumber;
exports.normalizeEmail = normalizeEmail;
exports.getServiceByPhone = getServiceByPhone;
exports.getServiceByEmail = getServiceByEmail;
exports.getServiceWithNames = getServiceWithNames;
exports.createService = createService;
exports.updateService = updateService;
exports.addServiceName = addServiceName;
exports.updateCanonicalName = updateCanonicalName;
exports.getServiceById = getServiceById;
exports.searchServicesByName = searchServicesByName;
const db_1 = __importDefault(require("../db"));
/**
 * Normalize phone number by removing spaces, dashes, and standardizing format
 */
function normalizePhoneNumber(phone) {
    if (!phone)
        return '';
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Handle Indian phone numbers (10 digits, optionally with +91)
    if (digits.length === 10) {
        return digits;
    }
    else if (digits.length === 12 && digits.startsWith('91')) {
        return digits.substring(2);
    }
    else if (digits.length === 13 && digits.startsWith('+91')) {
        return digits.substring(3);
    }
    // Return as-is if doesn't match expected patterns
    return digits;
}
/**
 * Normalize email by converting to lowercase and trimming
 */
function normalizeEmail(email) {
    if (!email)
        return '';
    return email.toLowerCase().trim();
}
/**
 * Get service by phone number
 */
async function getServiceByPhone(phoneNumber) {
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone)
        return null;
    const result = await db_1.default.query('SELECT * FROM services WHERE phone_number = $1', [normalizedPhone]);
    return result.rows[0] || null;
}
/**
 * Get service by email
 */
async function getServiceByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail)
        return null;
    const result = await db_1.default.query('SELECT * FROM services WHERE email = $1', [normalizedEmail]);
    return result.rows[0] || null;
}
/**
 * Get service by ID with all name variations
 */
async function getServiceWithNames(serviceId) {
    const serviceResult = await db_1.default.query('SELECT * FROM services WHERE id = $1', [serviceId]);
    if (serviceResult.rows.length === 0) {
        return null;
    }
    const namesResult = await db_1.default.query('SELECT * FROM service_names WHERE service_id = $1 ORDER BY frequency DESC, confidence DESC', [serviceId]);
    return {
        ...serviceResult.rows[0],
        names: namesResult.rows
    };
}
/**
 * Create a new service
 */
async function createService(serviceData) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Normalize phone and email
        const normalizedPhone = serviceData.phone_number ? normalizePhoneNumber(serviceData.phone_number) : null;
        const normalizedEmail = serviceData.email ? normalizeEmail(serviceData.email) : null;
        // Validate that at least one identifier is provided
        if (!normalizedPhone && !normalizedEmail) {
            throw new Error('Service must have either phone number or email');
        }
        // Insert service
        const serviceResult = await client.query(`INSERT INTO services (
        phone_number, email, name, service_type, business_name, 
        address, website, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`, [
            normalizedPhone,
            normalizedEmail,
            serviceData.name,
            serviceData.service_type || null,
            serviceData.business_name || null,
            serviceData.address || null,
            serviceData.website || null,
            JSON.stringify(serviceData.metadata || {})
        ]);
        const serviceId = serviceResult.rows[0].id;
        // Insert initial name entry
        await client.query(`INSERT INTO service_names (service_id, name, frequency, confidence)
       VALUES ($1, $2, 1, 1.0)`, [serviceId, serviceData.name]);
        console.log('[db/services] created service row:', { id: serviceId, service_type: serviceData.service_type || null, name: serviceData.name });
        await client.query('COMMIT');
        return serviceId;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Update service information
 */
async function updateService(serviceId, updates) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Build dynamic update query
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        if (updates.phone_number !== undefined) {
            updateFields.push(`phone_number = $${paramCount++}`);
            values.push(updates.phone_number ? normalizePhoneNumber(updates.phone_number) : null);
        }
        if (updates.email !== undefined) {
            updateFields.push(`email = $${paramCount++}`);
            values.push(updates.email ? normalizeEmail(updates.email) : null);
        }
        if (updates.name !== undefined) {
            updateFields.push(`name = $${paramCount++}`);
            values.push(updates.name);
        }
        if (updates.service_type !== undefined) {
            updateFields.push(`service_type = $${paramCount++}`);
            values.push(updates.service_type);
        }
        if (updates.business_name !== undefined) {
            updateFields.push(`business_name = $${paramCount++}`);
            values.push(updates.business_name);
        }
        if (updates.address !== undefined) {
            updateFields.push(`address = $${paramCount++}`);
            values.push(updates.address);
        }
        if (updates.website !== undefined) {
            updateFields.push(`website = $${paramCount++}`);
            values.push(updates.website);
        }
        if (updates.metadata !== undefined) {
            updateFields.push(`metadata = $${paramCount++}`);
            values.push(JSON.stringify(updates.metadata));
        }
        // Always update the updated_at timestamp
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        if (updateFields.length === 0) {
            return false; // No updates to make
        }
        values.push(serviceId);
        const updateQuery = `
      UPDATE services 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id
    `;
        const result = await client.query(updateQuery, values);
        await client.query('COMMIT');
        return result.rows.length > 0;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Add or update a name variation for a service
 */
async function addServiceName(serviceId, name, confidence = 1.0) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Check if this name already exists for this service
        const existingResult = await client.query('SELECT id, frequency FROM service_names WHERE service_id = $1 AND name = $2', [serviceId, name]);
        if (existingResult.rows.length > 0) {
            // Update frequency and confidence
            await client.query(`UPDATE service_names 
         SET frequency = frequency + 1, 
             confidence = GREATEST(confidence, $1),
             last_seen = CURRENT_TIMESTAMP
         WHERE id = $2`, [confidence, existingResult.rows[0].id]);
        }
        else {
            // Insert new name variation
            await client.query(`INSERT INTO service_names (service_id, name, frequency, confidence)
         VALUES ($1, $2, 1, $3)`, [serviceId, name, confidence]);
        }
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Update the canonical name for a service based on name variations
 */
async function updateCanonicalName(serviceId) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Get all name variations with their scores
        const namesResult = await client.query(`SELECT name, frequency, confidence, 
              (frequency * confidence) as score
       FROM service_names 
       WHERE service_id = $1 
       ORDER BY score DESC, frequency DESC, confidence DESC
       LIMIT 1`, [serviceId]);
        if (namesResult.rows.length > 0) {
            const canonicalName = namesResult.rows[0].name;
            // Update the service's canonical name
            await client.query('UPDATE services SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [canonicalName, serviceId]);
        }
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Get service by ID
 */
async function getServiceById(serviceId) {
    const result = await db_1.default.query('SELECT * FROM services WHERE id = $1', [serviceId]);
    return result.rows[0] || null;
}
/**
 * Search services by name (for admin/debugging purposes)
 */
async function searchServicesByName(name, limit = 10) {
    const result = await db_1.default.query(`SELECT DISTINCT s.* FROM services s
     LEFT JOIN service_names sn ON s.id = sn.service_id
     WHERE s.name ILIKE $1 OR sn.name ILIKE $1
     ORDER BY s.updated_at DESC
     LIMIT $2`, [`%${name}%`, limit]);
    return result.rows;
}
