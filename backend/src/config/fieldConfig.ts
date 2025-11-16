/**
 * Centralized field configuration for recommendation content types
 * 
 * This is the single source of truth for:
 * - Which fields are allowed for each content type
 * - Which fields are required
 * - Which fields are forbidden/never asked for
 * - Field name mappings and aliases
 */

import { CONTENT_TYPES } from './constants';

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

export interface FieldConfig {
  /** Fields that are allowed for this content type */
  allowed: readonly string[];
  /** Fields that are required for this content type */
  required: readonly string[];
  /** Fields that are forbidden/never asked for this content type */
  forbidden: readonly string[];
  /** Field aliases - maps alternative field names to canonical names */
  aliases?: Record<string, string>;
}

/**
 * Field configuration per content type
 * This is the single source of truth for field filtering logic
 */
export const FIELD_CONFIG: Partial<Record<ContentType, FieldConfig>> = {
  [CONTENT_TYPES.PLACE]: {
    allowed: [
      'name',
      'location',
      'highlights',
      'labels',
      'rating',
      'description',
      'category',
      'pricing',
      'experience',
    ] as const,
    required: ['name', 'location'] as const,
    forbidden: [
      'contact_info',
      'phone',
      'email',
      'service_phone',
      'service_email',
      'tips',
      'best_times',
      'best_time',
    ] as const,
    aliases: {
      location_address: 'location',
      address: 'location',
      location_name: 'location',
    },
  },
  [CONTENT_TYPES.SERVICE]: {
    allowed: [
      'name',
      'location',
      'contact_info',
      'highlights',
      'rating',
      'description',
      'category',
      'pricing',
      'experience',
    ] as const,
    required: ['name', 'contact_info'] as const,
    forbidden: [
      'tips',
      'best_times',
      'best_time',
    ] as const,
    aliases: {
      phone: 'contact_info',
      email: 'contact_info',
      service_phone: 'contact_info',
      service_email: 'contact_info',
      location_address: 'location',
      address: 'location',
      location_name: 'location',
    },
  },
  [CONTENT_TYPES.UNCLEAR]: {
    allowed: [
      'name',
      'description',
      'location',
      'category',
    ] as const,
    required: [] as const,
    forbidden: [] as const,
    aliases: {
      location_address: 'location',
      address: 'location',
      location_name: 'location',
    },
  },
} as const;

/**
 * Check if a field is allowed for a given content type
 */
export function isFieldAllowed(field: string, contentType: ContentType): boolean {
  const config = FIELD_CONFIG[contentType];
  if (!config) return false;
  const canonicalField = normalizeFieldName(field, contentType);
  return config.allowed.includes(canonicalField as any);
}

/**
 * Check if a field is required for a given content type
 */
export function isFieldRequired(field: string, contentType: ContentType): boolean {
  const config = FIELD_CONFIG[contentType];
  if (!config) return false;
  const canonicalField = normalizeFieldName(field, contentType);
  return config.required.includes(canonicalField as any);
}

/**
 * Check if a field is forbidden for a given content type
 */
export function isFieldForbidden(field: string, contentType: ContentType): boolean {
  const config = FIELD_CONFIG[contentType];
  if (!config) return false;
  const canonicalField = normalizeFieldName(field, contentType);
  return config.forbidden.includes(canonicalField as any);
}

/**
 * Normalize a field name to its canonical form using aliases
 */
export function normalizeFieldName(field: string, contentType: ContentType): string {
  const config = FIELD_CONFIG[contentType];
  if (config?.aliases && config.aliases[field]) {
    return config.aliases[field];
  }
  return field;
}

/**
 * Filter out forbidden fields from an array of field names
 */
export function filterForbiddenFields(
  fields: string[],
  contentType: ContentType
): string[] {
  return fields.filter(field => !isFieldForbidden(field, contentType));
}

/**
 * Get all required fields that are missing from the extracted data
 */
export function getMissingRequiredFields(
  extractedData: Record<string, any>,
  contentType: ContentType
): string[] {
  const config = FIELD_CONFIG[contentType];
  if (!config) return [];
  const missing: string[] = [];

  for (const requiredField of config.required) {
    const hasField = checkFieldExists(requiredField, extractedData, contentType);
    if (!hasField) {
      missing.push(requiredField);
    }
  }

  return missing;
}

/**
 * Check if a field exists in the extracted data (handles aliases and nested structures)
 */
function checkFieldExists(
  field: string,
  data: Record<string, any>,
  contentType: ContentType
): boolean {
  // Special handling for contact_info (check nested and flat structures)
  // This must come FIRST to avoid treating empty objects as valid
  if (field === 'contact_info') {
    const phone = data.contact_info?.phone || data.phone || data.service_phone;
    const email = data.contact_info?.email || data.email || data.service_email;
    // Only return true if we have a valid (non-empty) phone or email
    const hasValidPhone = phone && typeof phone === 'string' && phone.trim().length > 0;
    const hasValidEmail = email && typeof email === 'string' && email.trim().length > 0;
    return !!(hasValidPhone || hasValidEmail);
  }

  const value = data[field];
  if (value !== undefined && value !== null && String(value).trim().length > 0) {
    return true;
  }

  // Check aliases
  const config = FIELD_CONFIG[contentType];
  if (config?.aliases) {
    for (const [alias, canonical] of Object.entries(config.aliases)) {
      if (canonical === field) {
        const aliasValue = data[alias];
        if (aliasValue !== undefined && aliasValue !== null && String(aliasValue).trim().length > 0) {
          return true;
        }
      }
    }
  }

  // Special handling for location fields (check multiple variations)
  if (field === 'location') {
    return !!(
      data.location ||
      data.location_address ||
      data.address ||
      data.location_name
    );
  }

  // Special handling for name field (check common variations)
  if (field === 'name') {
    return !!(
      data.name ||
      data.title ||
      data.place_name ||
      data.service_name
    );
  }

  return false;
}

