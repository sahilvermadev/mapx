/* eslint-disable camelcase */

/**
 * Legacy migration placeholder.
 *
 * The original implementation created feed performance indexes:
 * - annotation_comments(recommendation_id, created_at)
 * - annotation_likes(recommendation_id, created_at)
 * - user_follows(follower_id, created_at)
 * - user_blocks(blocker_id, blocked_id)
 * - recommendations(user_id, visibility, created_at)
 * - recommendations(user_id, question_id, visibility, created_at WHERE question_id IS NOT NULL)
 * - questions(user_id, visibility, created_at)
 *
 * These indexes are now defined (with IF NOT EXISTS) in
 * `1766000000000_consolidated_schema_and_indexes.js`.
 *
 * We keep this file as a no-op so that node-pg-migrate sees the
 * historical migration that has already been applied in production,
 * avoiding ordering / "not run migration is preceding already run" errors.
 */

exports.shorthands = undefined;

exports.up = pgm => {
  // No-op: indexes have been consolidated into 1766000000000_consolidated_schema_and_indexes
};

exports.down = pgm => {
  // No-op: dropping is handled by 1766000000000_consolidated_schema_and_indexes
};


