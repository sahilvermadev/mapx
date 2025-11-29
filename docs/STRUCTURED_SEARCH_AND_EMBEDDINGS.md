# Structured Search and Embeddings Implementation

## Overview

This document describes the current implementation of the structured search feature using function calling, and details what data is stored in vector embeddings for semantic search.

## Table of Contents

1. [Structured Search Implementation](#structured-search-implementation)
2. [Embedding Data Structure](#embedding-data-structure)
3. [Search Flow](#search-flow)
4. [Database Schema](#database-schema)
5. [Technical Details](#technical-details)

---

## Structured Search Implementation

### Architecture

The structured search system uses **Groq function calling** to extract structured search parameters from natural language queries, then applies precise filters to guarantee accurate results.

### Components

#### 1. Function Calling Tool (`backend/src/config/searchTools.ts`)

The `search_my_network` tool is defined with the following schema:

```typescript
{
  name: 'search_my_network',
  description: 'Search private recommendations with perfect filters',
  parameters: {
    type: 'object',
    properties: {
      intent: { type: 'string', description: 'core need, e.g. "sandwich", "quiet café", "plumber"' },
      location: {
        oneOf: [
          { type: 'string', description: 'area name like "bandra", "goa", "lisbon"' },
          { type: 'null', description: 'use my current GPS coordinates' }
        ]
      },
      max_price_inr: { type: ['integer', 'null'], enum: [500, 1000, 2000, 5000, null] },
      min_rating: { type: ['number', 'null'], enum: [4.0, 4.5, 4.7, null] },
      require_fresh: { type: 'boolean', description: 'true = visited ≤90 days' },
      require_high_trust: { type: 'boolean', description: 'true = trust_score ≥0.75 (not yet implemented)' },
      limit: { type: 'integer', enum: [1, 2, 3], default: 2 }
    },
    required: ['intent']
  }
}
```

#### 2. Structured Search Service (`backend/src/services/structuredSearch.ts`)

The `executeStructuredSearch()` function:

1. **Resolves Location:**
   - `null` → Uses GPS coordinates from request (15km radius)
   - `string` → Geocodes location name (50km radius)

2. **Applies Filters:**
   - **Location:** PostGIS distance query for places (services included without location filter)
   - **Intent:** Text matching on `description`, `title`, and `labels` using `ILIKE '%intent%'`
   - **Rating:** Filters by `min_rating` threshold
   - **Price:** Filters by `max_price_inr` based on `price_level` in `content_data`
   - **Freshness:** Filters by `created_at` and `visit_date` (≤90 days)
   - **Trust:** Filters by user `trust_score` (≥0.75)
   - **Regret:** Excludes recommendations with `regret_score ≥ 0.6`

3. **Returns Results:**
   - Full recommendation objects with place/service details
   - `top_confidence` score (0.0-1.0) based on result quality
   - `used_current_location` boolean flag
   - Filter statistics and metadata

#### 3. Search Endpoint (`backend/src/routes/recommendationRoutes.ts`)

The `/api/recommendations/search` endpoint:

1. **Attempts Function Calling:**
   - Calls Groq (`llama-3.3-70b-versatile`) with `tool_choice: "auto"`
   - If `search_my_network` is called, executes structured search
   - If `top_confidence ≥ 0.90` AND `limit = 1`, sets `skip_llm: true` (no AI summary)

2. **Falls Back to Semantic Search:**
   - If function calling fails or LLM doesn't call tool
   - Uses vector embeddings for similarity search
   - Generates AI summary with Groq

### GPS Location Handling

**Important:** GPS coordinates are **NOT stored in the database**. Instead:

1. Frontend detects "near me" keywords using `isNearMeQuery()`
2. Frontend calls `getCurrentLocation()` to get GPS from browser
3. GPS coordinates are passed in the search request as `user_lat` and `user_lng`
4. Backend uses these coordinates for location filtering (15km radius)

This approach is:
- ✅ Privacy-friendly (no location tracking)
- ✅ Always fresh (current location at search time)
- ✅ No battery drain (only requested when needed)

---

## Embedding Data Structure

### Overview

Embeddings are 1536-dimensional vectors generated using OpenAI's `text-embedding-ada-002` model. They are stored in PostgreSQL using the `pgvector` extension.

### Recommendation Embeddings

**Function:** `generateRecommendationEmbedding()` in `backend/src/utils/embeddings.ts`

**Data Included in Embedding:**

The embedding is generated from a structured text representation that includes:

1. **Content Type:**
   ```
   Type: place
   Type: service
   Type: unclear
   ```

2. **Title:**
   ```
   Title: Tapri
   ```

3. **Description:**
   ```
   Description: Great place for chai and snacks. Quiet atmosphere perfect for work.
   ```

4. **Labels/Tags:**
   ```
   Tags: café, quiet, wifi, work-friendly
   ```

5. **Rating:**
   ```
   Rating: 4.5/5
   ```

6. **Place Context (if applicable):**
   ```
   Place: Tapri
   Address: Hauz Khas, New Delhi
   ```

7. **Service Context (if applicable):**
   ```
   Service: Mr. Ram Singh
   Service Type: plumber
   Business: Ram Singh Plumbing Services
   Service Address: Sector 15, Noida
   ```

8. **User Information:**
   ```
   By: Sahil Verma
   ```

9. **Price Information (from content_data):**
   ```
   Price ₹₹
   Pricing moderate
   ```
   - Extracted from `content_data.price_level` (1-4) or `price_label`/`price_text`
   - Mapped to: budget (1), moderate (2), higher-end (3), luxury (4)

10. **Content Data (flattened):**
    ```
    Details: visit_date: 2024-01-15, went_with: friends, notes: Great experience
    ```
    - All non-empty fields from `content_data` JSONB object

11. **Metadata (flattened):**
    ```
    Metadata: source: manual, verified: true
    ```
    - All non-empty fields from `metadata` JSONB object

**Example Combined Text:**
```
Type: place. Title: Tapri. Description: Great place for chai and snacks. Quiet atmosphere perfect for work. Tags: café, quiet, wifi, work-friendly. Rating: 4.5/5. Place: Tapri. Address: Hauz Khas, New Delhi. By: Sahil Verma. Price ₹₹. Pricing moderate. Details: visit_date: 2024-01-15, went_with: friends. Metadata: source: manual.
```

### Search Query Embeddings

**Function:** `generateSearchEmbedding()` in `backend/src/utils/embeddings.ts`

**Data Included:**
```
Looking for: quiet café near me. Search query for recommendations.
```

The search query is prefixed with "Looking for:" to match the recommendation embedding format, improving semantic similarity.

### Annotation Embeddings (Legacy)

**Function:** `generateAnnotationEmbedding()` in `backend/src/utils/embeddings.ts`

**Data Included:**
- Place name and address
- User/reviewer name
- Notes/review text
- Labels/tags
- Companions (`went_with`)
- Rating
- Visit date
- Metadata

---

## Search Flow

### Structured Search Path

```
User Query: "looking for restaurants near me"
  ↓
Frontend detects "near me" → Gets GPS coordinates
  ↓
Backend: POST /api/recommendations/search
  ↓
Groq Function Calling (llama-3.3-70b-versatile)
  ↓
LLM calls search_my_network tool with:
  {
    intent: "restaurants",
    location: null,
    user_lat: 28.625173,
    user_lng: 77.090744,
    require_fresh: false,
    require_high_trust: false,
    ...
  }
  ↓
executeStructuredSearch()
  ↓
1. Resolve location → GPS coordinates (15km radius)
2. Query database with filters:
   - Follow filter (user_follows)
   - Location filter (PostGIS ST_DWithin)
   - Intent filter (ILIKE '%restaurants%')
3. Apply post-query filters:
   - Rating, price, freshness, trust, regret
  ↓
Return structured results + confidence score
  ↓
If confidence ≥ 0.90 AND limit = 1:
  → skip_llm: true (template response)
Else:
  → Generate AI summary with Groq
```

### Semantic Search Fallback Path

```
User Query: "quiet café for work"
  ↓
Backend: POST /api/recommendations/search
  ↓
Function calling fails or LLM doesn't call tool
  ↓
Generate search embedding from query
  ↓
Vector similarity search (pgvector):
  SELECT *, 1 - (embedding <=> $1) as similarity
  FROM recommendations
  WHERE embedding IS NOT NULL
    AND 1 - (embedding <=> $1) > $2
    AND user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $3)
  ORDER BY embedding <=> $1
  LIMIT $4
  ↓
Group results by place/service
  ↓
Generate AI summary with Groq
```

---

## Database Schema

### Recommendations Table

```sql
CREATE TABLE recommendations (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  content_type VARCHAR(20) NOT NULL, -- 'place', 'service', 'unclear'
  place_id INTEGER REFERENCES places(id),
  service_id INTEGER REFERENCES services(id),
  title VARCHAR(255),
  description TEXT NOT NULL,
  content_data JSONB, -- Stores visit_date, price_level, notes, etc.
  rating DECIMAL(2,1), -- 1.0 to 5.0
  labels TEXT[], -- Array of tags
  metadata JSONB, -- Additional metadata
  embedding VECTOR(1536), -- OpenAI embedding vector
  visibility VARCHAR(20) DEFAULT 'friends', -- 'friends', 'public'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for vector similarity search
CREATE INDEX recommendations_embedding_idx 
  ON recommendations 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Places Table (for location filtering)

```sql
CREATE TABLE places (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  geom GEOGRAPHY(Point, 4326), -- PostGIS geometry for distance queries
  google_place_id VARCHAR(255),
  ...
);

-- Index for location queries
CREATE INDEX places_geom_idx 
  ON places 
  USING GIST (geom);
```

---

## Technical Details

### Embedding Generation

- **Model:** OpenAI `text-embedding-ada-002`
- **Dimensions:** 1536
- **Storage:** PostgreSQL `VECTOR(1536)` with `pgvector` extension
- **Similarity Metric:** Cosine similarity (using `<=>` operator)
- **Index Type:** IVFFlat (Inverted File Index) for fast approximate nearest neighbor search

### Embedding Queue

Embeddings are generated asynchronously using a queue system (`backend/src/services/embeddingQueue.ts`):

- **Queue Processing:** Background jobs process embedding tasks
- **Retry Logic:** Failed embeddings are retried up to 3 times
- **Batch Processing:** Multiple embeddings can be queued and processed in order

### Caching

- **Search Embeddings:** Cached in-memory for 60 seconds (keyed by query text)
- **AI Summaries:** Cached in-memory for 10 minutes (keyed by query + result IDs)

### Filter Constants

```typescript
const GPS_RADIUS_KM = 15;           // GPS-based search radius
const LOCATION_RADIUS_KM = 50;      // Geocoded location search radius
const FRESH_DAYS_THRESHOLD = 90;    // Freshness threshold
const HIGH_TRUST_THRESHOLD = 0.75;  // High trust threshold
const REGRET_KILLED_THRESHOLD = 0.6; // Regret-killed threshold
```

### Confidence Calculation

The `top_confidence` score is calculated based on:

- Base confidence: 0.5
- +0.2 if rating ≥ 4.5
- +0.15 if fresh (when `require_fresh` is true)
- +0.15 if high trust (when `require_high_trust` is true)
- +0.1 if location filter was used
- Capped at 1.0

---

## Example Embedding Text Generation

### Input Data:
```json
{
  "content_type": "place",
  "title": "Tapri",
  "description": "Great place for chai and snacks. Quiet atmosphere perfect for work.",
  "labels": ["café", "quiet", "wifi", "work-friendly"],
  "rating": 4.5,
  "place_name": "Tapri",
  "place_address": "Hauz Khas, New Delhi",
  "user_name": "Sahil Verma",
  "content_data": {
    "price_level": 2,
    "visit_date": "2024-01-15",
    "went_with": ["friends"],
    "notes": "Great experience"
  },
  "metadata": {
    "source": "manual",
    "verified": true
  }
}
```

### Generated Embedding Text:
```
Type: place. Title: Tapri. Description: Great place for chai and snacks. Quiet atmosphere perfect for work. Tags: café, quiet, wifi, work-friendly. Rating: 4.5/5. Place: Tapri. Address: Hauz Khas, New Delhi. By: Sahil Verma. Price ₹₹. Pricing moderate. Details: price_level: 2, visit_date: 2024-01-15, went_with: ["friends"], notes: Great experience. Metadata: source: manual, verified: true.
```

### Search Query Example:
```
User Query: "quiet café for work"
```

### Generated Search Embedding Text:
```
Looking for: quiet café for work. Search query for recommendations.
```

The embedding model will generate a 1536-dimensional vector that captures the semantic meaning of this text, allowing similarity matching with recommendation embeddings.

---

## Logging

Comprehensive logging is implemented throughout the search flow:

- **Search Request:** Query, parameters, user ID
- **Function Calling:** LLM response, tool calls, parsed arguments
- **Structured Search:** Location resolution, filter application, candidate counts
- **Semantic Search:** Embedding generation, similarity scores, result grouping
- **AI Summary:** Context preparation, generation time, summary length

All logs use clear separators (`═══════` and `─────────`) for easy debugging.

---

## Future Enhancements

1. **Intent Matching:** Replace simple `ILIKE` matching with embedding-based semantic matching
2. **Hybrid Search:** Combine structured filters with semantic similarity for better results
3. **Query Expansion:** Automatically expand intents (e.g., "restaurants" → "restaurant", "dining", "food")
4. **Location Intelligence:** Use user's location history to improve "near me" searches
5. **Embedding Updates:** Regenerate embeddings when recommendations are updated

