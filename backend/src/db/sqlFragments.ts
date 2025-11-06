/**
 * Shared SQL fragments for feed queries to reduce duplication
 * and improve maintainability
 */

export const COMMON_FEED_COLUMNS = `
  r.id as recommendation_id,
  r.user_id,
  r.content_type,
  r.title,
  r.description,
  r.content_data,
  r.rating,
  r.visibility,
  r.labels,
  r.metadata,
  r.created_at,
  r.updated_at,
  p.id as place_id,
  p.name as place_name, 
  p.address as place_address, 
  p.lat as place_lat, 
  p.lng as place_lng, 
  p.google_place_id,
  p.primary_type as place_primary_type,
  p.city_slug as place_city_slug,
  p.country_code as place_country_code,
  s.city_slug as service_city_slug,
  s.country_code as service_country_code,
  u.display_name as user_name, 
  u.profile_picture_url as user_picture,
  COALESCE(acagg.comments_count, 0) as comments_count,
  COALESCE(alagg.likes_count, 0) as likes_count,
  CASE WHEN al2.id IS NOT NULL THEN true ELSE false END as is_liked_by_current_user,
  CASE WHEN sp.id IS NOT NULL THEN true ELSE false END as is_saved
`;

export const COMMON_FEED_JOINS = `
  FROM recommendations r
  JOIN users u ON r.user_id = u.id
  LEFT JOIN places p ON r.place_id = p.id
  LEFT JOIN services s ON r.service_id = s.id
  LEFT JOIN (
    SELECT recommendation_id, COUNT(*) AS comments_count
    FROM annotation_comments
    GROUP BY recommendation_id
  ) acagg ON acagg.recommendation_id = r.id
  LEFT JOIN (
    SELECT recommendation_id, COUNT(*) AS likes_count
    FROM annotation_likes
    GROUP BY recommendation_id
  ) alagg ON alagg.recommendation_id = r.id
  LEFT JOIN annotation_likes al2 ON r.id = al2.recommendation_id AND al2.user_id = $1
  LEFT JOIN saved_places sp ON r.id = sp.recommendation_id AND sp.user_id = $1
`;

export const USER_FOLLOWS_WHERE_CLAUSE = `
  WHERE r.user_id IN (
    SELECT following_id FROM user_follows WHERE follower_id = $1
    UNION
    SELECT $1  -- Include user's own recommendations
  )
`;

export const VISIBILITY_WHERE_CLAUSE = `
  AND r.visibility IN ('public', 'friends')
`;

export const BLOCK_FILTER_WHERE_CLAUSE = `
  AND NOT EXISTS (
    SELECT 1 FROM user_blocks 
    WHERE (blocker_id = $1 AND blocked_id = r.user_id) 
    OR (blocker_id = r.user_id AND blocked_id = $1)
  )
`;

export const ORDER_BY_CLAUSE = `
  ORDER BY r.created_at DESC
`;

/**
 * Build a complete feed query with common fragments
 */
export function buildFeedQuery(
  additionalWhereClause: string = '',
  additionalJoins: string = '',
  limit: number = 20
): string {
  return `
    SELECT ${COMMON_FEED_COLUMNS}
    ${COMMON_FEED_JOINS}
    ${additionalJoins}
    ${USER_FOLLOWS_WHERE_CLAUSE}
    ${VISIBILITY_WHERE_CLAUSE}
    ${BLOCK_FILTER_WHERE_CLAUSE}
    ${additionalWhereClause}
    ${ORDER_BY_CLAUSE}
    LIMIT $${getParamCount(additionalWhereClause, additionalJoins) + 2}
  `;
}

/**
 * Count parameters in additional clauses to determine the correct parameter index
 */
function getParamCount(additionalWhereClause: string, additionalJoins: string): number {
  let count = 1; // Base user_id parameter
  const allClauses = additionalWhereClause + additionalJoins;
  
  // Count $ parameters in the additional clauses
  const matches = allClauses.match(/\$\d+/g);
  if (matches) {
    const maxParam = Math.max(...matches.map(m => parseInt(m.substring(1))));
    count = Math.max(count, maxParam);
  }
  
  return count;
}




