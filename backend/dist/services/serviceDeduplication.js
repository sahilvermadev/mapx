"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertService = upsertService;
exports.getServiceInfo = getServiceInfo;
exports.findPotentialDuplicates = findPotentialDuplicates;
exports.mergeServices = mergeServices;
const services_1 = require("../db/services");
const nameSimilarity_1 = require("../utils/nameSimilarity");
/**
 * Main function to upsert a service with automatic deduplication
 * This is the core logic that handles all deduplication scenarios
 */
async function upsertService(serviceData) {
    console.log('[serviceDedup] upsertService input:', {
        name: serviceData?.name,
        phone_number: serviceData?.phone_number,
        email: serviceData?.email,
        service_type: serviceData?.service_type,
    });
    // Validate input data
    const validation = (0, nameSimilarity_1.validateServiceData)(serviceData);
    if (!validation.isValid) {
        console.warn('[serviceDedup] validation failed:', validation.errors);
        throw new Error(`Invalid service data: ${validation.errors.join(', ')}`);
    }
    const cleanedData = validation.cleaned;
    // Try to find existing service by phone number first (highest priority)
    let existingService = null;
    let lookupMethod = '';
    if (cleanedData.phone_number) {
        existingService = await (0, services_1.getServiceByPhone)(cleanedData.phone_number);
        lookupMethod = 'phone';
    }
    // If not found by phone, try email
    if (!existingService && cleanedData.email) {
        existingService = await (0, services_1.getServiceByEmail)(cleanedData.email);
        lookupMethod = 'email';
    }
    if (existingService) {
        return await handleExistingService(existingService, cleanedData, lookupMethod);
    }
    else {
        return await handleNewService(cleanedData);
    }
}
/**
 * Handle case where an existing service is found
 */
async function handleExistingService(existingService, newData, lookupMethod) {
    const serviceId = existingService.id;
    // Get existing service with all name variations
    const serviceWithNames = await (0, services_1.getServiceWithNames)(serviceId);
    if (!serviceWithNames) {
        throw new Error('Service not found after lookup');
    }
    console.log('[serviceDedup] existing service snapshot:', {
        id: serviceId,
        existing_service_type: existingService.service_type,
        existing_name: existingService.name,
        existing_business_name: existingService.business_name,
    });
    // Check if the new name is similar to existing names
    const nameComparison = (0, nameSimilarity_1.areNamesLikelySame)(newData.name, existingService.name);
    let action = 'updated';
    let confidence = nameComparison.confidence;
    let reasoning = `Found existing service by ${lookupMethod}. ${nameComparison.reasoning}`;
    // If names are similar, this is likely the same person
    if (nameComparison.isSimilar) {
        // Add the new name variation if it's different
        if (newData.name.toLowerCase() !== existingService.name.toLowerCase()) {
            await (0, services_1.addServiceName)(serviceId, newData.name, confidence);
            await (0, services_1.updateCanonicalName)(serviceId);
        }
        // Update service information with any new data
        const updates = {};
        let hasUpdates = false;
        // Ensure we persist service_type if the existing record is missing it
        if (!existingService.service_type) {
            const incomingType = newData.service_type || (0, nameSimilarity_1.extractServiceType)(newData.name, newData.business_name);
            console.log('[serviceDedup] resolving missing service_type for existing service:', {
                incomingType,
                newData_service_type: newData.service_type,
                extracted_from_name: (0, nameSimilarity_1.extractServiceType)(newData.name, newData.business_name)
            });
            if (incomingType) {
                updates.service_type = incomingType;
                hasUpdates = true;
            }
        }
        if (newData.business_name && !existingService.business_name) {
            updates.business_name = newData.business_name;
            hasUpdates = true;
        }
        if (newData.address && !existingService.address) {
            updates.address = newData.address;
            hasUpdates = true;
        }
        if (newData.website && !existingService.website) {
            updates.website = newData.website;
            hasUpdates = true;
        }
        // Add missing identifier if we have one
        if (newData.phone_number && !existingService.phone_number) {
            updates.phone_number = newData.phone_number;
            hasUpdates = true;
        }
        if (newData.email && !existingService.email) {
            updates.email = newData.email;
            hasUpdates = true;
        }
        if (hasUpdates) {
            console.log('[serviceDedup] applying updates to existing service:', { serviceId, updates });
            await (0, services_1.updateService)(serviceId, updates);
            action = 'updated';
            reasoning += '. Updated service information.';
        }
        else {
            action = 'merged';
            reasoning += '. No new information to add.';
        }
    }
    else {
        // Names are not similar - this might be a different person with same phone/email
        // This is a conflict that needs to be handled carefully
        // For now, we'll still link to the existing service but with lower confidence
        // In a production system, you might want to flag this for manual review
        await (0, services_1.addServiceName)(serviceId, newData.name, 0.3); // Low confidence for different name
        action = 'merged';
        confidence = 0.3;
        reasoning += ` Warning: Different name found for same ${lookupMethod}. This may be a conflict.`;
    }
    return {
        serviceId,
        isNew: false,
        action,
        confidence,
        reasoning
    };
}
/**
 * Handle case where no existing service is found
 */
async function handleNewService(serviceData) {
    // Extract service type if not provided
    if (!serviceData.service_type) {
        const extractedType = (0, nameSimilarity_1.extractServiceType)(serviceData.name, serviceData.business_name);
        if (extractedType) {
            serviceData.service_type = extractedType;
        }
    }
    // Create new service
    console.log('[serviceDedup] creating new service with data:', {
        name: serviceData?.name,
        phone_number: serviceData?.phone_number,
        email: serviceData?.email,
        service_type: serviceData?.service_type,
        business_name: serviceData?.business_name,
    });
    const serviceId = await (0, services_1.createService)(serviceData);
    return {
        serviceId,
        isNew: true,
        action: 'created',
        confidence: 1.0,
        reasoning: 'Created new service entity'
    };
}
/**
 * Get service information with all name variations and metadata
 */
async function getServiceInfo(serviceId) {
    const serviceWithNames = await (0, services_1.getServiceWithNames)(serviceId);
    if (!serviceWithNames) {
        throw new Error('Service not found');
    }
    // Get recommendations count
    const pool = (await Promise.resolve().then(() => __importStar(require('../db')))).default;
    const recommendationsResult = await pool.query('SELECT COUNT(*) as count FROM recommendations WHERE service_id = $1', [serviceId]);
    const recommendations_count = parseInt(recommendationsResult.rows[0].count);
    return {
        service: serviceWithNames,
        names: serviceWithNames.names.map(n => ({
            name: n.name,
            frequency: n.frequency,
            confidence: n.confidence,
            last_seen: n.last_seen
        })),
        recommendations_count
    };
}
/**
 * Search for potential duplicate services (for admin/debugging)
 */
async function findPotentialDuplicates(serviceData) {
    const { searchServicesByName } = await Promise.resolve().then(() => __importStar(require('../db/services')));
    const exactMatches = [];
    const similarNames = [];
    const similarPhones = [];
    // Search by name
    if (serviceData.name) {
        const nameResults = await searchServicesByName(serviceData.name, 20);
        for (const service of nameResults) {
            const nameComparison = (0, nameSimilarity_1.areNamesLikelySame)(serviceData.name, service.name);
            if (nameComparison.isSimilar) {
                if (nameComparison.confidence > 0.95) {
                    exactMatches.push(service);
                }
                else {
                    similarNames.push(service);
                }
            }
        }
    }
    // Search by phone number (partial matches)
    if (serviceData.phone_number) {
        const normalizedPhone = (0, services_1.normalizePhoneNumber)(serviceData.phone_number);
        const pool = (await Promise.resolve().then(() => __importStar(require('../db')))).default;
        // Find services with similar phone numbers (last 6 digits match)
        if (normalizedPhone.length >= 6) {
            const lastSix = normalizedPhone.slice(-6);
            const phoneResults = await pool.query(`SELECT * FROM services 
         WHERE phone_number LIKE $1 
         AND phone_number != $2`, [`%${lastSix}`, normalizedPhone]);
            similarPhones.push(...phoneResults.rows);
        }
    }
    return {
        exactMatches,
        similarNames,
        similarPhones
    };
}
/**
 * Merge two services (admin function for manual conflict resolution)
 */
async function mergeServices(primaryServiceId, secondaryServiceId) {
    const pool = (await Promise.resolve().then(() => __importStar(require('../db')))).default;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Get both services
        const primaryService = await (0, services_1.getServiceWithNames)(primaryServiceId);
        const secondaryService = await (0, services_1.getServiceWithNames)(secondaryServiceId);
        if (!primaryService || !secondaryService) {
            throw new Error('One or both services not found');
        }
        // Move all name variations from secondary to primary
        await client.query(`UPDATE service_names 
       SET service_id = $1 
       WHERE service_id = $2`, [primaryServiceId, secondaryServiceId]);
        // Update recommendations to point to primary service
        await client.query(`UPDATE recommendations 
       SET service_id = $1 
       WHERE service_id = $2`, [primaryServiceId, secondaryServiceId]);
        // Update canonical name for primary service
        await (0, services_1.updateCanonicalName)(primaryServiceId);
        // Delete secondary service
        await client.query('DELETE FROM services WHERE id = $1', [secondaryServiceId]);
        await client.query('COMMIT');
        return {
            success: true,
            mergedServiceId: primaryServiceId,
            message: `Successfully merged service ${secondaryServiceId} into ${primaryServiceId}`
        };
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
