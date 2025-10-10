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
    username: {
      type: 'VARCHAR(50)',
      unique: true,
      notNull: false, // Allow null initially, will be set during onboarding
    },
    username_set_at: {
      type: 'TIMESTAMPTZ',
      notNull: false,
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
  pgm.createIndex('users', 'username', { ifNotExists: true });

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


  // Table: services
  pgm.createTable('services', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    phone_number: {
      type: 'VARCHAR(20)',
      unique: true,
    },
    email: {
      type: 'VARCHAR(255)',
      unique: true,
    },
    name: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    service_type: {
      type: 'VARCHAR(100)', // e.g., 'painter', 'plumber', 'electrician'
    },
    business_name: {
      type: 'VARCHAR(255)',
    },
    address: {
      type: 'TEXT',
    },
    website: {
      type: 'VARCHAR(255)',
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

  // Table: service_names (for tracking name variations)
  pgm.createTable('service_names', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    service_id: {
      type: 'INT',
      notNull: true,
      references: 'services(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    frequency: {
      type: 'INT',
      default: 1,
    },
    confidence: {
      type: 'FLOAT',
      default: 1.0,
    },
    last_seen: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: recommendations (new unified table)
  pgm.createTable('recommendations', {
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
    content_type: {
      type: 'TEXT',
      notNull: true,
      check: "content_type IN ('place', 'service', 'tip', 'contact', 'unclear')",
    },
    place_id: {
      type: 'INT',
      references: 'places(id)',
      onDelete: 'SET NULL',
    },
    service_id: {
      type: 'INT',
      references: 'services(id)',
      onDelete: 'SET NULL',
    },
    title: {
      type: 'TEXT',
    },
    description: {
      type: 'TEXT',
      notNull: true,
    },
    content_data: {
      type: 'JSONB',
      default: pgm.func("'{}'::jsonb"),
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
    labels: {
      type: 'TEXT[]',
    },
    metadata: {
      type: 'JSONB',
      default: pgm.func("'{}'::jsonb"),
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
    recommendation_id: {
      type: 'INT',
      references: 'recommendations(id)',
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
  pgm.createIndex('services', 'phone_number', { ifNotExists: true });
  pgm.createIndex('services', 'email', { ifNotExists: true });
  pgm.createIndex('services', 'service_type', { ifNotExists: true });
  pgm.createIndex('service_names', 'service_id', { ifNotExists: true });
  pgm.createIndex('service_names', 'name', { ifNotExists: true });
  pgm.createIndex('recommendations', 'user_id');
  pgm.createIndex('recommendations', 'content_type');
  pgm.createIndex('recommendations', 'place_id');
  pgm.createIndex('recommendations', 'service_id', { ifNotExists: true });
  pgm.createIndex('recommendations', 'visibility');
  pgm.createIndex('recommendations', 'created_at');
  // Vector ANN index for embeddings (use cosine distance)
  pgm.sql("CREATE INDEX IF NOT EXISTS recommendations_embedding_index ON recommendations USING ivfflat (embedding vector_cosine_ops);");
  // GIN index for JSONB queries on content_data
  pgm.createIndex('recommendations', 'content_data', { method: 'gin' });
  pgm.createIndex('media', 'place_id');
  pgm.createIndex('media', 'recommendation_id');
  pgm.createIndex('media', 'user_id');

  // Add constraints for services
  pgm.addConstraint('services', 'services_has_identifier', {
    check: 'phone_number IS NOT NULL OR email IS NOT NULL'
  });

  // Add unique constraint for service_names to prevent duplicate name entries
  pgm.addConstraint('service_names', 'unique_service_name', {
    unique: ['service_id', 'name']
  });

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

  // Table: annotation_likes (for liking recommendations)
  pgm.createTable('annotation_likes', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    recommendation_id: {
      type: 'INT',
      notNull: true,
      references: 'recommendations(id)',
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
  pgm.addConstraint('annotation_likes', 'unique_recommendation_like', {
    unique: ['recommendation_id', 'user_id']
  });

  // Table: annotation_comments (for commenting on recommendations)
  pgm.createTable('annotation_comments', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    recommendation_id: {
      type: 'INT',
      notNull: true,
      references: 'recommendations(id)',
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
    recommendation_id: {
      type: 'INT',
      references: 'recommendations(id)',
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

  // Table: friend_groups
  pgm.createTable('friend_groups', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    name: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    description: {
      type: 'TEXT',
    },
    icon: {
      type: 'VARCHAR(50)',
    },
    created_by: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    visibility: {
      type: 'VARCHAR(20)',
      default: 'private',
      check: "visibility IN ('private', 'members')",
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

  // Table: friend_group_members
  pgm.createTable('friend_group_members', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    group_id: {
      type: 'INT',
      notNull: true,
      references: 'friend_groups(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    added_by: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    role: {
      type: 'VARCHAR(20)',
      default: 'member',
      check: "role IN ('admin', 'member')",
    },
    joined_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: friend_group_preferences
  pgm.createTable('friend_group_preferences', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    group_id: {
      type: 'INT',
      notNull: true,
      references: 'friend_groups(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    notifications_enabled: {
      type: 'BOOLEAN',
      default: true,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add constraints for friend groups
  pgm.addConstraint('friend_group_members', 'unique_group_member', {
    unique: ['group_id', 'user_id']
  });

  pgm.addConstraint('friend_group_preferences', 'unique_group_preference', {
    unique: ['group_id', 'user_id']
  });

  // Create indexes for social network tables
  pgm.createIndex('user_follows', 'follower_id');
  pgm.createIndex('user_follows', 'following_id');
  pgm.createIndex('annotation_comments', 'recommendation_id');
  pgm.createIndex('annotation_comments', 'user_id');
  pgm.createIndex('annotation_comments', 'parent_comment_id');
  pgm.createIndex('annotation_comments', 'created_at');
  pgm.createIndex('annotation_likes', 'recommendation_id');
  pgm.createIndex('annotation_likes', 'user_id');
  pgm.createIndex('comment_likes', 'comment_id');
  pgm.createIndex('comment_likes', 'user_id');
  pgm.createIndex('saved_places', 'user_id');
  pgm.createIndex('saved_places', 'place_id');
  pgm.createIndex('saved_places', 'recommendation_id');
  pgm.createIndex('user_blocks', 'blocker_id');
  pgm.createIndex('user_blocks', 'blocked_id');
  pgm.createIndex('friend_groups', 'created_by');
  pgm.createIndex('friend_group_members', 'group_id');
  pgm.createIndex('friend_group_members', 'user_id');
  pgm.createIndex('friend_group_preferences', 'group_id');
  pgm.createIndex('friend_group_preferences', 'user_id');

  // Mentions tables (posts and comments)
  pgm.createTable('post_mentions', {
    id: 'id',
    recommendation_id: {
      type: 'INT',
      notNull: true,
      references: 'recommendations(id)',
      onDelete: 'CASCADE',
    },
    mentioned_user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    mentioned_by_user_id: {
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
  pgm.addConstraint(
    'post_mentions',
    'post_mentions_unique_recommendation_mentioned_user',
    { unique: ['recommendation_id', 'mentioned_user_id'] }
  );
  pgm.createIndex('post_mentions', ['mentioned_user_id']);
  pgm.createIndex('post_mentions', ['recommendation_id']);

  pgm.createTable('comment_mentions', {
    id: 'id',
    comment_id: {
      type: 'INT',
      notNull: true,
      references: 'annotation_comments(id)',
      onDelete: 'CASCADE',
    },
    mentioned_user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    mentioned_by_user_id: {
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
  pgm.addConstraint(
    'comment_mentions',
    'comment_mentions_unique_comment_mentioned_user',
    { unique: ['comment_id', 'mentioned_user_id'] }
  );
  pgm.createIndex('comment_mentions', ['mentioned_user_id']);
  pgm.createIndex('comment_mentions', ['comment_id']);

  // Notifications table
  pgm.createTable('notifications', {
    id: 'id',
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    type: {
      type: 'TEXT',
      notNull: true,
    },
    message: {
      type: 'TEXT',
      notNull: true,
    },
    data: {
      type: 'JSONB',
      default: pgm.func("'{}'::jsonb"),
    },
    is_read: {
      type: 'BOOLEAN',
      notNull: true,
      default: false,
    },
    read_at: {
      type: 'TIMESTAMPTZ',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  pgm.createIndex('notifications', ['user_id']);
  pgm.createIndex('notifications', ['is_read']);
  pgm.createIndex('notifications', ['created_at']);
};

exports.down = pgm => {
  // Drop tables in reverse order of dependency
  pgm.dropTable('notifications', { ifExists: true, cascade: true });
  pgm.dropTable('comment_mentions', { ifExists: true, cascade: true });
  pgm.dropTable('post_mentions', { ifExists: true, cascade: true });
  pgm.dropTable('user_blocks', { ifExists: true, cascade: true });
  pgm.dropTable('comment_likes', { ifExists: true, cascade: true });
  pgm.dropTable('annotation_likes', { ifExists: true, cascade: true });
  pgm.dropTable('saved_places', { ifExists: true, cascade: true });
  pgm.dropTable('annotation_comments', { ifExists: true, cascade: true });
  pgm.dropTable('user_privacy_settings', { ifExists: true, cascade: true });
  pgm.dropTable('user_follows', { ifExists: true, cascade: true });
  pgm.dropTable('friend_group_preferences', { ifExists: true, cascade: true });
  pgm.dropTable('friend_group_members', { ifExists: true, cascade: true });
  pgm.dropTable('friend_groups', { ifExists: true, cascade: true });
  pgm.dropTable('media', { ifExists: true, cascade: true });
  pgm.dropTable('recommendations', { ifExists: true, cascade: true });
  pgm.dropTable('service_names', { ifExists: true, cascade: true });
  pgm.dropTable('services', { ifExists: true, cascade: true });
  pgm.dropTable('places', { ifExists: true, cascade: true });
  pgm.dropTable('categories', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });
  
  // Drop extensions
  pgm.sql('DROP EXTENSION IF EXISTS vector;');
  pgm.sql('DROP EXTENSION IF EXISTS postgis;');
};