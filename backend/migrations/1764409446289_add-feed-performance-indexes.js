/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Composite index for annotation_comments - optimized for filtered aggregations
  pgm.createIndex('annotation_comments', ['recommendation_id', 'created_at'], {
    name: 'idx_annotation_comments_rec_id_created_at'
  });

  // Composite index for annotation_likes - optimized for filtered aggregations
  pgm.createIndex('annotation_likes', ['recommendation_id', 'created_at'], {
    name: 'idx_annotation_likes_rec_id_created_at'
  });

  // Composite index for user_follows - optimized for feed user filtering
  pgm.createIndex('user_follows', ['follower_id', 'created_at'], {
    name: 'idx_user_follows_follower_created_at'
  });

  // Composite index for user_blocks - optimized for block checks
  // This is a partial index since we only need to check when blocker_id or blocked_id matches
  pgm.createIndex('user_blocks', ['blocker_id', 'blocked_id'], {
    name: 'idx_user_blocks_blocker_blocked'
  });

  // Composite index for recommendations - optimized for feed queries
  // This covers the common pattern: user_id + visibility + created_at
  pgm.createIndex('recommendations', ['user_id', 'visibility', 'created_at'], {
    name: 'idx_recommendations_user_visibility_created'
  });

  // Additional composite index for recommendations with question_id filter
  // This helps with the answers subquery
  pgm.createIndex('recommendations', ['user_id', 'question_id', 'visibility', 'created_at'], {
    name: 'idx_recommendations_user_question_visibility_created',
    where: 'question_id IS NOT NULL'
  });

  // Composite index for questions - optimized for feed queries
  pgm.createIndex('questions', ['user_id', 'visibility', 'created_at'], {
    name: 'idx_questions_user_visibility_created'
  });
};

exports.down = pgm => {
  // Drop indexes in reverse order
  pgm.dropIndex('questions', 'idx_questions_user_visibility_created');
  pgm.dropIndex('recommendations', 'idx_recommendations_user_question_visibility_created');
  pgm.dropIndex('recommendations', 'idx_recommendations_user_visibility_created');
  pgm.dropIndex('user_blocks', 'idx_user_blocks_blocker_blocked');
  pgm.dropIndex('user_follows', 'idx_user_follows_follower_created_at');
  pgm.dropIndex('annotation_likes', 'idx_annotation_likes_rec_id_created_at');
  pgm.dropIndex('annotation_comments', 'idx_annotation_comments_rec_id_created_at');
};

