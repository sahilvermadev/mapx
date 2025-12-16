import { 
  ServiceData, 
  Service, 
  getServiceByPhone, 
  getServiceByEmail, 
  createService, 
  updateService, 
  addServiceName, 
  updateCanonicalName,
  getServiceWithNames,
  normalizePhoneNumber,
  normalizeEmail,
  updateServiceAggregates
} from '../db/services';
import { 
  areNamesLikelySame, 
  extractServiceType, 
  validateServiceData 
} from '../utils/nameSimilarity';
import { serviceCategoryService } from './serviceCategoryService';

export interface UpsertServiceResult {
  serviceId: number;
  isNew: boolean;
  action: 'created' | 'updated' | 'merged';
  confidence: number;
  reasoning: string;
}

/**
 * Main function to upsert a service with automatic deduplication
 * This is the core logic that handles all deduplication scenarios
 */
export async function upsertService(serviceData: ServiceData): Promise<UpsertServiceResult> {
  console.log('[serviceDedup] upsertService input:', {
    name: serviceData?.name,
    phone_number: serviceData?.phone_number,
    email: serviceData?.email,
    service_type: serviceData?.service_type,
  });
  // Validate input data
  const validation = validateServiceData(serviceData);
  if (!validation.isValid) {
    console.warn('[serviceDedup] validation failed:', validation.errors);
    throw new Error(`Invalid service data: ${validation.errors.join(', ')}`);
  }
  
  // Keep validated identifiers and names, but also forward normalized location fields that validator ignores
  const cleanedData = {
    ...validation.cleaned,
    // pass-through extras for location normalization
    city_name: (serviceData as any).city_name,
    city_slug: (serviceData as any).city_slug,
    admin1_name: (serviceData as any).admin1_name,
    country_code: (serviceData as any).country_code,
    address: (serviceData as any).address,
    website: (serviceData as any).website,
    service_type: validation.cleaned.service_type || (serviceData as any).service_type,
  } as any;
  
  // Use transaction with SELECT FOR UPDATE to prevent race conditions
  const pool = (await import('../db')).default;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Try to find existing service by phone number first (highest priority)
    // Use FOR UPDATE SKIP LOCKED to prevent race conditions
    let existingService: Service | null = null;
    let lookupMethod = '';
    
    if (cleanedData.phone_number) {
      const normalizedPhone = normalizePhoneNumber(cleanedData.phone_number);
      if (normalizedPhone) {
        const lockedResult = await client.query(
          'SELECT * FROM services WHERE phone_number = $1 AND deleted_at IS NULL FOR UPDATE SKIP LOCKED',
          [normalizedPhone]
        );
        existingService = lockedResult.rows[0] || null;
        if (existingService) {
          lookupMethod = 'phone';
        }
      }
    }
    
    // If not found by phone, try email
    if (!existingService && cleanedData.email) {
      const normalizedEmail = normalizeEmail(cleanedData.email);
      if (normalizedEmail) {
        const lockedResult = await client.query(
          'SELECT * FROM services WHERE email = $1 AND deleted_at IS NULL FOR UPDATE SKIP LOCKED',
          [normalizedEmail]
        );
        existingService = lockedResult.rows[0] || null;
        if (existingService) {
          lookupMethod = 'email';
        }
      }
    }
    
    let result: UpsertServiceResult;
    
    if (existingService) {
      result = await handleExistingService(existingService, cleanedData, lookupMethod);
    } else {
      // Use INSERT ... ON CONFLICT for atomic upsert to prevent race conditions
      result = await handleNewServiceAtomic(client, cleanedData);
    }
    
    await client.query('COMMIT');
    return result;
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Handle case where an existing service is found
 */
async function handleExistingService(
  existingService: Service, 
  newData: any, 
  lookupMethod: string
): Promise<UpsertServiceResult> {
  const serviceId = existingService.id;
  
  // Get existing service with all name variations (ensure not deleted)
  const serviceWithNames = await getServiceWithNames(serviceId);
  if (!serviceWithNames) {
    throw new Error('Service not found or has been deleted');
  }
  // deleted_at check is handled in getServiceWithNames query
  console.log('[serviceDedup] existing service snapshot:', {
    id: serviceId,
    existing_service_type: existingService.service_type,
    existing_name: existingService.name,
  });
  
  // Check if the new name is similar to existing names
  const nameComparison = areNamesLikelySame(newData.name, existingService.name);
  
  let action: 'created' | 'updated' | 'merged' = 'updated';
  let confidence = nameComparison.confidence;
  let reasoning = `Found existing service by ${lookupMethod}. ${nameComparison.reasoning}`;
  
  // If names are similar, this is likely the same person
  if (nameComparison.isSimilar) {
    // Add the new name variation if it's different
    if (newData.name.toLowerCase() !== existingService.name.toLowerCase()) {
      await addServiceName(serviceId, newData.name, confidence);
      await updateCanonicalName(serviceId);
    }
    
    // Update service information with any new data
    const updates: Partial<ServiceData> = {};
    let hasUpdates = false;
    
    // Ensure we persist service_type if the existing record is missing it
    if (!existingService.service_type) {
      const incomingType = newData.service_type || extractServiceType(newData.name, undefined);
      console.log('[serviceDedup] resolving missing service_type for existing service:', {
        incomingType,
        newData_service_type: newData.service_type,
        extracted_from_name: extractServiceType(newData.name, undefined)
      });
      if (incomingType) {
        updates.service_type = incomingType;
        hasUpdates = true;
      }
    }

    if (newData.address && !existingService.address) {
      updates.address = newData.address;
      hasUpdates = true;
    }
    
    if (newData.website && !existingService.website) {
      updates.website = newData.website;
      hasUpdates = true;
    }

    // Fill normalized city fields if missing on existing or provided and different
    if (newData.city_name && (!existingService.city_name || existingService.city_name !== newData.city_name)) {
      (updates as any).city_name = newData.city_name;
      hasUpdates = true;
    }
    if (newData.city_slug && (!existingService.city_slug || existingService.city_slug !== newData.city_slug)) {
      (updates as any).city_slug = newData.city_slug;
      hasUpdates = true;
    }
    if (newData.admin1_name && (!existingService.admin1_name || existingService.admin1_name !== newData.admin1_name)) {
      (updates as any).admin1_name = newData.admin1_name;
      hasUpdates = true;
    }
    if (newData.country_code && (!existingService.country_code || existingService.country_code !== newData.country_code)) {
      (updates as any).country_code = newData.country_code;
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
      await updateService(serviceId, updates);
      action = 'updated';
      reasoning += '. Updated service information.';
    } else {
      action = 'merged';
      reasoning += '. No new information to add.';
    }

    // Auto-detect and link category if not already linked
    try {
      const categoryId = await serviceCategoryService.linkServiceToCategoryAuto(
        serviceId,
        undefined, // No explicit category provided
        existingService.service_type || newData.service_type,
        existingService.name,
        undefined, // business name deprecated – avoid using it for new category decisions
        false, // Auto-detected, not user-provided
        0.8 // Medium confidence for auto-detection
      );
      if (categoryId) {
        // Update primary_category_id if this is the first/only category
        const primaryCategory = await serviceCategoryService.getPrimaryCategory(serviceId);
        if (primaryCategory) {
          await updateServiceAggregates(serviceId, {
            primary_category_id: primaryCategory.id,
          });
        }
      }
    } catch (error) {
      // Non-fatal: log but don't fail the deduplication
      console.warn('[serviceDedup] Failed to auto-link category:', error);
    }
    
  } else {
    // Names are not similar - this might be a different person with same phone/email
    // This is a conflict that needs to be handled carefully
    
    // For now, we'll still link to the existing service but with lower confidence
    // In a production system, you might want to flag this for manual review
    await addServiceName(serviceId, newData.name, 0.3); // Low confidence for different name
    
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
 * Handle case where no existing service is found (atomic version using INSERT ON CONFLICT)
 * This prevents race conditions when multiple requests try to create the same service
 */
async function handleNewServiceAtomic(client: any, serviceData: any): Promise<UpsertServiceResult> {
  // Extract service type if not provided
  if (!serviceData.service_type) {
    const extractedType = extractServiceType(serviceData.name, undefined);
    if (extractedType) {
      serviceData.service_type = extractedType;
    }
  }
  
  // Normalize phone and email
  const normalizedPhone = serviceData.phone_number ? normalizePhoneNumber(serviceData.phone_number) : null;
  const normalizedEmail = serviceData.email ? normalizeEmail(serviceData.email) : null;
  
  // Validate that at least one identifier is provided
  if (!normalizedPhone && !normalizedEmail) {
    throw new Error('Service must have either phone number or email');
  }
  
  // Use INSERT ... ON CONFLICT to atomically handle race conditions
  // This ensures that if two concurrent requests try to create the same service,
  // only one succeeds and the other gets the existing service ID
  // If another request creates the service between our check and insert, we'll get the existing one
  let conflictTarget = '';
  let conflictClause = '';
  
  if (normalizedPhone && normalizedEmail) {
    // If both exist, conflict can happen on phone_number (checked first)
    // Note: We can't use WHERE in ON CONFLICT, so we'll handle deleted_at in the UPDATE clause
    conflictTarget = 'phone_number';
    conflictClause = `
      ON CONFLICT (phone_number) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, services.email),
        name = COALESCE(services.name, EXCLUDED.name),
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = NULL
    `;
  } else if (normalizedPhone) {
    conflictTarget = 'phone_number';
    conflictClause = `
      ON CONFLICT (phone_number) DO UPDATE SET
        name = COALESCE(services.name, EXCLUDED.name),
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = NULL
    `;
  } else if (normalizedEmail) {
    conflictTarget = 'email';
    conflictClause = `
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(services.name, EXCLUDED.name),
        updated_at = CURRENT_TIMESTAMP,
        deleted_at = NULL
    `;
  }
  
  const insertResult = await client.query(
    `INSERT INTO services (
      phone_number, email, name, service_type, 
      address, website, city_name, city_slug, admin1_name, country_code, metadata, deleted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)
    ${conflictClause}
    RETURNING id, phone_number, email, name`,
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
  
  const serviceId = insertResult.rows[0].id;
  
  // Check if this was a new insert or an update due to conflict
  // We can tell by checking if the returned phone/email matches what we tried to insert
  const wasConflict = conflictTarget === 'phone_number' 
    ? insertResult.rows[0].phone_number === normalizedPhone && normalizedPhone !== null
    : conflictTarget === 'email'
    ? insertResult.rows[0].email === normalizedEmail && normalizedEmail !== null
    : false;
  
  // Get the full service record to check if it's truly new
  const existingCheck = await client.query(
    'SELECT * FROM services WHERE id = $1 AND deleted_at IS NULL',
    [serviceId]
  );
  const existingService = existingCheck.rows[0];
  
  // Check if service_names already has entries (indicates existing service)
  const nameCheck = await client.query(
    'SELECT COUNT(*) as count FROM service_names WHERE service_id = $1',
    [serviceId]
  );
  const hasExistingNames = parseInt(nameCheck.rows[0].count) > 0;
  const isNewService = !hasExistingNames;
  
  // Insert initial name entry (only if new service, or add name variation if existing)
  if (isNewService) {
    await client.query(
      `INSERT INTO service_names (service_id, name, frequency, confidence)
       VALUES ($1, $2, 1, 1.0)
       ON CONFLICT (service_id, name) DO UPDATE SET
         frequency = service_names.frequency + 1,
         last_seen = CURRENT_TIMESTAMP`,
      [serviceId, serviceData.name]
    );
  } else {
    // Service already existed, add name variation
    await client.query(
      `INSERT INTO service_names (service_id, name, frequency, confidence)
       VALUES ($1, $2, 1, 1.0)
       ON CONFLICT (service_id, name) DO UPDATE SET
         frequency = service_names.frequency + 1,
         confidence = GREATEST(service_names.confidence, EXCLUDED.confidence),
         last_seen = CURRENT_TIMESTAMP`,
      [serviceId, serviceData.name]
    );
    
    // Update canonical name
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
      await client.query(
        'UPDATE services SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [canonicalName, serviceId]
      );
    }
  }
  
  // Auto-detect and link category
  try {
    const categoryId = await serviceCategoryService.linkServiceToCategoryAuto(
      serviceId,
      undefined, // No explicit category provided
      serviceData.service_type,
      serviceData.name,
      serviceData.business_name,
      false, // Auto-detected, not user-provided
      0.8 // Medium confidence for auto-detection
    );
    if (categoryId) {
      // Update primary_category_id
      await updateServiceAggregates(serviceId, {
        primary_category_id: categoryId,
      });
    }
  } catch (error) {
    // Non-fatal: log but don't fail the creation
    console.warn('[serviceDedup] Failed to auto-link category:', error);
  }
  
  return {
    serviceId,
    isNew: !wasConflict,
    action: wasConflict ? 'merged' : 'created',
    confidence: wasConflict ? 0.9 : 1.0,
    reasoning: wasConflict 
      ? `Service already existed (conflict on ${conflictTarget}), merged new data`
      : 'Created new service entity'
  };
}

/**
 * Handle case where no existing service is found (legacy version, kept for backward compatibility)
 */
async function handleNewService(serviceData: any): Promise<UpsertServiceResult> {
  // Extract service type if not provided
  if (!serviceData.service_type) {
    const extractedType = extractServiceType(serviceData.name, undefined);
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
  });
  const serviceId = await createService(serviceData);
  
  // Auto-detect and link category
  try {
    const categoryId = await serviceCategoryService.linkServiceToCategoryAuto(
      serviceId,
      undefined, // No explicit category provided
      serviceData.service_type,
      serviceData.name,
      undefined, // business name deprecated – avoid using it for new category decisions
      false, // Auto-detected, not user-provided
      0.8 // Medium confidence for auto-detection
    );
    if (categoryId) {
      // Update primary_category_id
      await updateServiceAggregates(serviceId, {
        primary_category_id: categoryId,
      });
    }
  } catch (error) {
    // Non-fatal: log but don't fail the creation
    console.warn('[serviceDedup] Failed to auto-link category:', error);
  }
  
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
export async function getServiceInfo(serviceId: number): Promise<{
  service: Service;
  names: Array<{
    name: string;
    frequency: number;
    confidence: number;
    last_seen: Date;
  }>;
  recommendations_count: number;
}> {
  const serviceWithNames = await getServiceWithNames(serviceId);
  if (!serviceWithNames) {
    throw new Error('Service not found');
  }
  
  // Get recommendations count
  const pool = (await import('../db')).default;
  const recommendationsResult = await pool.query(
    'SELECT COUNT(*) as count FROM recommendations WHERE service_id = $1',
    [serviceId]
  );
  
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
export async function findPotentialDuplicates(serviceData: ServiceData): Promise<{
  exactMatches: Service[];
  similarNames: Service[];
  similarPhones: Service[];
}> {
  const { searchServicesByName } = await import('../db/services');
  
  const exactMatches: Service[] = [];
  const similarNames: Service[] = [];
  const similarPhones: Service[] = [];
  
  // Search by name
  if (serviceData.name) {
    const nameResults = await searchServicesByName(serviceData.name, 20);
    
    for (const service of nameResults) {
      const nameComparison = areNamesLikelySame(serviceData.name, service.name);
      
      if (nameComparison.isSimilar) {
        if (nameComparison.confidence > 0.95) {
          exactMatches.push(service);
        } else {
          similarNames.push(service);
        }
      }
    }
  }
  
  // Search by phone number (partial matches)
  if (serviceData.phone_number) {
    const normalizedPhone = normalizePhoneNumber(serviceData.phone_number);
    const pool = (await import('../db')).default;
    
    // Find services with similar phone numbers (last 6 digits match)
    if (normalizedPhone.length >= 6) {
      const lastSix = normalizedPhone.slice(-6);
      const phoneResults = await pool.query(
        `SELECT * FROM services 
         WHERE phone_number LIKE $1 
         AND phone_number != $2`,
        [`%${lastSix}`, normalizedPhone]
      );
      
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
export async function mergeServices(
  primaryServiceId: number, 
  secondaryServiceId: number
): Promise<{
  success: boolean;
  mergedServiceId: number;
  message: string;
}> {
  const pool = (await import('../db')).default;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Get both services
    const primaryService = await getServiceWithNames(primaryServiceId);
    const secondaryService = await getServiceWithNames(secondaryServiceId);
    
    if (!primaryService || !secondaryService) {
      throw new Error('One or both services not found');
    }
    
    // Move all name variations from secondary to primary
    await client.query(
      `UPDATE service_names 
       SET service_id = $1 
       WHERE service_id = $2`,
      [primaryServiceId, secondaryServiceId]
    );
    
    // Update recommendations to point to primary service
    await client.query(
      `UPDATE recommendations 
       SET service_id = $1 
       WHERE service_id = $2`,
      [primaryServiceId, secondaryServiceId]
    );
    
    // Update canonical name for primary service
    await updateCanonicalName(primaryServiceId);
    
    // Delete secondary service
    await client.query('DELETE FROM services WHERE id = $1', [secondaryServiceId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      mergedServiceId: primaryServiceId,
      message: `Successfully merged service ${secondaryServiceId} into ${primaryServiceId}`
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
