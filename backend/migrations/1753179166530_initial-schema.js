/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Enable extensions (requires superuser or appropriate DB privileges)
  pgm.sql('CREATE EXTENSION IF NOT EXISTS postgis;');
  pgm.sql('CREATE EXTENSION IF NOT EXISTS vector;');  // pgvector

  // Table: users (keeping existing)
  pgm.createTable('users', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    google_id: {
      type: 'VARCHAR(255)',
      notNull: true,
      unique: true,
    },
    email: {
      type: 'VARCHAR(255)',
      notNull: true,
      unique: true,
    },
    display_name: {
      type: 'VARCHAR(255)',
    },
    profile_picture_url: {
      type: 'TEXT',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    last_login_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  pgm.createIndex('users', 'google_id', { ifNotExists: true });

  // Table: categories
  pgm.createTable('categories', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    name: {
      type: 'TEXT',
      notNull: true,
      unique: true,
    },
    description: {
      type: 'TEXT',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: places
  pgm.createTable('places', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    google_place_id: {
      type: 'TEXT',
      unique: true,
    },
    name: {
      type: 'TEXT',
      notNull: true,
    },
    address: {
      type: 'TEXT',
    },
    category_id: {
      type: 'INT',
      references: 'categories(id)',
      onDelete: 'SET NULL',
    },
    lat: {
      type: 'DOUBLE PRECISION',
    },
    lng: {
      type: 'DOUBLE PRECISION',
    },
    geom: {
      type: 'GEOGRAPHY(Point,4326)',
    },
    metadata: {
      type: 'JSONB',
      default: pgm.func("'{}'::jsonb"),
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: annotations (user reviews / recommendations)
  pgm.createTable('annotations', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    place_id: {
      type: 'INT',
      references: 'places(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },

    went_with: {
      type: 'TEXT[]',
    },
    labels: {
      type: 'TEXT[]',
    },
    notes: {
      type: 'TEXT',
    },
    metadata: {
      type: 'JSONB',
      default: pgm.func("'{}'::jsonb"),
    },
    visit_date: {
      type: 'DATE',
    },
    rating: {
      type: 'SMALLINT',
      check: 'rating BETWEEN 1 AND 5',
    },
    visibility: {
      type: 'TEXT',
      default: 'friends',
      check: "visibility IN ('friends','public')",
    },
    embedding: {
      type: 'VECTOR(1536)',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: media (photos, videos)
  pgm.createTable('media', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    place_id: {
      type: 'INT',
      references: 'places(id)',
      onDelete: 'CASCADE',
    },
    annotation_id: {
      type: 'INT',
      references: 'annotations(id)',
      onDelete: 'SET NULL',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    url: {
      type: 'TEXT',
      notNull: true,
    },
    mime_type: {
      type: 'TEXT',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Indexes for spatial and vector lookups
  pgm.createIndex('places', 'geom', { method: 'GIST' });
  
  // Additional indexes for performance
  pgm.createIndex('places', 'google_place_id');
  pgm.createIndex('places', 'category_id');
  pgm.createIndex('annotations', 'place_id');
  pgm.createIndex('annotations', 'user_id');
  pgm.createIndex('annotations', 'visibility');
  pgm.createIndex('media', 'place_id');
  pgm.createIndex('media', 'annotation_id');
  pgm.createIndex('media', 'user_id');



  // Table: user_follows (follow relationships)
  pgm.createTable('user_follows', {
    follower_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    following_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  
  // Primary key constraint
  pgm.addConstraint('user_follows', 'pk_user_follows', { 
    primaryKey: ['follower_id', 'following_id'] 
  });
  
  // Prevent self-following
  pgm.addConstraint('user_follows', 'check_no_self_follow', {
    check: 'follower_id != following_id'
  });

  // Table: user_privacy_settings
  pgm.createTable('user_privacy_settings', {
    user_id: {
      type: 'UUID',
      primaryKey: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    profile_visibility: {
      type: 'TEXT',
      notNull: true,
      default: 'public',
      check: "profile_visibility IN ('public', 'private')",
    },
    allow_follow_requests: {
      type: 'BOOLEAN',
      notNull: true,
      default: true,
    },
    show_location_in_feed: {
      type: 'BOOLEAN',
      notNull: true,
      default: true,
    },
    allow_messages: {
      type: 'BOOLEAN',
      notNull: true,
      default: false,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: annotation_likes (for liking annotations/reviews)
  pgm.createTable('annotation_likes', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    annotation_id: {
      type: 'INT',
      notNull: true,
      references: 'annotations(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  
  // Add unique constraint to prevent duplicate likes
  pgm.addConstraint('annotation_likes', 'unique_annotation_like', {
    unique: ['annotation_id', 'user_id']
  });

  // Table: annotation_comments (for commenting on annotations/reviews)
  pgm.createTable('annotation_comments', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    annotation_id: {
      type: 'INT',
      notNull: true,
      references: 'annotations(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    parent_comment_id: {
      type: 'INT',
      references: 'annotation_comments(id)',
      onDelete: 'CASCADE',
    },
    comment: {
      type: 'TEXT',
      notNull: true,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: saved_places (for saving places to user's collection)
  pgm.createTable('saved_places', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    place_id: {
      type: 'INT',
      notNull: true,
      references: 'places(id)',
      onDelete: 'CASCADE',
    },
    notes: {
      type: 'TEXT',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  
  // Add unique constraint to prevent duplicate saves
  pgm.addConstraint('saved_places', 'unique_saved_place', {
    unique: ['user_id', 'place_id']
  });

  // Table: comment_likes (for liking comments)
  pgm.createTable('comment_likes', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    comment_id: {
      type: 'INT',
      notNull: true,
      references: 'annotation_comments(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  
  // Add unique constraint to prevent duplicate comment likes
  pgm.addConstraint('comment_likes', 'unique_comment_like', {
    unique: ['comment_id', 'user_id']
  });

  // Table: user_blocks
  pgm.createTable('user_blocks', {
    blocker_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    blocked_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  
  // Primary key constraint
  pgm.addConstraint('user_blocks', 'pk_user_blocks', { 
    primaryKey: ['blocker_id', 'blocked_id'] 
  });
  
  // Prevent self-blocking
  pgm.addConstraint('user_blocks', 'check_no_self_block', {
    check: 'blocker_id != blocked_id'
  });

  // Create indexes for social network tables
  pgm.createIndex('user_follows', 'follower_id');
  pgm.createIndex('user_follows', 'following_id');
  pgm.createIndex('annotation_comments', 'annotation_id');
  pgm.createIndex('annotation_comments', 'user_id');
  pgm.createIndex('annotation_comments', 'parent_comment_id');
  pgm.createIndex('annotation_comments', 'created_at');
  pgm.createIndex('annotation_likes', 'annotation_id');
  pgm.createIndex('annotation_likes', 'user_id');
  pgm.createIndex('comment_likes', 'comment_id');
  pgm.createIndex('comment_likes', 'user_id');
  pgm.createIndex('saved_places', 'user_id');
  pgm.createIndex('saved_places', 'place_id');
  pgm.createIndex('user_blocks', 'blocker_id');
  pgm.createIndex('user_blocks', 'blocked_id');
};

exports.down = pgm => {
  // Drop tables in reverse order of dependency
  pgm.dropTable('user_blocks', { ifExists: true, cascade: true });
  pgm.dropTable('comment_likes', { ifExists: true, cascade: true });
  pgm.dropTable('annotation_likes', { ifExists: true, cascade: true });
  pgm.dropTable('saved_places', { ifExists: true, cascade: true });
  pgm.dropTable('annotation_comments', { ifExists: true, cascade: true });
  pgm.dropTable('user_privacy_settings', { ifExists: true, cascade: true });
  pgm.dropTable('user_follows', { ifExists: true, cascade: true });
  pgm.dropTable('media', { ifExists: true, cascade: true });
  pgm.dropTable('annotations', { ifExists: true, cascade: true });
  pgm.dropTable('places', { ifExists: true, cascade: true });
  pgm.dropTable('categories', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });
  
  // Drop extensions
  pgm.sql('DROP EXTENSION IF EXISTS vector;');
  pgm.sql('DROP EXTENSION IF EXISTS postgis;');
};