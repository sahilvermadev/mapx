/**
 * Centralized constants for recommendation system
 * 
 * This file contains all magic strings and constants used throughout
 * the recommendation AI and composer system.
 */

/**
 * Content types for recommendations
 */
export const CONTENT_TYPES = {
  PLACE: 'place',
  SERVICE: 'service',
  TIP: 'tip',
  CONTACT: 'contact',
  UNCLEAR: 'unclear',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

/**
 * Canonical field names
 * Use these constants instead of hardcoded strings
 */
export const FIELDS = {
  NAME: 'name',
  DESCRIPTION: 'description',
  LOCATION: 'location',
  CONTACT_INFO: 'contact_info',
  HIGHLIGHTS: 'highlights',
  RATING: 'rating',
  CATEGORY: 'category',
  PRICING: 'pricing',
  EXPERIENCE: 'experience',
  LABELS: 'labels',
  PHONE: 'phone',
  EMAIL: 'email',
} as const;

/**
 * Field aliases - alternative names that map to canonical fields
 */
export const FIELD_ALIASES = {
  // Location variations
  LOCATION_ADDRESS: 'location_address',
  ADDRESS: 'address',
  LOCATION_NAME: 'location_name',
  
  // Contact variations
  SERVICE_PHONE: 'service_phone',
  SERVICE_EMAIL: 'service_email',
  
  // Deprecated fields (should not be used)
  BEST_TIMES: 'best_times',
  BEST_TIME: 'best_time',
  TIPS: 'tips',
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  FIELD_FORBIDDEN: (field: string, contentType: string) => 
    `${field} should not be asked for ${contentType} type recommendations`,
  FIELD_REQUIRED: (field: string, contentType: string) =>
    `${field} is required for ${contentType} type recommendations`,
  INVALID_FIELD: (field: string, contentType: string) =>
    `${field} is not allowed for ${contentType} type recommendations`,
} as const;



