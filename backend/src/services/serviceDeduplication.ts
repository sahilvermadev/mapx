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
  normalizeEmail
} from '../db/services';
import { 
  areNamesLikelySame, 
  extractServiceType, 
  validateServiceData 
} from '../utils/nameSimilarity';

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
  
  const cleanedData = validation.cleaned;
  
  // Try to find existing service by phone number first (highest priority)
  let existingService: Service | null = null;
  let lookupMethod = '';
  
  if (cleanedData.phone_number) {
    existingService = await getServiceByPhone(cleanedData.phone_number);
    lookupMethod = 'phone';
  }
  
  // If not found by phone, try email
  if (!existingService && cleanedData.email) {
    existingService = await getServiceByEmail(cleanedData.email);
    lookupMethod = 'email';
  }
  
  if (existingService) {
    return await handleExistingService(existingService, cleanedData, lookupMethod);
  } else {
    return await handleNewService(cleanedData);
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
  
  // Get existing service with all name variations
  const serviceWithNames = await getServiceWithNames(serviceId);
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
      const incomingType = newData.service_type || extractServiceType(newData.name, newData.business_name);
      console.log('[serviceDedup] resolving missing service_type for existing service:', {
        incomingType,
        newData_service_type: newData.service_type,
        extracted_from_name: extractServiceType(newData.name, newData.business_name)
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
      await updateService(serviceId, updates);
      action = 'updated';
      reasoning += '. Updated service information.';
    } else {
      action = 'merged';
      reasoning += '. No new information to add.';
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
 * Handle case where no existing service is found
 */
async function handleNewService(serviceData: any): Promise<UpsertServiceResult> {
  // Extract service type if not provided
  if (!serviceData.service_type) {
    const extractedType = extractServiceType(serviceData.name, serviceData.business_name);
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
  const serviceId = await createService(serviceData);
  
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
