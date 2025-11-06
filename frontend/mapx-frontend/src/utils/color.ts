// Utility functions for theme and color handling

// Returns black or white text depending on the perceived luminance of the background color
export function getReadableTextColor(hex: string): string {
  if (!hex) return '#000000';
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return '#000000';
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L < 0.55 ? '#FFFFFF' : '#000000';
}

// Read a CSS variable from :root with an optional fallback
export function getCssVar(varName: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim() || fallback;
}


