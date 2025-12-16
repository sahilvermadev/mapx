import pool from '../db';

export interface ServiceRecommendationDetails {
  id: number;
  recommendation_id: number;
  service_id: number;
  // Core trust fields
  rating?: number;
  price_range?: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹';
  exact_price?: string;
  // LLM-optimized fields
  experience_summary: string;
  verbatim_quote?: string;
  // Context tags
  context_tags: string[];
  // Full-text search
  search_vector?: any;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceRecommendationDetailsInput {
  recommendation_id: number;
  service_id: number;
  rating?: number;
  price_range?: '₹' | '₹₹' | '₹₹₹' | '₹₹₹₹';
  exact_price?: string;
  experience_summary: string;
  verbatim_quote?: string;
  context_tags?: string[];
  photo_urls?: string[];
  has_proof?: boolean;
}

/**
 * Create service recommendation details
 */
export async function createServiceRecommendationDetails(
  data: ServiceRecommendationDetailsInput
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO service_recommendation_details (
      recommendation_id, service_id, rating, price_range, exact_price,
      experience_summary, verbatim_quote, context_tags
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
    RETURNING id`,
    [
      data.recommendation_id,
      data.service_id,
      data.rating || null,
      data.price_range || null,
      data.exact_price || null,
      data.experience_summary,
      data.verbatim_quote || null,
      data.context_tags || [],
    ]
  );
  return result.rows[0].id;
}

/**
 * Get service recommendation details by recommendation ID
 */
export async function getServiceRecommendationDetailsByRecommendationId(
  recommendationId: number
): Promise<ServiceRecommendationDetails | null> {
  const result = await pool.query(
    'SELECT * FROM service_recommendation_details WHERE recommendation_id = $1',
    [recommendationId]
  );
  return result.rows[0] || null;
}

/**
 * Get service recommendation details by ID
 */
export async function getServiceRecommendationDetailsById(
  id: number
): Promise<ServiceRecommendationDetails | null> {
  const result = await pool.query(
    'SELECT * FROM service_recommendation_details WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get all recommendation details for a service
 */
export async function getServiceRecommendationDetailsForService(
  serviceId: number,
  limit: number = 50,
  offset: number = 0
): Promise<ServiceRecommendationDetails[]> {
  const result = await pool.query(
    `SELECT * FROM service_recommendation_details
     WHERE service_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [serviceId, limit, offset]
  );
  return result.rows;
}

/**
 * Update service recommendation details
 */
export async function updateServiceRecommendationDetails(
  recommendationId: number,
  updates: Partial<ServiceRecommendationDetailsInput>
): Promise<boolean> {
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.rating !== undefined) {
    updateFields.push(`rating = $${paramCount++}`);
    values.push(updates.rating);
  }
  if (updates.price_range !== undefined) {
    updateFields.push(`price_range = $${paramCount++}`);
    values.push(updates.price_range);
  }
  if (updates.exact_price !== undefined) {
    updateFields.push(`exact_price = $${paramCount++}`);
    values.push(updates.exact_price);
  }
  if (updates.experience_summary !== undefined) {
    updateFields.push(`experience_summary = $${paramCount++}`);
    values.push(updates.experience_summary);
  }
  if (updates.verbatim_quote !== undefined) {
    updateFields.push(`verbatim_quote = $${paramCount++}`);
    values.push(updates.verbatim_quote);
  }
  if (updates.context_tags !== undefined) {
    updateFields.push(`context_tags = $${paramCount++}`);
    values.push(updates.context_tags);
  }

  if (updateFields.length === 0) {
    return false;
  }

  values.push(recommendationId);

  const updateQuery = `
    UPDATE service_recommendation_details
    SET ${updateFields.join(', ')}
    WHERE recommendation_id = $${paramCount}
    RETURNING id
  `;

  const result = await pool.query(updateQuery, values);
  return result.rows.length > 0;
}

/**
 * Calculate aggregate statistics for a service
 */
export async function calculateServiceAggregates(serviceId: number): Promise<{
  rating_average: number | null;
  rating_count: number;
  common_tags: string[];
}> {
  // Calculate average rating and count
  const ratingResult = await pool.query(
    `SELECT 
       AVG(rating)::NUMERIC(3, 2) as rating_average,
       COUNT(*) as rating_count
     FROM service_recommendation_details
     WHERE service_id = $1 AND rating IS NOT NULL`,
    [serviceId]
  );

  const rating_average = ratingResult.rows[0]?.rating_average
    ? parseFloat(ratingResult.rows[0].rating_average)
    : null;
  const rating_count = parseInt(ratingResult.rows[0]?.rating_count || '0', 10);

  // Calculate most common tags (top 10)
  const tagsResult = await pool.query(
    `SELECT tag, SUM(frequency) as total_frequency
     FROM service_tags
     WHERE service_id = $1
     GROUP BY tag
     ORDER BY total_frequency DESC
     LIMIT 10`,
    [serviceId]
  );

  const common_tags = tagsResult.rows.map(row => row.tag);

  return {
    rating_average,
    rating_count,
    common_tags,
  };
}


