/**
 * Constants for RecommendationComposer and related components
 * Centralized location for all constant values used across the composer
 */

// ============================================================================
// Content Types
// ============================================================================

export const CONTENT_TYPES = {
  PLACE: 'place',
  SERVICE: 'service',
  TIP: 'tip',
  CONTACT: 'contact',
  UNCLEAR: 'unclear',
} as const;

export type ContentType = typeof CONTENT_TYPES[keyof typeof CONTENT_TYPES];

// ============================================================================
// Field Names
// ============================================================================

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
} as const;

// ============================================================================
// Celebration Animation Constants
// ============================================================================

export const CELEBRATION_DELAY_MS = 1800;
export const CELEBRATION_SHAPES_COUNT = 12;
export const CELEBRATION_SHAPE_RADIUS = 100;
export const CELEBRATION_SHAPE_SIZE_MIN = 12;
export const CELEBRATION_SHAPE_SIZE_MAX = 28;
export const CELEBRATION_SHAPE_COLORS = ['#000', '#fbbf24', '#ef4444'] as const;

// ============================================================================
// Preview Step Constants
// ============================================================================

export const PREVIEW_DEBOUNCE_MS = 1000;
export const PREVIEW_FALLBACK_TIMEOUT_MS = 25000;

// ============================================================================
// Text Analysis Constants
// ============================================================================

export const RECOMMENDATION_PREFIX = "I want to recommend a ";
export const MIN_TEXT_LENGTH = 5;
export const QUESTION_ANALYSIS_DELAY_MS = 100;

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  EMPTY_TEXT: 'Please enter some text before continuing.',
  TEXT_TOO_SHORT: 'Please enter at least 5 characters for your recommendation.',
  GIBBERISH: 'Please provide a meaningful recommendation. The text you entered doesn\'t seem to contain useful information.',
  ANALYSIS_ERROR: 'Sorry, there was an error analyzing your recommendation. Please try again.',
  SAVE_ERROR: 'Sorry, there was an error saving your recommendation. Please try again.',
  VALIDATION_ERROR: 'Please provide a more specific answer.',
  SAVE_FAILED: 'Failed to save recommendation',
} as const;

// ============================================================================
// Success Messages
// ============================================================================

export const SUCCESS_MESSAGES = {
  POSTED: 'Recommendation posted!',
} as const;

// ============================================================================
// Re-export step-specific constants
// ============================================================================

export {
  RATING_MESSAGES,
  MAX_VISIBLE_LABELS,
  MAX_LABEL_LENGTH,
  MIN_PLACE_NAME_INPUT_WIDTH,
  PLACE_NAME_INPUT_PADDING,
  INPUT_STYLE_PROPS,
  INPUT_CLASSES,
} from './steps/constants';

// ============================================================================
// Curated Labels
// ============================================================================

/**
 * Curated labels organized by category for place recommendations
 * These labels help users categorize and tag their recommendations
 */
export const CURATED_LABELS = {
  'Atmosphere & Vibe': [
    'Atmosphere',
    'Good Music',
    'Live Music',
    'Dancing',
    'Romantic',
    'Hidden Gem',
    'Speakeasy',
  ],
  'Occasions & Groups': [
    'Afternoon Tea',
    'After Work',
    'Birthdays',
    'Brunch',
    'Business Lunch',
    'Casual Dinner',
    'Date Night',
    'First Date',
    "Girl's Night",
    'Hangover',
    'Happy Hour',
    'Large Group (8+)',
    'Lunch',
    'Night Out',
    'Parents',
    'Pre-Theatre',
    'Private Events',
    'Quick Bite',
    'Solo Dining',
    'Special Occasion',
    'Visitors',
  ],
  'Food & Drink Details': [
    'AYCE (All You Can Eat)',
    'Beer',
    'Bottomless Brunch',
    'Breakfast',
    'BYOB (Bring Your Own Bottle)',
    'Cocktails',
    'Coffee',
    'Dessert',
    'Large Portions',
    'Mocktails',
    'Small Plates',
    'Tasting Menu',
    'Wine List',
  ],
  'Dietary & Cuisine': [
    'Gluten Free',
    'Halal',
    'Healthy',
    'Vegans',
    'Vegetarians',
  ],
  'Service & Logistics': [
    'Delivery',
    'Last-Minute Res (Reservation)',
    'National Shipping',
    'Takeout',
    'Walk-ins',
    'Walk-in Only',
    'Working',
  ],
  'Features & Amenities': [
    'Cash Only',
    'Dog Friendly',
    'Kid Friendly',
    'Karaoke',
    'LGBTQ+',
    'Photos',
    'Rooftop',
    'Sharing',
    'Sports / TVs',
    'Trivia',
    'Views',
    'Outdoor Seating',
    'On the Water',
  ],
  'General Impressions': [
    'Cheap Eats',
    'Fine Dining',
    'Great Service',
  ],
  'What was wrong?': [
    'Bad Ambiance',
    'Bad Music',
    'Too Crowded',
    'Too Loud',
    'Tourist-y',
    'Bad Food',
    'Small Portions',
    'Unhealthy',
    'Unsanitary',
    'Traveled Badly',
    'Bad Service',
    'Hard to Park',
    'Hard To Reserve',
    'Limited Options',
    'Limited Seating',
    'Long Wait',
    'Expensive',
    'Overpriced',
    'Overrated',
  ],
} as const;

