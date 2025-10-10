/**
 * Name similarity utilities for service deduplication
 * Uses Levenshtein distance and other string similarity algorithms
 */

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[len2][len1];
}

/**
 * Calculate similarity ratio between two strings (0-1, where 1 is identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(s1, s2);
  return 1 - (distance / maxLen);
}

/**
 * Check if two names are similar enough to be considered the same person
 */
export function areNamesSimilar(name1: string, name2: string, threshold: number = 0.85): boolean {
  if (!name1 || !name2) return false;
  
  const similarity = calculateSimilarity(name1, name2);
  return similarity >= threshold;
}

/**
 * Normalize name for comparison (remove extra spaces, convert to lowercase)
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Extract initials from a name
 */
export function getInitials(name: string): string {
  if (!name) return '';
  
  return name
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * Check if two names might be the same person using multiple heuristics
 */
export function areNamesLikelySame(name1: string, name2: string): {
  isSimilar: boolean;
  confidence: number;
  reasoning: string;
} {
  if (!name1 || !name2) {
    return { isSimilar: false, confidence: 0, reasoning: 'One or both names are empty' };
  }
  
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);
  
  // Exact match
  if (normalized1 === normalized2) {
    return { isSimilar: true, confidence: 1.0, reasoning: 'Exact match' };
  }
  
  // Calculate basic similarity
  const similarity = calculateSimilarity(normalized1, normalized2);
  
  // Check for common variations
  const variations1 = generateNameVariations(normalized1);
  const variations2 = generateNameVariations(normalized2);
  
  // Check if any variations match
  let bestMatch = similarity;
  let bestReasoning = `Similarity: ${(similarity * 100).toFixed(1)}%`;
  
  for (const var1 of variations1) {
    for (const var2 of variations2) {
      if (var1 === var2) {
        bestMatch = Math.max(bestMatch, 0.95);
        bestReasoning = 'Name variation match';
        break;
      }
    }
  }
  
  // Check initials match for very short names
  if (normalized1.length <= 3 && normalized2.length <= 3) {
    const initials1 = getInitials(normalized1);
    const initials2 = getInitials(normalized2);
    if (initials1 === initials2 && initials1.length > 1) {
      bestMatch = Math.max(bestMatch, 0.9);
      bestReasoning = 'Initials match for short names';
    }
  }
  
  const isSimilar = bestMatch >= 0.85;
  const confidence = Math.min(bestMatch, 0.95); // Cap confidence at 95% for non-exact matches
  
  return {
    isSimilar,
    confidence,
    reasoning: bestReasoning
  };
}

/**
 * Generate common variations of a name for matching
 */
export function generateNameVariations(name: string): string[] {
  const variations = new Set<string>();
  const normalized = normalizeName(name);
  
  // Add original
  variations.add(normalized);
  
  // Split into parts
  const parts = normalized.split(/\s+/);
  
  // Add variations with different ordering
  if (parts.length === 2) {
    variations.add(`${parts[1]} ${parts[0]}`); // Last First
  }
  
  // Add variations with common abbreviations
  const commonAbbreviations: Record<string, string[]> = {
    'kumar': ['k'],
    'singh': ['s'],
    'sharma': ['sh'],
    'patel': ['p'],
    'gupta': ['g'],
    'verma': ['v'],
    'jain': ['j'],
    'agarwal': ['a'],
    'reddy': ['r'],
    'rao': ['r'],
    'nair': ['n'],
    'iyer': ['i'],
    'iyengar': ['i'],
    'menon': ['m'],
    'pillai': ['p'],
    'nambiar': ['n'],
    'krishnan': ['k'],
    'raman': ['r'],
    'srinivasan': ['s'],
    'subramanian': ['s'],
    'venkatesh': ['v'],
    'ramesh': ['r'],
    'suresh': ['s'],
    'rajesh': ['r'],
    'mahesh': ['m'],
    'prakash': ['p'],
    'anand': ['a'],
    'arun': ['a'],
    'kiran': ['k'],
    'vijay': ['v'],
    'sanjay': ['s'],
    'ajay': ['a'],
    'vivek': ['v'],
    'rohit': ['r'],
    'amit': ['a'],
    'sumit': ['s'],
    'nitin': ['n'],
    'rahul': ['r'],
    'sachin': ['s'],
    'vishal': ['v'],
    'manish': ['m'],
    'sandeep': ['s'],
    'deepak': ['d'],
    'pradeep': ['p'],
    'naveen': ['n'],
    'vinod': ['v']
  };
  
  // Generate variations with abbreviations
  for (const part of parts) {
    if (commonAbbreviations[part]) {
      for (const abbrev of commonAbbreviations[part]) {
        const newParts = [...parts];
        const index = newParts.indexOf(part);
        if (index !== -1) {
          newParts[index] = abbrev;
          variations.add(newParts.join(' '));
        }
      }
    }
  }
  
  return Array.from(variations);
}

/**
 * Extract potential service type from name or business name
 */
export function extractServiceType(nameOrText: string, businessNameOrEmpty?: string): string | null {
  const text = `${nameOrText || ''} ${businessNameOrEmpty || ''}`.toLowerCase();
  
  const serviceTypes: Record<string, string> = {
    'painter': 'painter',
    'painting': 'painter',
    'paint': 'painter',
    'plumber': 'plumber',
    'plumbing': 'plumber',
    'electrician': 'electrician',
    'electrical': 'electrician',
    'electric': 'electrician',
    'carpenter': 'carpenter',
    'carpentry': 'carpenter',
    'mechanic': 'mechanic',
    'automobile': 'mechanic',
    'auto': 'mechanic',
    'repair': 'mechanic',
    'contractor': 'contractor',
    'construction': 'contractor',
    'builder': 'contractor',
    'cleaner': 'cleaner',
    'cleaning': 'cleaner',
    'maid': 'cleaner',
    'driver': 'driver',
    'driving': 'driver',
    'cook': 'cook',
    'cooking': 'cook',
    'chef': 'cook',
    'gardener': 'gardener',
    'gardening': 'gardener',
    'security': 'security',
    'guard': 'security',
    'watchman': 'security',
    'delivery': 'delivery',
    'courier': 'delivery',
    'transport': 'transport',
    'taxi': 'transport',
    'cab': 'transport',
    // Additional common types
    'singer': 'singer',
    'vocalist': 'singer',
    'music': 'singer',
    'musician': 'singer',
    'band': 'singer',
    'hair': 'hair stylist',
    'stylist': 'hair stylist',
    'salon': 'hair stylist',
    'barber': 'hair stylist',
    'property': 'property dealer',
    'realtor': 'property dealer',
    'broker': 'property dealer',
    'estate': 'property dealer',
    'makeup': 'makeup artist',
    'artist': 'makeup artist'
  };
  
  for (const [keyword, type] of Object.entries(serviceTypes)) {
    if (text.includes(keyword)) {
      return type;
    }
  }
  
  return null;
}

/**
 * Validate and clean service data
 */
export function validateServiceData(data: {
  name?: string;
  phone_number?: string;
  email?: string;
  service_type?: string;
  business_name?: string;
}): {
  isValid: boolean;
  errors: string[];
  cleaned: any;
} {
  const errors: string[] = [];
  const cleaned: any = {};
  
  // Validate name
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else {
    cleaned.name = data.name.trim();
  }
  
  // Validate phone number
  if (data.phone_number) {
    const phone = data.phone_number.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) {
      errors.push('Phone number must be between 10 and 15 digits');
    } else {
      cleaned.phone_number = phone;
    }
  }
  
  // Validate email
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Invalid email format');
    } else {
      cleaned.email = data.email.toLowerCase().trim();
    }
  }
  
  // At least one identifier required
  if (!cleaned.phone_number && !cleaned.email) {
    errors.push('Either phone number or email must be provided');
  }
  
  // Clean other fields
  if (data.service_type) {
    cleaned.service_type = data.service_type.trim();
  }
  if (data.business_name) {
    cleaned.business_name = data.business_name.trim();
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    cleaned
  };
}
