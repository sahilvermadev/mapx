/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // ============================================================================
  // PART 1: SERVICE CATEGORIES SETUP
  // ============================================================================
  
  // Table: service_categories - Master Taxonomy
  pgm.createTable('service_categories', {
    id: {
      type: 'SMALLINT',
      primaryKey: true,
    },
    slug: {
      type: 'VARCHAR(100)',
      notNull: true,
      unique: true,
    },
    name: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    is_user_created: {
      type: 'BOOLEAN',
      notNull: true,
      default: false,
    },
    created_by_user_id: {
      type: 'UUID',
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    sort_order: {
      type: 'SMALLINT',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: service_to_category - Many-to-Many Link
  pgm.createTable('service_to_category', {
    service_id: {
      type: 'INT',
      notNull: true,
      references: 'services(id)',
      onDelete: 'CASCADE',
    },
    category_id: {
      type: 'SMALLINT',
      notNull: true,
      references: 'service_categories(id)',
      onDelete: 'CASCADE',
    },
    added_by_user: {
      type: 'BOOLEAN',
      notNull: true,
      default: false,
    },
    confidence: {
      type: 'NUMERIC(3, 2)',
      default: 1.0,
      check: 'confidence >= 0 AND confidence <= 1',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Composite primary key for service_to_category
  pgm.addConstraint('service_to_category', 'pk_service_to_category', {
    primaryKey: ['service_id', 'category_id']
  });

  // Table: service_recommendation_details - Rich Recommendation Data
  pgm.createTable('service_recommendation_details', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    recommendation_id: {
      type: 'INT',
      notNull: true,
      references: 'recommendations(id)',
      onDelete: 'CASCADE',
      unique: true,
    },
    service_id: {
      type: 'INT',
      notNull: true,
      references: 'services(id)',
      onDelete: 'CASCADE',
    },
    // Core trust fields
    rating: {
      type: 'SMALLINT',
      check: 'rating IS NULL OR (rating >= 1 AND rating <= 5)',
    },
    price_range: {
      type: 'VARCHAR(20)',
      check: "price_range IS NULL OR price_range IN ('₹', '₹₹', '₹₹₹', '₹₹₹₹')",
    },
    exact_price: {
      type: 'VARCHAR(100)',
    },
    // LLM-optimized fields
    experience_summary: {
      type: 'TEXT',
      notNull: true,
    },
    verbatim_quote: {
      type: 'TEXT',
    },
    // Context tags
    context_tags: {
      type: 'TEXT[]',
      default: pgm.func("'{}'::text[]"),
    },
    // Soft skills ratings (1-5, nullable)
    punctual: {
      type: 'SMALLINT',
      check: 'punctual IS NULL OR (punctual >= 1 AND punctual <= 5)',
    },
    communicative: {
      type: 'SMALLINT',
      check: 'communicative IS NULL OR (communicative >= 1 AND communicative <= 5)',
    },
    honest_pricing: {
      type: 'SMALLINT',
      check: 'honest_pricing IS NULL OR (honest_pricing >= 1 AND honest_pricing <= 5)',
    },
    respectful: {
      type: 'SMALLINT',
      check: 'respectful IS NULL OR (respectful >= 1 AND respectful <= 5)',
    },
    clean_work: {
      type: 'SMALLINT',
      check: 'clean_work IS NULL OR (clean_work >= 1 AND clean_work <= 5)',
    },
    // Full-text search
    search_vector: {
      type: 'TSVECTOR',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Table: service_tags - Tags for Services
  pgm.createTable('service_tags', {
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
    recommendation_id: {
      type: 'INT',
      references: 'recommendations(id)',
      onDelete: 'SET NULL',
    },
    tag: {
      type: 'VARCHAR(100)',
      notNull: true,
    },
    frequency: {
      type: 'INT',
      default: 1,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add unique constraint for service_id + tag combination
  pgm.addConstraint('service_tags', 'unique_service_tag', {
    unique: ['service_id', 'tag']
  });

  // Table: category_context_tags - Context Tags per Category
  pgm.createTable('category_context_tags', {
    id: {
      type: 'SERIAL',
      primaryKey: true,
    },
    category_id: {
      type: 'SMALLINT',
      notNull: true,
      references: 'service_categories(id)',
      onDelete: 'CASCADE',
    },
    tag: {
      type: 'VARCHAR(100)',
      notNull: true,
    },
    description: {
      type: 'TEXT',
    },
    sort_order: {
      type: 'SMALLINT',
      default: 0,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Add new columns to services table
  pgm.addColumn('services', {
    rating_average: {
      type: 'NUMERIC(3, 2)',
      check: 'rating_average IS NULL OR (rating_average >= 1 AND rating_average <= 5)',
    },
    rating_count: {
      type: 'INT',
      default: 0,
      notNull: true,
    },
    primary_category_id: {
      type: 'SMALLINT',
      references: 'service_categories(id)',
      onDelete: 'SET NULL',
    },
    common_tags: {
      type: 'TEXT[]',
      default: pgm.func("'{}'::text[]"),
    },
  });

  // Indexes for service_categories
  pgm.createIndex('service_categories', 'slug', { unique: true });
  pgm.createIndex('service_categories', 'sort_order');
  pgm.createIndex('service_categories', 'created_by_user_id');

  // Indexes for service_to_category
  pgm.createIndex('service_to_category', 'service_id');
  pgm.createIndex('service_to_category', 'category_id');
  pgm.createIndex('service_to_category', ['service_id', 'category_id']);

  // Indexes for service_recommendation_details
  pgm.createIndex('service_recommendation_details', 'recommendation_id', { unique: true });
  pgm.createIndex('service_recommendation_details', 'service_id');
  pgm.createIndex('service_recommendation_details', 'rating');
  pgm.createIndex('service_recommendation_details', 'price_range');
  pgm.createIndex('service_recommendation_details', 'context_tags', { method: 'gin' });
  pgm.createIndex('service_recommendation_details', 'search_vector', { method: 'gin' });

  // Indexes for service_tags
  pgm.createIndex('service_tags', 'service_id');
  pgm.createIndex('service_tags', 'recommendation_id');
  pgm.createIndex('service_tags', 'tag');
  pgm.createIndex('service_tags', ['service_id', 'tag']);

  // Indexes for category_context_tags
  pgm.createIndex('category_context_tags', 'category_id');
  pgm.createIndex('category_context_tags', ['category_id', 'sort_order']);

  // Indexes for new services columns
  pgm.createIndex('services', 'primary_category_id');
  pgm.createIndex('services', 'rating_average');
  pgm.createIndex('services', 'common_tags', { method: 'gin' });

  // ============================================================================
  // PART 2: RECOMMENDATIONS SCHEMA REFACTOR
  // ============================================================================

  // Step 1: Add service_category_id column to recommendations table
  pgm.addColumn('recommendations', {
    service_category_id: {
      type: 'SMALLINT',
      references: 'service_categories(id)',
      onDelete: 'SET NULL',
    },
  });

  // Step 2: Backfill service_category_id from content_data
  pgm.sql(`
    UPDATE recommendations r
    SET service_category_id = (r.content_data->>'service_category_id')::int
    WHERE r.content_type = 'service' 
      AND r.content_data->>'service_category_id' IS NOT NULL
      AND (r.content_data->>'service_category_id')::int IS NOT NULL;
  `);

  // Step 3: Create index for efficient content type + category filtering
  pgm.createIndex('recommendations', ['content_type', 'service_category_id'], {
    name: 'idx_recommendations_type_category',
    where: "content_type = 'service'",
  });

  // Step 4: Create index for efficient feed queries
  pgm.createIndex('recommendations', ['user_id', 'visibility', 'created_at'], {
    name: 'idx_recommendations_feed',
    where: "visibility IN ('friends', 'public')",
  });

  // Step 5: Remove title column from recommendations (redundant with place/service name)
  pgm.dropColumn('recommendations', 'title', { ifExists: true });

  // ============================================================================
  // PART 3: SOFT-DELETE PATTERN
  // ============================================================================

  // Add deleted_at columns for soft-delete pattern
  pgm.addColumn('services', {
    deleted_at: {
      type: 'TIMESTAMPTZ',
    },
  });

  pgm.addColumn('recommendations', {
    deleted_at: {
      type: 'TIMESTAMPTZ',
    },
  });

  pgm.addColumn('places', {
    deleted_at: {
      type: 'TIMESTAMPTZ',
    },
  });

  // Create indexes for soft-delete queries (WHERE deleted_at IS NULL)
  pgm.createIndex('services', 'deleted_at', {
    name: 'idx_services_deleted_at',
    where: 'deleted_at IS NULL',
  });

  pgm.createIndex('recommendations', 'deleted_at', {
    name: 'idx_recommendations_deleted_at',
    where: 'deleted_at IS NULL',
  });

  pgm.createIndex('places', 'deleted_at', {
    name: 'idx_places_deleted_at',
    where: 'deleted_at IS NULL',
  });

  // ============================================================================
  // PART 4: CONSTRAINTS AND ADDITIONAL INDEXES
  // ============================================================================

  // Add CHECK constraint for service_category_id consistency
  pgm.sql(`
    ALTER TABLE recommendations 
    ADD CONSTRAINT recommendations_service_category_check
    CHECK (
      (content_type != 'service' AND service_category_id IS NULL) OR
      content_type = 'service'
    );
  `);

  // Add missing composite index for service search (category + city)
  pgm.createIndex('services', ['primary_category_id', 'city_slug'], {
    name: 'idx_services_category_city',
    where: 'primary_category_id IS NOT NULL AND city_slug IS NOT NULL AND deleted_at IS NULL',
  });

  // Add standalone index on service_category_id for joins
  pgm.createIndex('recommendations', 'service_category_id', {
    name: 'idx_recommendations_service_category_id',
    where: 'service_category_id IS NOT NULL AND deleted_at IS NULL',
  });

  // Add warning comment about SMALLINT limitation
  pgm.sql(`
    COMMENT ON COLUMN service_categories.id IS 
    'WARNING: SMALLINT limits to 32,767 categories. Consider migrating to INT before reaching limit. Current count: ~150 categories.';
  `);

  // ============================================================================
  // PART 5: TRIGGERS AND FUNCTIONS
  // ============================================================================

  // Create trigger function to validate and auto-link service_category_id
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_service_category_consistency()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.content_type = 'service' 
         AND NEW.service_id IS NOT NULL 
         AND NEW.service_category_id IS NOT NULL THEN
        INSERT INTO service_to_category (service_id, category_id, added_by_user, confidence, created_at)
        VALUES (NEW.service_id, NEW.service_category_id, false, 0.8, CURRENT_TIMESTAMP)
        ON CONFLICT (service_id, category_id) DO NOTHING;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create trigger to validate service_category_id
  pgm.sql(`
    CREATE TRIGGER trigger_check_service_category_consistency
    BEFORE INSERT OR UPDATE ON recommendations
    FOR EACH ROW
    EXECUTE FUNCTION check_service_category_consistency();
  `);

  // Optimize full-text search trigger to include service name and category name
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_service_recommendation_search_vector()
    RETURNS TRIGGER AS $$
    DECLARE
      service_name_text TEXT;
      category_name_text TEXT;
    BEGIN
      SELECT name INTO service_name_text
      FROM services
      WHERE id = NEW.service_id AND deleted_at IS NULL
      LIMIT 1;
      
      SELECT sc.name INTO category_name_text
      FROM recommendations r
      JOIN service_categories sc ON sc.id = r.service_category_id
      WHERE r.id = NEW.recommendation_id
      LIMIT 1;
      
      NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(service_name_text, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(category_name_text, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.experience_summary, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.verbatim_quote, '')), 'B') ||
        setweight(to_tsvector('english', array_to_string(NEW.context_tags, ' ')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create trigger to auto-update search_vector
  pgm.sql(`
    CREATE TRIGGER trigger_update_service_recommendation_search_vector
    BEFORE INSERT OR UPDATE ON service_recommendation_details
    FOR EACH ROW
    EXECUTE FUNCTION update_service_recommendation_search_vector();
  `);

  // Create trigger function to update updated_at timestamp
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_service_recommendation_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at := CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER trigger_update_service_recommendation_updated_at
    BEFORE UPDATE ON service_recommendation_details
    FOR EACH ROW
    EXECUTE FUNCTION update_service_recommendation_updated_at();
  `);

  // Create trigger function for recommendations search_vector
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_recommendations_search_vector()
    RETURNS TRIGGER AS $$
    DECLARE
      place_name_text TEXT;
      service_name_text TEXT;
    BEGIN
      IF NEW.place_id IS NOT NULL THEN
        SELECT name INTO place_name_text
        FROM places
        WHERE id = NEW.place_id AND deleted_at IS NULL;
      ELSIF NEW.service_id IS NOT NULL THEN
        SELECT name INTO service_name_text
        FROM services
        WHERE id = NEW.service_id AND deleted_at IS NULL;
      END IF;
      
      NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(place_name_text, service_name_text, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(array_to_string(NEW.labels, ' '), '')), 'B');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ============================================================================
  // PART 6: FULL-TEXT SEARCH
  // ============================================================================

  // Add search_vector column to recommendations table
  pgm.addColumn('recommendations', {
    search_vector: {
      type: 'TSVECTOR',
    },
  });

  // Create GIN index on search_vector
  pgm.sql(`
    CREATE INDEX idx_recommendations_search_vector ON recommendations 
    USING GIN(search_vector) 
    WHERE deleted_at IS NULL;
  `);

  // Create trigger for recommendations search_vector
  pgm.sql(`
    DROP TRIGGER IF EXISTS trigger_update_recommendations_search_vector ON recommendations;
    CREATE TRIGGER trigger_update_recommendations_search_vector
    BEFORE INSERT OR UPDATE ON recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_recommendations_search_vector();
  `);

  // ============================================================================
  // PART 7: PHONE NORMALIZATION FUNCTION
  // ============================================================================

  pgm.sql(`
    CREATE OR REPLACE FUNCTION normalize_phone_for_storage(phone TEXT)
    RETURNS TEXT AS $$
    DECLARE
      digits TEXT;
    BEGIN
      IF phone IS NULL OR phone = '' THEN
        RETURN NULL;
      END IF;
      
      digits := regexp_replace(phone, '[^0-9]', '', 'g');
      
      IF length(digits) = 10 THEN
        RETURN digits;
      END IF;
      
      IF length(digits) = 11 AND digits LIKE '0%' THEN
        RETURN substring(digits from 2);
      END IF;
      
      IF length(digits) = 12 AND digits LIKE '91%' THEN
        RETURN substring(digits from 3);
      END IF;
      
      IF length(digits) = 13 AND digits LIKE '91%' THEN
        RETURN substring(digits from 3);
      END IF;
      
      RETURN digits;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `);

  // ============================================================================
  // PART 8: MATERIALIZED VIEWS
  // ============================================================================

  // Materialized view for category statistics
  pgm.sql(`
    CREATE MATERIALIZED VIEW category_stats AS
    SELECT 
      sc.id as category_id,
      sc.slug as category_slug,
      sc.name as category_name,
      COUNT(DISTINCT stc.service_id) as service_count,
      COUNT(DISTINCT r.id) as recommendation_count,
      AVG(srd.rating)::NUMERIC(3, 2) as avg_rating,
      COUNT(DISTINCT CASE WHEN srd.rating IS NOT NULL THEN srd.rating END) as rating_count
    FROM service_categories sc
    LEFT JOIN service_to_category stc ON sc.id = stc.category_id
    LEFT JOIN services s ON stc.service_id = s.id AND s.deleted_at IS NULL
    LEFT JOIN recommendations r ON r.service_category_id = sc.id AND r.deleted_at IS NULL
    LEFT JOIN service_recommendation_details srd ON r.id = srd.recommendation_id
    GROUP BY sc.id, sc.slug, sc.name;
  `);

  // Create unique index on materialized view
  pgm.sql(`
    CREATE UNIQUE INDEX idx_category_stats_category_id ON category_stats(category_id);
  `);

  // Create function to refresh category stats
  pgm.sql(`
    CREATE OR REPLACE FUNCTION refresh_category_stats()
    RETURNS void AS $$
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY category_stats;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ============================================================================
  // PART 9: DROP DEPRECATED COLUMNS
  // ============================================================================

  pgm.dropColumn('services', 'business_name', { ifExists: true });
  pgm.dropColumn('service_categories', 'icon', { ifExists: true });

  // ============================================================================
  // PART 11: FEED PERFORMANCE INDEXES
  // ============================================================================

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
  pgm.createIndex('user_blocks', ['blocker_id', 'blocked_id'], {
    name: 'idx_user_blocks_blocker_blocked'
  });

  // Composite index for recommendations - optimized for feed queries
  pgm.createIndex('recommendations', ['user_id', 'visibility', 'created_at'], {
    name: 'idx_recommendations_user_visibility_created'
  });

  // Additional composite index for recommendations with question_id filter
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
  // Drop feed performance indexes
  pgm.dropIndex('questions', 'idx_questions_user_visibility_created');
  pgm.dropIndex('recommendations', 'idx_recommendations_user_question_visibility_created');
  pgm.dropIndex('recommendations', 'idx_recommendations_user_visibility_created');
  pgm.dropIndex('user_blocks', 'idx_user_blocks_blocker_blocked');
  pgm.dropIndex('user_follows', 'idx_user_follows_follower_created_at');
  pgm.dropIndex('annotation_likes', 'idx_annotation_likes_rec_id_created_at');
  pgm.dropIndex('annotation_comments', 'idx_annotation_comments_rec_id_created_at');

  // Restore business_name column
  pgm.addColumn('services', {
    business_name: {
      type: 'VARCHAR(255)',
    },
  });

  // Drop materialized views
  pgm.sql('DROP FUNCTION IF EXISTS refresh_category_stats();');
  pgm.sql('DROP MATERIALIZED VIEW IF EXISTS category_stats CASCADE;');

  // Drop phone normalization function
  pgm.sql('DROP FUNCTION IF EXISTS normalize_phone_for_storage(TEXT);');

  // Drop search_vector index, trigger, and column
  pgm.sql('DROP INDEX IF EXISTS idx_recommendations_search_vector;');
  pgm.sql('DROP TRIGGER IF EXISTS trigger_update_recommendations_search_vector ON recommendations;');
  pgm.sql('DROP FUNCTION IF EXISTS update_recommendations_search_vector();');
  pgm.dropColumn('recommendations', 'search_vector', { ifExists: true });

  // Drop triggers
  pgm.sql('DROP TRIGGER IF EXISTS trigger_check_service_category_consistency ON recommendations;');
  pgm.sql('DROP TRIGGER IF EXISTS trigger_update_service_recommendation_updated_at ON service_recommendation_details;');
  pgm.sql('DROP TRIGGER IF EXISTS trigger_update_service_recommendation_search_vector ON service_recommendation_details;');

  // Drop functions
  pgm.sql('DROP FUNCTION IF EXISTS check_service_category_consistency();');
  pgm.sql('DROP FUNCTION IF EXISTS update_service_recommendation_updated_at();');
  pgm.sql('DROP FUNCTION IF EXISTS update_service_recommendation_search_vector();');

  // Drop indexes
  pgm.dropIndex('recommendations', 'idx_recommendations_service_category_id', { ifExists: true });
  pgm.dropIndex('services', 'idx_services_category_city', { ifExists: true });
  pgm.dropIndex('places', 'idx_places_deleted_at', { ifExists: true });
  pgm.dropIndex('recommendations', 'idx_recommendations_deleted_at', { ifExists: true });
  pgm.dropIndex('services', 'idx_services_deleted_at', { ifExists: true });
  pgm.dropIndex('recommendations', 'idx_recommendations_feed', { ifExists: true });
  pgm.dropIndex('recommendations', 'idx_recommendations_type_category', { ifExists: true });

  // Drop constraint
  pgm.sql('ALTER TABLE recommendations DROP CONSTRAINT IF EXISTS recommendations_service_category_check;');

  // Drop columns
  pgm.dropColumn('places', 'deleted_at', { ifExists: true });
  pgm.dropColumn('recommendations', 'deleted_at', { ifExists: true });
  pgm.dropColumn('services', 'deleted_at', { ifExists: true });
  
  // Restore title column
  pgm.addColumn('recommendations', {
    title: {
      type: 'TEXT',
    },
  });

  // Remove service_category_id column
  pgm.dropColumn('recommendations', 'service_category_id', { ifExists: true });

  // Drop tables in reverse order of dependencies
  pgm.dropTable('category_context_tags', { ifExists: true, cascade: true });
  pgm.dropTable('service_tags', { ifExists: true, cascade: true });
  pgm.dropTable('service_recommendation_details', { ifExists: true, cascade: true });
  pgm.dropTable('service_to_category', { ifExists: true, cascade: true });
  pgm.dropTable('service_categories', { ifExists: true, cascade: true });

  // Remove columns from services table
  pgm.dropColumn('services', 'common_tags', { ifExists: true });
  pgm.dropColumn('services', 'primary_category_id', { ifExists: true });
  pgm.dropColumn('services', 'rating_count', { ifExists: true });
  pgm.dropColumn('services', 'rating_average', { ifExists: true });
};

