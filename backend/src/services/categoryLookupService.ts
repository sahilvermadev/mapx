/**
 * Category Lookup Service
 * 
 * Provides intelligent matching of service types to category IDs using
 * semantic embeddings, fuzzy matching, and database lookups.
 */

import { getAllCategories, getCategoryBySlug, type ServiceCategory } from '../db/serviceCategories';
import { calculateSimilarity } from '../utils/nameSimilarity';
import { generateEmbedding, calculateCosineSimilarity } from '../utils/embeddings';

export interface CategoryMatch {
  category_id: number;
  category_slug: string;
  category_name: string;
  confidence: number;
  match_type: 'exact_slug' | 'fuzzy_slug' | 'name_match' | 'synonym' | 'partial' | 'semantic';
}

/**
 * Category embedding with cached vector representation
 */
interface CategoryEmbedding {
  category_id: number;
  category_slug: string;
  category_name: string;
  embedding: number[]; // 1536-dimensional vector
  embedding_text: string; // Combined name + slug for context
}

/**
 * Minimal synonym mappings for critical edge cases
 * Most matching is now handled by semantic embeddings, but we keep a few
 * critical synonyms for cases where embeddings might struggle (e.g., abbreviations)
 */
const SYNONYMS: Record<string, string[]> = {
  // Critical abbreviations that embeddings might not catch
  'ca': ['ca'],
  'ent': ['ent'],
  'vet': ['vet'],
  
  // Common variations that might have low semantic similarity
  'attorney': ['lawyer'], // "attorney" vs "lawyer" - semantic should handle, but keep as fallback
};

/**
 * Cache for categories to avoid repeated database queries
 */
let categoriesCache: ServiceCategory[] | null = null;
let categoriesCacheTime: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache for category embeddings to avoid regenerating them
 */
let categoryEmbeddingsCache: CategoryEmbedding[] | null = null;
let categoryEmbeddingsCacheTime: number = 0;
const CATEGORY_EMBEDDINGS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get all categories with caching
 */
async function getAllCategoriesCached(): Promise<ServiceCategory[]> {
  const now = Date.now();
  if (categoriesCache && (now - categoriesCacheTime) < CACHE_TTL_MS) {
    return categoriesCache;
  }
  
  categoriesCache = await getAllCategories();
  categoriesCacheTime = now;
  return categoriesCache;
}

/**
 * Generate embeddings for all categories
 */
async function generateCategoryEmbeddings(): Promise<CategoryEmbedding[]> {
  console.log('   🔍 [CATEGORY_EMBEDDINGS] Generating embeddings for all categories...');
  const categories = await getAllCategoriesCached();
  const embeddings: CategoryEmbedding[] = [];
  
  // Generate embeddings in parallel for better performance
  const embeddingPromises = categories.map(async (category) => {
    // Create rich text representation: "Category Name (slug)"
    // e.g., "Divorce Lawyer (Fast Settlement) (divorce-lawyer)"
    const embeddingText = `${category.name} (${category.slug})`;
    const embedding = await generateEmbedding(embeddingText);
    
    return {
      category_id: category.id,
      category_slug: category.slug,
      category_name: category.name,
      embedding,
      embedding_text: embeddingText
    };
  });
  
  const results = await Promise.all(embeddingPromises);
  console.log(`   ✅ [CATEGORY_EMBEDDINGS] Generated ${results.length} category embeddings`);
  
  return results;
}

/**
 * Get cached category embeddings, generating if needed
 */
async function getCategoryEmbeddings(): Promise<CategoryEmbedding[]> {
  const now = Date.now();
  
  // Check if cache is valid
  if (categoryEmbeddingsCache && (now - categoryEmbeddingsCacheTime) < CATEGORY_EMBEDDINGS_CACHE_TTL_MS) {
    console.log(`   🔍 [CATEGORY_EMBEDDINGS] Using cached embeddings (${categoryEmbeddingsCache.length} categories)`);
    return categoryEmbeddingsCache;
  }
  
  // Generate new embeddings
  console.log('   🔍 [CATEGORY_EMBEDDINGS] Cache expired or missing, generating new embeddings...');
  categoryEmbeddingsCache = await generateCategoryEmbeddings();
  categoryEmbeddingsCacheTime = now;
  
  return categoryEmbeddingsCache;
}

/**
 * Invalidate category embeddings cache
 * Call this when categories are created/updated
 */
export function invalidateCategoryEmbeddingsCache(): void {
  console.log('   🔄 [CATEGORY_EMBEDDINGS] Invalidating category embeddings cache');
  categoryEmbeddingsCache = null;
  categoryEmbeddingsCacheTime = 0;
}

/**
 * Normalize service type for matching
 */
function normalizeServiceType(serviceType: string): string {
  return serviceType.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if service type matches a category slug exactly
 */
function matchExactSlug(serviceType: string, category: ServiceCategory): number | null {
  const normalized = normalizeServiceType(serviceType);
  if (normalized === category.slug.toLowerCase()) {
    return 1.0;
  }
  return null;
}

/**
 * Check fuzzy match against slug
 */
function matchFuzzySlug(serviceType: string, category: ServiceCategory): number | null {
  const normalized = normalizeServiceType(serviceType);
  const slugLower = category.slug.toLowerCase();
  
  // Check if slug contains the service type or vice versa
  if (slugLower.includes(normalized) || normalized.includes(slugLower)) {
    const similarity = calculateSimilarity(normalized, slugLower);
    if (similarity >= 0.7) {
      return similarity;
    }
  }
  
  // Direct fuzzy similarity
  const similarity = calculateSimilarity(normalized, slugLower);
  if (similarity >= 0.7) {
    return similarity;
  }
  
  return null;
}

/**
 * Check match against category name
 */
function matchName(serviceType: string, category: ServiceCategory): number | null {
  const normalized = normalizeServiceType(serviceType);
  const nameLower = category.name.toLowerCase();
  
  // Check if name contains the service type or vice versa
  if (nameLower.includes(normalized) || normalized.includes(nameLower)) {
    const similarity = calculateSimilarity(normalized, nameLower);
    if (similarity >= 0.6) {
      return similarity;
    }
  }
  
  // Direct fuzzy similarity
  const similarity = calculateSimilarity(normalized, nameLower);
  if (similarity >= 0.6) {
    return similarity;
  }
  
  return null;
}

/**
 * Check synonym matches
 */
function matchSynonyms(serviceType: string): string[] {
  const normalized = normalizeServiceType(serviceType);
  
  // Direct synonym lookup
  if (SYNONYMS[normalized]) {
    return SYNONYMS[normalized];
  }
  
  // Check partial matches in synonyms
  const matches: string[] = [];
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      matches.push(...values);
    }
  }
  
  return matches;
}

/**
 * Check partial matches (e.g., "physics tutor" -> "science-tutor")
 */
function matchPartial(serviceType: string, category: ServiceCategory): number | null {
  const normalized = normalizeServiceType(serviceType);
  const slugLower = category.slug.toLowerCase();
  const nameLower = category.name.toLowerCase();
  
  // Split service type into words
  const words = normalized.split(/\s+/);
  
  // Check if any word matches slug or name
  for (const word of words) {
    if (word.length >= 4) { // Only check words with 4+ characters
      if (slugLower.includes(word) || nameLower.includes(word)) {
        return 0.6; // Lower confidence for partial matches
      }
    }
  }
  
  return null;
}

/**
 * Get fuzzy matches using existing string matching logic
 */
function getFuzzyMatches(serviceType: string, categories: ServiceCategory[]): CategoryMatch[] {
  const matches: CategoryMatch[] = [];
  const normalized = normalizeServiceType(serviceType);
  
  // Check synonyms first
  const synonymSlugs = matchSynonyms(serviceType);
  const synonymSet = new Set(synonymSlugs);
  
  for (const category of categories) {
    let bestMatch: { confidence: number; match_type: CategoryMatch['match_type'] } | null = null;
    
    // 1. Exact slug match
    const exactMatch = matchExactSlug(serviceType, category);
    if (exactMatch !== null) {
      bestMatch = { confidence: exactMatch, match_type: 'exact_slug' };
    }
    
    // 2. Synonym match
    if (!bestMatch && synonymSet.has(category.slug)) {
      bestMatch = { confidence: 0.9, match_type: 'synonym' };
    }
    
    // 3. Fuzzy slug match
    if (!bestMatch) {
      const fuzzyMatch = matchFuzzySlug(serviceType, category);
      if (fuzzyMatch !== null) {
        bestMatch = { confidence: fuzzyMatch, match_type: 'fuzzy_slug' };
      }
    }
    
    // 4. Name match
    if (!bestMatch) {
      const nameMatch = matchName(serviceType, category);
      if (nameMatch !== null) {
        bestMatch = { confidence: nameMatch, match_type: 'name_match' };
      }
    }
    
    // 5. Partial match
    if (!bestMatch) {
      const partialMatch = matchPartial(serviceType, category);
      if (partialMatch !== null) {
        bestMatch = { confidence: partialMatch, match_type: 'partial' };
      }
    }
    
    if (bestMatch) {
      matches.push({
        category_id: category.id,
        category_slug: category.slug,
        category_name: category.name,
        confidence: bestMatch.confidence,
        match_type: bestMatch.match_type
      });
    }
  }
  
  return matches;
}

/**
 * Combine semantic and fuzzy matches intelligently
 */
function combineMatches(
  semanticMatches: CategoryMatch[],
  fuzzyMatches: CategoryMatch[]
): CategoryMatch[] {
  const matchMap = new Map<number, CategoryMatch>();
  
  // Add semantic matches
  for (const match of semanticMatches) {
    matchMap.set(match.category_id, match);
  }
  
  // Merge fuzzy matches, boosting confidence if semantic match exists
  for (const fuzzyMatch of fuzzyMatches) {
    const existing = matchMap.get(fuzzyMatch.category_id);
    
    if (existing) {
      // Boost confidence: weighted average favoring semantic match
      // Semantic matches are generally more reliable, so weight them higher
      existing.confidence = Math.max(
        existing.confidence,
        (existing.confidence * 0.6) + (fuzzyMatch.confidence * 0.4)
      );
      // Prefer more specific match type (exact > synonym > semantic > fuzzy)
      if (fuzzyMatch.match_type === 'exact_slug' || fuzzyMatch.match_type === 'synonym') {
        existing.match_type = fuzzyMatch.match_type;
      }
    } else {
      matchMap.set(fuzzyMatch.category_id, fuzzyMatch);
    }
  }
  
  return Array.from(matchMap.values());
}

/**
 * Look up service category by service type using semantic embeddings and fuzzy matching
 * 
 * @param serviceType - The service type to look up (e.g., "architect", "physics tutor", "divorce lawyer")
 * @returns Array of category matches sorted by confidence (highest first)
 */
export async function lookupCategory(serviceType: string): Promise<CategoryMatch[]> {
  if (!serviceType || serviceType.trim().length === 0) {
    return [];
  }
  
  console.log(`   🔍 [CATEGORY_LOOKUP] Looking up category for service type: "${serviceType}"`);
  
  // 1. Get cached category embeddings (or generate if needed)
  const categoryEmbeddings = await getCategoryEmbeddings();
  const categories = await getAllCategoriesCached();
  
  // 2. Generate embedding for user query
  console.log(`   🔍 [CATEGORY_LOOKUP] Generating embedding for query: "${serviceType}"`);
  const queryEmbedding = await generateEmbedding(serviceType);
  
  // 3. Calculate semantic similarity for each category
  const semanticMatches: CategoryMatch[] = [];
  const SEMANTIC_THRESHOLD = 0.6; // Minimum similarity to consider
  
  for (const catEmbedding of categoryEmbeddings) {
    const semanticScore = calculateCosineSimilarity(queryEmbedding, catEmbedding.embedding);
    
    // Only consider matches with semantic similarity >= threshold
    if (semanticScore >= SEMANTIC_THRESHOLD) {
      semanticMatches.push({
        category_id: catEmbedding.category_id,
        category_slug: catEmbedding.category_slug,
        category_name: catEmbedding.category_name,
        confidence: semanticScore,
        match_type: 'semantic'
      });
    }
  }
  
  console.log(`   🔍 [CATEGORY_LOOKUP] Found ${semanticMatches.length} semantic matches (threshold: ${SEMANTIC_THRESHOLD})`);
  if (semanticMatches.length > 0) {
    const topSemantic = semanticMatches.slice(0, 3);
    topSemantic.forEach((match, idx) => {
      console.log(`      Semantic ${idx + 1}. ${match.category_name} (confidence: ${match.confidence.toFixed(3)})`);
    });
  }
  
  // 4. Apply fuzzy string matching (keep existing logic for exact/slug matches)
  const fuzzyMatches = getFuzzyMatches(serviceType, categories);
  
  if (fuzzyMatches.length > 0) {
    console.log(`   🔍 [CATEGORY_LOOKUP] Found ${fuzzyMatches.length} fuzzy matches`);
    const topFuzzy = fuzzyMatches.slice(0, 3);
    topFuzzy.forEach((match, idx) => {
      console.log(`      Fuzzy ${idx + 1}. ${match.category_name} (confidence: ${match.confidence.toFixed(2)}, type: ${match.match_type})`);
    });
  }
  
  // 5. Combine and deduplicate matches
  const combinedMatches = combineMatches(semanticMatches, fuzzyMatches);
  
  // 6. Sort by confidence (highest first), then by match type priority
  const matchTypePriority: Record<CategoryMatch['match_type'], number> = {
    'exact_slug': 6,
    'synonym': 5,
    'semantic': 4,
    'fuzzy_slug': 3,
    'name_match': 2,
    'partial': 1
  };
  
  combinedMatches.sort((a, b) => {
    if (Math.abs(a.confidence - b.confidence) < 0.01) {
      // If confidence is very close, prefer higher priority match type
      return matchTypePriority[b.match_type] - matchTypePriority[a.match_type];
    }
    return b.confidence - a.confidence;
  });
  
  // Return top 5 matches
  const topMatches = combinedMatches.slice(0, 5);
  
  console.log(`   🔍 [CATEGORY_LOOKUP] Combined ${semanticMatches.length} semantic + ${fuzzyMatches.length} fuzzy = ${combinedMatches.length} total matches, returning top ${topMatches.length}:`);
  topMatches.forEach((match, idx) => {
    console.log(`      ${idx + 1}. ${match.category_name} (ID: ${match.category_id}, slug: ${match.category_slug}, confidence: ${match.confidence.toFixed(3)}, type: ${match.match_type})`);
  });
  
  return topMatches;
}


