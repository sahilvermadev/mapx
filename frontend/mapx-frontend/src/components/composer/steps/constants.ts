/**
 * Constants for PreviewStep and related components
 */

export const RATING_MESSAGES = {
  5: 'Truly exceptional!',
  4: 'Really good!',
  3: 'Worth trying!',
  2: 'Just okay!',
  1: 'Not it!',
} as const;

export const MAX_VISIBLE_LABELS = 6;
export const MAX_LABEL_LENGTH = 40;
export const MIN_PLACE_NAME_INPUT_WIDTH = 150; // Increased from 100 to make it easier to click
export const PLACE_NAME_INPUT_PADDING = 8;

export const INPUT_STYLE_PROPS = {
  border: 'none',
  outline: 'none',
} as const;

export const INPUT_CLASSES = {
  base: 'border-0 focus:ring-0 focus:outline-none focus:border-0 focus-visible:ring-0 focus-visible:border-0 focus-visible:outline-none shadow-none appearance-none',
  transparent: 'bg-transparent',
} as const;

