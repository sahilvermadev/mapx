import pool from '../db';

export interface ServiceData {
  name: string;
  phone_number?: string;
  email?: string;
  service_type?: string;
  // business_name removed from write-path; legacy data remains in DB but is no longer updated
  address?: string;
  website?: string;
  // normalized location fields for city filtering
  city_name?: string;
  city_slug?: string;
  admin1_name?: string;
  country_code?: string;
  metadata?: Record<string, any>;
}

export interface Service {
  id: number;
  phone_number?: string;
  email?: string;
  name: string;
  service_type?: string;
  business_name?: string;
  address?: string;
  website?: string;
  city_name?: string;
  city_slug?: string;
  admin1_name?: string;
  country_code?: string;
  metadata: Record<string, any>;
  deleted_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceName {
  id: number;
  service_id: number;
  name: string;
  frequency: number;
  confidence: number;
  last_seen: Date;
}

export interface ServiceWithNames extends Service {
  names: ServiceName[];
}

/**
 * Normalize phone number by removing spaces, dashes, and standardizing format
 * Handles Indian phone numbers with various formats:
 * - 10 digits: "9876543210"
 * - With country code: "+919876543210" or "919876543210"
 * - With leading zero: "09876543210" -> "9876543210"
 * - Landline with STD: "08012345678" -> "8012345678" (removes leading 0)
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  if (!digits) return '';
  
  // Handle Indian phone numbers (10 digits, optionally with +91)
  if (digits.length === 10) {
    return digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // Remove leading zero: "09876543210" -> "9876543210"
    return digits.substring(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Country code without +: "919876543210" -> "9876543210"
    return digits.substring(2);
  } else if (digits.length === 13 && digits.startsWith('91')) {
    // Country code with + (already stripped): "919876543210" -> "9876543210"
    return digits.substring(2);
  }
  
  // For international numbers or other formats, return as-is
  // This allows storage of non-Indian numbers
  return digits;
}

/**
 * Normalize email by converting to lowercase and trimming
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}

/**
 * Get service by phone number
 * Uses SELECT FOR UPDATE SKIP LOCKED to prevent race conditions when used in transactions
 */
export async function getServiceByPhone(phoneNumber: string, forUpdate: boolean = false): Promise<Service | null> {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) return null;
  
  const query = forUpdate 
    ? 'SELECT * FROM services WHERE phone_number = $1 AND deleted_at IS NULL FOR UPDATE SKIP LOCKED'
    : 'SELECT * FROM services WHERE phone_number = $1 AND deleted_at IS NULL';
  
  const result = await pool.query(query, [normalizedPhone]);
  
  return result.rows[0] || null;
}

/**
 * Get service by email
 * Uses SELECT FOR UPDATE SKIP LOCKED to prevent race conditions when used in transactions
 */
export async function getServiceByEmail(email: string, forUpdate: boolean = false): Promise<Service | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  
  const query = forUpdate
    ? 'SELECT * FROM services WHERE email = $1 AND deleted_at IS NULL FOR UPDATE SKIP LOCKED'
    : 'SELECT * FROM services WHERE email = $1 AND deleted_at IS NULL';
  
  const result = await pool.query(query, [normalizedEmail]);
  
  return result.rows[0] || null;
}

/**
 * Get service by ID with all name variations
 */
export async function getServiceWithNames(serviceId: number): Promise<ServiceWithNames | null> {
  const serviceResult = await pool.query(
    'SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL',
    [serviceId]
  );
  
  if (serviceResult.rows.length === 0) {
    return null;
  }
  
  const namesResult = await pool.query(
    'SELECT * FROM service_names WHERE service_id = $1 ORDER BY frequency DESC, confidence DESC',
    [serviceId]
  );
  
  return {
    ...serviceResult.rows[0],
    names: namesResult.rows
  };
}

/**
 * Create a new service
 */
export async function createService(serviceData: ServiceData): Promise<number> {
  const client = await pool.connect();
  
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
    const serviceResult = await client.query(
      `INSERT INTO services (
        phone_number, email, name, service_type,
        address, website, city_name, city_slug, admin1_name, country_code, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        normalizedPhone,
        normalizedEmail,
        serviceData.name,
        serviceData.service_type || null,
        serviceData.address || null,
        serviceData.website || null,
        serviceData.city_name || null,
        serviceData.city_slug || null,
        serviceData.admin1_name || null,
        serviceData.country_code || null,
        JSON.stringify(serviceData.metadata || {})
      ]
    );
    
    const serviceId = serviceResult.rows[0].id;
    
    // Insert initial name entry
    await client.query(
      `INSERT INTO service_names (service_id, name, frequency, confidence)
       VALUES ($1, $2, 1, 1.0)`,
      [serviceId, serviceData.name]
    );
    console.log('[db/services] created service row:', { id: serviceId, service_type: serviceData.service_type || null, name: serviceData.name });
    
    await client.query('COMMIT');
    return serviceId;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update service information
 */
export async function updateService(serviceId: number, updates: Partial<ServiceData>): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Build dynamic update query
    const updateFields: string[] = [];
    const values: any[] = [];
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
    if (updates.address !== undefined) {
      updateFields.push(`address = $${paramCount++}`);
      values.push(updates.address);
    }
    if (updates.website !== undefined) {
      updateFields.push(`website = $${paramCount++}`);
      values.push(updates.website);
    }
    if (updates.city_name !== undefined) {
      updateFields.push(`city_name = $${paramCount++}`);
      values.push(updates.city_name);
    }
    if (updates.city_slug !== undefined) {
      updateFields.push(`city_slug = $${paramCount++}`);
      values.push(updates.city_slug);
    }
    if (updates.admin1_name !== undefined) {
      updateFields.push(`admin1_name = $${paramCount++}`);
      values.push(updates.admin1_name);
    }
    if (updates.country_code !== undefined) {
      updateFields.push(`country_code = $${paramCount++}`);
      values.push(updates.country_code);
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
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Add or update a name variation for a service
 */
export async function addServiceName(
  serviceId: number, 
  name: string, 
  confidence: number = 1.0
): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if this name already exists for this service
    const existingResult = await client.query(
      'SELECT id, frequency FROM service_names WHERE service_id = $1 AND name = $2',
      [serviceId, name]
    );
    
    if (existingResult.rows.length > 0) {
      // Update frequency and confidence
      await client.query(
        `UPDATE service_names 
         SET frequency = frequency + 1, 
             confidence = GREATEST(confidence, $1),
             last_seen = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [confidence, existingResult.rows[0].id]
      );
    } else {
      // Insert new name variation
      await client.query(
        `INSERT INTO service_names (service_id, name, frequency, confidence)
         VALUES ($1, $2, 1, $3)`,
        [serviceId, name, confidence]
      );
    }
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update the canonical name for a service based on name variations
 */
export async function updateCanonicalName(serviceId: number): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get all name variations with their scores
    const namesResult = await client.query(
      `SELECT name, frequency, confidence, 
              (frequency * confidence) as score
       FROM service_names 
       WHERE service_id = $1 
       ORDER BY score DESC, frequency DESC, confidence DESC
       LIMIT 1`,
      [serviceId]
    );
    
    if (namesResult.rows.length > 0) {
      const canonicalName = namesResult.rows[0].name;
      
      // Update the service's canonical name
      await client.query(
        'UPDATE services SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [canonicalName, serviceId]
      );
    }
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get service by ID
 */
export async function getServiceById(serviceId: number): Promise<Service | null> {
  const result = await pool.query(
    'SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL',
    [serviceId]
  );
  
  return result.rows[0] || null;
}

/**
 * Search services by name (for admin/debugging purposes)
 */
export async function searchServicesByName(name: string, limit: number = 10): Promise<Service[]> {
  const result = await pool.query(
    `SELECT DISTINCT s.* FROM services s
     LEFT JOIN service_names sn ON s.id = sn.service_id
     WHERE (s.name ILIKE $1 OR sn.name ILIKE $1)
       AND s.deleted_at IS NULL
     ORDER BY s.updated_at DESC
     LIMIT $2`,
    [`%${name}%`, limit]
  );
  
  return result.rows;
}

/**
 * Update cached aggregates for a service
 */
export async function updateServiceAggregates(
  serviceId: number,
  aggregates: {
    rating_average?: number | null;
    rating_count?: number;
    primary_category_id?: number | null;
    common_tags?: string[];
  }
): Promise<boolean> {
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (aggregates.rating_average !== undefined) {
    updateFields.push(`rating_average = $${paramCount++}`);
    values.push(aggregates.rating_average);
  }
  if (aggregates.rating_count !== undefined) {
    updateFields.push(`rating_count = $${paramCount++}`);
    values.push(aggregates.rating_count);
  }
  if (aggregates.primary_category_id !== undefined) {
    updateFields.push(`primary_category_id = $${paramCount++}`);
    values.push(aggregates.primary_category_id);
  }
  if (aggregates.common_tags !== undefined) {
    updateFields.push(`common_tags = $${paramCount++}`);
    values.push(aggregates.common_tags);
  }

  if (updateFields.length === 0) {
    return false;
  }

  // Always update updated_at
  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(serviceId);

  const updateQuery = `
    UPDATE services 
    SET ${updateFields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING id
  `;

  const result = await pool.query(updateQuery, values);
  return result.rows.length > 0;
}

/**
 * Recalculate and update all aggregates for a service
 */
export async function recalculateServiceAggregates(serviceId: number): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Calculate rating average and count (only from non-deleted recommendations)
    const ratingResult = await client.query(
      `SELECT 
         AVG(srd.rating)::NUMERIC(3, 2) as rating_average,
         COUNT(*) as rating_count
       FROM service_recommendation_details srd
       INNER JOIN recommendations r ON srd.recommendation_id = r.id
       WHERE srd.service_id = $1 
         AND srd.rating IS NOT NULL
         AND r.deleted_at IS NULL`,
      [serviceId]
    );

    const rating_average = ratingResult.rows[0]?.rating_average
      ? parseFloat(ratingResult.rows[0].rating_average)
      : null;
    const rating_count = parseInt(ratingResult.rows[0]?.rating_count || '0', 10);

    // Get primary category (highest confidence) - only from non-deleted services
    const categoryResult = await client.query(
      `SELECT stc.category_id
       FROM service_to_category stc
       INNER JOIN services s ON stc.service_id = s.id
       WHERE stc.service_id = $1
         AND s.deleted_at IS NULL
       ORDER BY stc.confidence DESC, stc.added_by_user DESC
       LIMIT 1`,
      [serviceId]
    );
    const primary_category_id = categoryResult.rows[0]?.category_id || null;

    // Get most common tags (top 10) - only from non-deleted recommendations
    const tagsResult = await client.query(
      `SELECT st.tag, SUM(st.frequency) as total_frequency
       FROM service_tags st
       INNER JOIN recommendations r ON st.recommendation_id = r.id
       WHERE st.service_id = $1
         AND (r.deleted_at IS NULL OR st.recommendation_id IS NULL)
       GROUP BY st.tag
       ORDER BY total_frequency DESC
       LIMIT 10`,
      [serviceId]
    );
    const common_tags = tagsResult.rows.map(row => row.tag);

    // Update service with calculated aggregates
    await updateServiceAggregates(serviceId, {
      rating_average,
      rating_count,
      primary_category_id,
      common_tags,
    });

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
