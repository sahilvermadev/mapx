import pool from '../db';

export interface ServiceTag {
  id: number;
  service_id: number;
  recommendation_id?: number;
  tag: string;
  frequency: number;
  created_at: Date;
}

export interface ServiceTagInput {
  service_id: number;
  recommendation_id?: number;
  tag: string;
}

/**
 * Add or increment a tag for a service
 */
export async function upsertServiceTag(data: ServiceTagInput): Promise<void> {
  await pool.query(
    `INSERT INTO service_tags (service_id, recommendation_id, tag, frequency)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (service_id, tag) 
     DO UPDATE SET 
       frequency = service_tags.frequency + 1,
       recommendation_id = COALESCE(EXCLUDED.recommendation_id, service_tags.recommendation_id)`,
    [data.service_id, data.recommendation_id || null, data.tag]
  );
}

/**
 * Add multiple tags for a service
 */
export async function addServiceTags(
  serviceId: number,
  tags: string[],
  recommendationId?: number
): Promise<void> {
  if (tags.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const tag of tags) {
      await client.query(
        `INSERT INTO service_tags (service_id, recommendation_id, tag, frequency)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (service_id, tag) 
         DO UPDATE SET 
           frequency = service_tags.frequency + 1,
           recommendation_id = COALESCE(EXCLUDED.recommendation_id, service_tags.recommendation_id)`,
        [serviceId, recommendationId || null, tag]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get all tags for a service
 */
export async function getServiceTags(serviceId: number): Promise<ServiceTag[]> {
  const result = await pool.query(
    `SELECT * FROM service_tags
     WHERE service_id = $1
     ORDER BY frequency DESC, tag ASC`,
    [serviceId]
  );
  return result.rows;
}

/**
 * Get tags for a recommendation
 */
export async function getRecommendationTags(recommendationId: number): Promise<ServiceTag[]> {
  const result = await pool.query(
    `SELECT * FROM service_tags
     WHERE recommendation_id = $1
     ORDER BY frequency DESC, tag ASC`,
    [recommendationId]
  );
  return result.rows;
}

/**
 * Remove a tag from a service
 */
export async function removeServiceTag(serviceId: number, tag: string): Promise<void> {
  await pool.query(
    'DELETE FROM service_tags WHERE service_id = $1 AND tag = $2',
    [serviceId, tag]
  );
}

/**
 * Get most common tags across all services (for suggestions)
 */
export async function getCommonTags(limit: number = 50): Promise<Array<{ tag: string; total_frequency: number }>> {
  const result = await pool.query(
    `SELECT tag, SUM(frequency) as total_frequency
     FROM service_tags
     GROUP BY tag
     ORDER BY total_frequency DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Search tags by prefix
 */
export async function searchTags(prefix: string, limit: number = 20): Promise<string[]> {
  const result = await pool.query(
    `SELECT DISTINCT tag
     FROM service_tags
     WHERE tag ILIKE $1
     ORDER BY tag ASC
     LIMIT $2`,
    [`${prefix}%`, limit]
  );
  return result.rows.map(row => row.tag);
}








