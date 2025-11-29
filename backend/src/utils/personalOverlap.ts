/**
 * Calculate personal overlap between two users
 * 
 * Personal overlap is the percentage of shared places/connections between
 * the current user and the recommendation author. This helps surface
 * recommendations from people with similar tastes.
 */

import pool from '../db';

/**
 * Calculate personal overlap percentage between two users
 * 
 * @param currentUserId - The user performing the search
 * @param reviewerUserId - The user who created the recommendation
 * @returns Percentage (0-100) of shared places/connections
 */
export async function calculatePersonalOverlap(
  currentUserId: string,
  reviewerUserId: string
): Promise<number> {
  if (currentUserId === reviewerUserId) {
    return 100; // Same user = 100% overlap
  }

  try {
    // Calculate shared places (places both users have recommended)
    const sharedPlacesResult = await pool.query(
      `SELECT COUNT(DISTINCT r1.place_id) as shared_places
       FROM recommendations r1
       INNER JOIN recommendations r2 ON r1.place_id = r2.place_id
       WHERE r1.user_id = $1
         AND r2.user_id = $2
         AND r1.place_id IS NOT NULL
         AND r1.visibility IN ('friends', 'public')
         AND r2.visibility IN ('friends', 'public')`,
      [currentUserId, reviewerUserId]
    );

    // Calculate mutual connections (users both follow)
    const mutualConnectionsResult = await pool.query(
      `SELECT COUNT(DISTINCT uf1.following_id) as mutual_connections
       FROM user_follows uf1
       INNER JOIN user_follows uf2 ON uf1.following_id = uf2.following_id
       WHERE uf1.follower_id = $1
         AND uf2.follower_id = $2`,
      [currentUserId, reviewerUserId]
    );

    const sharedPlaces = parseInt(sharedPlacesResult.rows[0]?.shared_places || '0');
    const mutualConnections = parseInt(mutualConnectionsResult.rows[0]?.mutual_connections || '0');

    // Get total unique places for current user (for normalization)
    const currentUserPlacesResult = await pool.query(
      `SELECT COUNT(DISTINCT place_id) as total_places
       FROM recommendations
       WHERE user_id = $1
         AND place_id IS NOT NULL
         AND visibility IN ('friends', 'public')`,
      [currentUserId]
    );

    const totalPlaces = parseInt(currentUserPlacesResult.rows[0]?.total_places || '0');

    // Calculate overlap: weighted combination of shared places and mutual connections
    // Shared places weight: 70%, Mutual connections weight: 30%
    let overlap = 0;

    if (totalPlaces > 0) {
      const placesOverlap = (sharedPlaces / totalPlaces) * 100;
      overlap += placesOverlap * 0.7;
    }

    // Mutual connections boost (capped at 30%)
    const connectionsBoost = Math.min(30, mutualConnections * 5); // 5% per mutual connection, max 30%
    overlap += connectionsBoost * 0.3;

    return Math.min(100, Math.round(overlap));
  } catch (error) {
    console.error('Error calculating personal overlap:', error);
    return 0; // Default to 0% on error
  }
}

/**
 * Batch calculate personal overlap for multiple reviewer users
 * This eliminates N+1 query problem by calculating all overlaps in a single query
 * 
 * @param currentUserId - The user performing the search
 * @param reviewerUserIds - Array of user IDs who created recommendations
 * @returns Map of reviewerUserId -> overlap percentage (0-100)
 */
export async function calculatePersonalOverlapBatch(
  currentUserId: string,
  reviewerUserIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  
  // Handle empty input
  if (reviewerUserIds.length === 0) {
    return result;
  }

  // Handle same user case
  reviewerUserIds.forEach(id => {
    if (id === currentUserId) {
      result.set(id, 100);
    }
  });

  // Filter out same user IDs for batch query
  const uniqueReviewerIds = [...new Set(reviewerUserIds.filter(id => id !== currentUserId))];
  
  if (uniqueReviewerIds.length === 0) {
    return result;
  }

  try {
    // Get total unique places for current user (for normalization) - single query
    const currentUserPlacesResult = await pool.query(
      `SELECT COUNT(DISTINCT place_id) as total_places
       FROM recommendations
       WHERE user_id = $1
         AND place_id IS NOT NULL
         AND visibility IN ('friends', 'public')`,
      [currentUserId]
    );
    const totalPlaces = parseInt(currentUserPlacesResult.rows[0]?.total_places || '0');

    // Batch calculate shared places for all reviewer users - single query
    const sharedPlacesResult = await pool.query(
      `SELECT 
         r2.user_id as reviewer_id,
         COUNT(DISTINCT r1.place_id) as shared_places
       FROM recommendations r1
       INNER JOIN recommendations r2 ON r1.place_id = r2.place_id
       WHERE r1.user_id = $1
         AND r2.user_id = ANY($2::text[])
         AND r1.place_id IS NOT NULL
         AND r1.visibility IN ('friends', 'public')
         AND r2.visibility IN ('friends', 'public')
       GROUP BY r2.user_id`,
      [currentUserId, uniqueReviewerIds]
    );

    // Batch calculate mutual connections for all reviewer users - single query
    const mutualConnectionsResult = await pool.query(
      `SELECT 
         uf2.follower_id as reviewer_id,
         COUNT(DISTINCT uf1.following_id) as mutual_connections
       FROM user_follows uf1
       INNER JOIN user_follows uf2 ON uf1.following_id = uf2.following_id
       WHERE uf1.follower_id = $1
         AND uf2.follower_id = ANY($2::text[])
       GROUP BY uf2.follower_id`,
      [currentUserId, uniqueReviewerIds]
    );

    // Build maps for quick lookup
    const sharedPlacesMap = new Map<string, number>();
    sharedPlacesResult.rows.forEach(row => {
      sharedPlacesMap.set(row.reviewer_id, parseInt(row.shared_places || '0'));
    });

    const mutualConnectionsMap = new Map<string, number>();
    mutualConnectionsResult.rows.forEach(row => {
      mutualConnectionsMap.set(row.reviewer_id, parseInt(row.mutual_connections || '0'));
    });

    // Calculate overlap for each reviewer
    uniqueReviewerIds.forEach(reviewerId => {
      const sharedPlaces = sharedPlacesMap.get(reviewerId) || 0;
      const mutualConnections = mutualConnectionsMap.get(reviewerId) || 0;

      // Calculate overlap: weighted combination of shared places and mutual connections
      // Shared places weight: 70%, Mutual connections weight: 30%
      let overlap = 0;

      if (totalPlaces > 0) {
        const placesOverlap = (sharedPlaces / totalPlaces) * 100;
        overlap += placesOverlap * 0.7;
      }

      // Mutual connections boost (capped at 30%)
      const connectionsBoost = Math.min(30, mutualConnections * 5); // 5% per mutual connection, max 30%
      overlap += connectionsBoost * 0.3;

      result.set(reviewerId, Math.min(100, Math.round(overlap)));
    });

    // Set default 0% for any reviewer IDs not found in queries
    uniqueReviewerIds.forEach(id => {
      if (!result.has(id)) {
        result.set(id, 0);
      }
    });

    return result;
  } catch (error) {
    console.error('Error calculating personal overlap batch:', error);
    // Return 0% for all on error
    uniqueReviewerIds.forEach(id => {
      result.set(id, 0);
    });
    return result;
  }
}



