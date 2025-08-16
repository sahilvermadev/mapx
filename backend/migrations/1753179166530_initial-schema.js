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

  // Keep existing tables for backward compatibility
  // Table: recommendations (keeping for backward compatibility)
  pgm.createTable('recommendations', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    owner_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    latitude: {
      type: 'NUMERIC(10, 8)',
      notNull: true,
    },
    longitude: {
      type: 'NUMERIC(11, 8)',
      notNull: true,
    },
    notes: {
      type: 'TEXT',
    },
    category: {
      type: 'VARCHAR(100)',
    },
    privacy: {
      type: 'VARCHAR(50)',
      notNull: true,
      default: 'public',
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
  pgm.createIndex('recommendations', ['owner_id', 'privacy'], { ifNotExists: true });
  pgm.createIndex('recommendations', 'privacy', { ifNotExists: true });

  // Table: likes (keeping for backward compatibility)
  pgm.createTable('likes', {
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    recommendation_id: {
      type: 'UUID',
      notNull: true,
      references: 'recommendations(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  pgm.addConstraint('likes', 'pk_likes', { primaryKey: ['user_id', 'recommendation_id'] });

  // Table: saved_recommendations (keeping for backward compatibility)
  pgm.createTable('saved_recommendations', {
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    recommendation_id: {
      type: 'UUID',
      notNull: true,
      references: 'recommendations(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });
  pgm.addConstraint('saved_recommendations', 'pk_saved_recommendations', { primaryKey: ['user_id', 'recommendation_id'] });
};

exports.down = pgm => {
  // Drop tables in reverse order of dependency
  pgm.dropTable('saved_recommendations', { ifExists: true, cascade: true });
  pgm.dropTable('likes', { ifExists: true, cascade: true });
  pgm.dropTable('recommendations', { ifExists: true, cascade: true });
  pgm.dropTable('media', { ifExists: true, cascade: true });
  pgm.dropTable('annotations', { ifExists: true, cascade: true });
  pgm.dropTable('places', { ifExists: true, cascade: true });
  pgm.dropTable('categories', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });
  
  // Drop extensions
  pgm.sql('DROP EXTENSION IF EXISTS vector;');
  pgm.sql('DROP EXTENSION IF EXISTS postgis;');
};