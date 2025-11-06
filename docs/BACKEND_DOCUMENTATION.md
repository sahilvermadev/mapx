# recce_ Backend Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Core Modules](#core-modules)
4. [API Endpoints](#api-endpoints)
5. [Authentication System](#authentication-system)
6. [AI Integration](#ai-integration)
7. [Deployment](#deployment)

---

## Architecture Overview

### System Architecture

```mermaid
graph TB
    subgraph "Frontend"
        React[React App]
        Map[Map Interface]
        Search[Search Interface]
    end
    
    subgraph "Backend API"
        Express[Express Server]
        Auth[Authentication]
        Routes[API Routes]
        Middleware[Middleware]
    end
    
    subgraph "Database Layer"
        PostgreSQL[(PostgreSQL)]
        PostGIS[PostGIS Extension]
        pgvector[pgvector Extension]
    end
    
    subgraph "AI Services"
        OpenAI[OpenAI API]
        Groq[Groq API]
        Embeddings[Embedding Generation]
        Summaries[AI Summaries]
    end
    
    subgraph "External Services"
        Google[Google Places API]
        OAuth[Google OAuth]
    end
    
    React --> Express
    Express --> PostgreSQL
    Express --> OpenAI
    Express --> Groq
    Express --> Google
    Express --> OAuth
    PostgreSQL --> PostGIS
    PostgreSQL --> pgvector
```

### Technology Stack

- **Runtime**: Node.js 18 with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with PostGIS and pgvector extensions
- **Authentication**: Passport.js with Google OAuth
- **AI Services**: OpenAI (embeddings) + Groq (summaries)
- **Containerization**: Docker
- **Development**: ts-node-dev for hot reloading

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    users {
        UUID id PK
        VARCHAR google_id UK
        VARCHAR email UK
        VARCHAR display_name
        TEXT profile_picture_url
        VARCHAR username UK
        TIMESTAMPTZ username_set_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ last_login_at
    }
    
    categories {
        SERIAL id PK
        TEXT name UK
        TEXT description
        TIMESTAMPTZ created_at
    }
    
    places {
        SERIAL id PK
        TEXT google_place_id UK
        TEXT name
        TEXT address
        INT category_id FK
        DOUBLE lat
        DOUBLE lng
        GEOGRAPHY geom
        JSONB metadata
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    services {
        SERIAL id PK
        VARCHAR phone_number UK
        VARCHAR email UK
        VARCHAR name
        VARCHAR service_type
        VARCHAR business_name
        TEXT address
        VARCHAR website
        JSONB metadata
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    service_names {
        SERIAL id PK
        INT service_id FK
        VARCHAR name
        INT frequency
        FLOAT confidence
        TIMESTAMPTZ last_seen
    }
    
    recommendations {
        SERIAL id PK
        UUID user_id FK
        TEXT content_type
        INT place_id FK
        INT service_id FK
        TEXT title
        TEXT description
        JSONB content_data
        SMALLINT rating
        TEXT visibility
        TEXT[] labels
        JSONB metadata
        VECTOR embedding
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    media {
        SERIAL id PK
        INT place_id FK
        INT recommendation_id FK
        UUID user_id FK
        TEXT url
        TEXT mime_type
        TIMESTAMPTZ created_at
    }
    
    user_follows {
        UUID follower_id FK
        UUID following_id FK
        TIMESTAMPTZ created_at
    }
    
    user_privacy_settings {
        UUID user_id PK
        TEXT profile_visibility
        BOOLEAN allow_follow_requests
        BOOLEAN show_location_in_feed
        BOOLEAN allow_messages
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    annotation_likes {
        SERIAL id PK
        INT recommendation_id FK
        UUID user_id FK
        TIMESTAMPTZ created_at
    }
    
    annotation_comments {
        SERIAL id PK
        INT recommendation_id FK
        UUID user_id FK
        INT parent_comment_id FK
        TEXT comment
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    saved_places {
        SERIAL id PK
        UUID user_id FK
        INT place_id FK
        INT recommendation_id FK
        TEXT notes
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    friend_groups {
        SERIAL id PK
        VARCHAR name
        TEXT description
        VARCHAR icon
        UUID created_by FK
        VARCHAR visibility
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    friend_group_members {
        SERIAL id PK
        INT group_id FK
        UUID user_id FK
        UUID added_by FK
        VARCHAR role
        TIMESTAMPTZ joined_at
    }
    
    notifications {
        SERIAL id PK
        UUID user_id FK
        TEXT type
        TEXT message
        JSONB data
        BOOLEAN is_read
        TIMESTAMPTZ read_at
        TIMESTAMPTZ created_at
    }
    
    post_mentions {
        SERIAL id PK
        INT recommendation_id FK
        UUID mentioned_user_id FK
        UUID mentioned_by_user_id FK
        TIMESTAMPTZ created_at
    }
    
    comment_mentions {
        SERIAL id PK
        INT comment_id FK
        UUID mentioned_user_id FK
        UUID mentioned_by_user_id FK
        TIMESTAMPTZ created_at
    }
    
    users ||--o{ recommendations : "creates"
    users ||--o{ media : "uploads"
    users ||--o{ user_follows : "follows"
    users ||--o{ user_follows : "followed_by"
    users ||--o{ user_privacy_settings : "has"
    users ||--o{ annotation_likes : "likes"
    users ||--o{ annotation_comments : "comments"
    users ||--o{ saved_places : "saves"
    users ||--o{ friend_groups : "creates"
    users ||--o{ friend_group_members : "member_of"
    users ||--o{ notifications : "receives"
    users ||--o{ post_mentions : "mentioned_in"
    users ||--o{ comment_mentions : "mentioned_in"
    
    places ||--o{ recommendations : "has"
    places ||--o{ media : "has"
    places ||--o{ saved_places : "saved_to"
    places }o--|| categories : "belongs_to"
    
    services ||--o{ recommendations : "has"
    services ||--o{ service_names : "has_names"
    
    recommendations ||--o{ media : "has"
    recommendations ||--o{ annotation_likes : "receives"
    recommendations ||--o{ annotation_comments : "has"
    recommendations ||--o{ saved_places : "saved_as"
    recommendations ||--o{ post_mentions : "mentions"
    
    annotation_comments ||--o{ comment_mentions : "mentions"
    
    friend_groups ||--o{ friend_group_members : "has_members"
```

### Database Extensions

```sql
-- Required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS postgis;     -- Spatial data support
CREATE EXTENSION IF NOT EXISTS vector;      -- Vector embeddings (pgvector)
```

---

## Core Modules

### 1. Database Connection (`src/db.ts`)

**Purpose**: Centralized database connection management using connection pooling.

**Key Features**:
- Connection pooling with configurable limits
- Environment-based configuration
- Error handling and logging
- Connection health monitoring
- Statement timeout protection
- Pool metrics logging
- Slow query instrumentation

```typescript
interface DatabaseConfig {
  max: number;                    // Maximum connections in pool
  idleTimeoutMillis: number;      // Close idle connections after 30s
  connectionTimeoutMillis: number; // Connection timeout after 2s
  statement_timeout: number;      // Statement timeout after 30s
}
```

**Performance Monitoring**:
- **Pool Metrics**: Logs connection pool statistics every 5 minutes in production
- **Slow Query Detection**: Monitors queries exceeding 200ms with 10% sampling
- **Statement Timeout**: Prevents hung queries with 30-second timeout
- **Query Timing**: Optional `queryWithTiming()` wrapper for detailed monitoring

**Class Diagram**:
```mermaid
classDiagram
    class Pool {
        +Pool(config: PoolConfig)
        +query(text: string, params: any[]): Promise~QueryResult~
        +connect(): Promise~PoolClient~
        +on(event: string, handler: Function): void
    }
    
    class PoolConfig {
        +connectionString: string
        +max: number
        +idleTimeoutMillis: number
        +connectionTimeoutMillis: number
        +statement_timeout: number
    }
    
    class QueryWithTiming {
        +queryWithTiming(text: string, params: any[]): Promise~QueryResult~
        +SLOW_QUERY_THRESHOLD: number
        +SLOW_QUERY_SAMPLE_RATE: number
    }
    
    Pool --> PoolConfig
    QueryWithTiming --> Pool
```

### 2. Places Management (`src/db/places.ts`)

**Purpose**: CRUD operations for place entities with spatial and metadata support.

**Key Functions**:

#### `upsertPlace(placeData: PlaceData): Promise<number>`
- **Purpose**: Create or update place records
- **Parameters**: 
  - `google_place_id`: Unique Google Places identifier
  - `name`: Place name
  - `address`: Physical address
  - `lat/lng`: Coordinates
  - `metadata`: JSON metadata
- **Returns**: Place ID
- **Behavior**: Uses `google_place_id` for upsert logic

#### `getPlaceById(id: number): Promise<Place | null>`
- **Purpose**: Retrieve place by primary key
- **Parameters**: Place ID
- **Returns**: Place object or null

#### `getPlaceByGoogleId(googlePlaceId: string): Promise<Place | null>`
- **Purpose**: Retrieve place by Google Places ID
- **Parameters**: Google Place ID
- **Returns**: Place object or null

#### `searchPlacesNearby(lat: number, lng: number, radiusMeters: number, limit: number): Promise<Place[]>`
- **Purpose**: Spatial search using PostGIS
- **Parameters**: Coordinates, radius, limit
- **Returns**: Array of nearby places sorted by distance

**Class Diagram**:
```mermaid
classDiagram
    class PlaceData {
        +google_place_id?: string
        +name: string
        +address?: string
        +category_id?: number
        +lat?: number
        +lng?: number
        +metadata?: Record~string, any~
    }
    
    class Place {
        +id: number
        +google_place_id?: string
        +name: string
        +address?: string
        +category_id?: number
        +lat?: number
        +lng?: number
        +geom?: string
        +metadata: Record~string, any~
        +created_at: Date
        +updated_at: Date
    }
    
    class PlacesModule {
        +upsertPlace(data: PlaceData): Promise~number~
        +getPlaceById(id: number): Promise~Place~
        +getPlaceByGoogleId(id: string): Promise~Place~
        +searchPlacesNearby(lat, lng, radius, limit): Promise~Place[]~
        +getUserById(id: string): Promise~User~
    }
    
    PlacesModule --> PlaceData
    PlacesModule --> Place
```

### 3. Services Management (`src/db/services.ts`)

**Purpose**: CRUD operations for service entities with name variation tracking and deduplication.

**Key Functions**:

#### `createService(serviceData: ServiceData): Promise<number>`
- **Purpose**: Create new service with phone/email validation
- **Parameters**: Service data with name, contact info, business details
- **Returns**: Service ID
- **Features**: Normalizes phone/email, creates initial name entry

#### `getServiceWithNames(serviceId: number): Promise<ServiceWithNames | null>`
- **Purpose**: Retrieve service with all name variations
- **Returns**: Service object with associated names and frequencies

#### `updateService(serviceId: number, updates: Partial<ServiceData>): Promise<boolean>`
- **Purpose**: Update service information
- **Features**: Handles name variations and contact info updates

**Class Diagram**:
```mermaid
classDiagram
    class ServiceData {
        +name: string
        +phone_number?: string
        +email?: string
        +service_type?: string
        +business_name?: string
        +address?: string
        +website?: string
        +metadata?: Record~string, any~
    }
    
    class Service {
        +id: number
        +name: string
        +phone_number?: string
        +email?: string
        +service_type?: string
        +business_name?: string
        +address?: string
        +website?: string
        +metadata: Record~string, any~
        +created_at: Date
        +updated_at: Date
    }
    
    class ServiceNames {
        +service_id: number
        +name: string
        +frequency: number
        +confidence: number
        +last_seen: Date
    }
    
    ServicesModule --> ServiceData
    ServicesModule --> Service
    ServicesModule --> ServiceNames
```

### 4. Recommendations Management (`src/db/recommendations.ts`)

**Purpose**: CRUD operations for user recommendations with AI embedding support.

**Key Functions**:

#### `insertRecommendation(recommendationData: RecommendationData): Promise<number>`
- Create recommendation with optional async embedding generation

#### `getRecommendationWithSocialData(id: number, currentUserId: string)`
- Retrieve one recommendation with counts and user/place info

#### `searchRecommendationsBySimilarity(embedding: number[], ...)`
- Vector search on `recommendations.embedding` with ivfflat index

#### `getFeedPostsFromRecommendations(...)` and `getFeedPostsFromGroups(...)`
- Feed queries for followed users and group filters

### 5. Social Features (`src/db/social.ts`)

**Purpose**: Social networking functionality including follows, privacy settings, and user interactions.

**Key Functions**:

#### `followUser(followerId: string, followingId: string): Promise<boolean>`
- **Purpose**: Create follow relationship between users
- **Features**: Prevents self-following, handles duplicate follows

#### `unfollowUser(followerId: string, followingId: string): Promise<boolean>`
- **Purpose**: Remove follow relationship
- **Returns**: Success status

#### `getUserPrivacySettings(userId: string): Promise<UserPrivacySettings | null>`
- **Purpose**: Retrieve user privacy configuration
- **Returns**: Privacy settings object

#### `updateUserPrivacySettings(userId: string, settings: Partial<UserPrivacySettings>): Promise<boolean>`
- **Purpose**: Update user privacy preferences
- **Features**: Profile visibility, follow requests, location sharing

### 6. Friend Groups (`src/db/friendGroups.ts`)

**Purpose**: Friend group management for collaborative recommendations and social filtering.

**Key Functions**:

#### `createFriendGroup(groupData: FriendGroupData): Promise<number>`
- **Purpose**: Create new friend group
- **Parameters**: Name, description, icon, visibility settings
- **Returns**: Group ID

#### `addMemberToGroup(groupId: number, userId: string, addedBy: string): Promise<boolean>`
- **Purpose**: Add user to friend group
- **Features**: Role assignment (admin/member), prevents duplicates

#### `getUserGroups(userId: string): Promise<FriendGroup[]>`
- **Purpose**: Retrieve user's friend groups
- **Returns**: Array of groups with member counts

### 7. Notifications (`src/db/notifications.ts`)

**Purpose**: User notification system for social interactions and system events.

**Key Functions**:

#### `createNotification(notificationData: NotificationData): Promise<number>`
- **Purpose**: Create new notification
- **Parameters**: User ID, type, message, metadata
- **Returns**: Notification ID

#### `getUserNotifications(userId: string, limit?: number, offset?: number): Promise<Notification[]>`
- **Purpose**: Retrieve user notifications with pagination
- **Features**: Unread/read filtering, chronological ordering

#### `markNotificationAsRead(notificationId: number): Promise<boolean>`
- **Purpose**: Mark notification as read
- **Returns**: Success status

### 8. Mentions (`src/db/mentions.ts`)

**Purpose**: User mention system for posts and comments.

**Key Functions**:

#### `createPostMention(mentionData: PostMentionData): Promise<number>`
- **Purpose**: Create mention in recommendation post
- **Features**: Tracks who mentioned whom, prevents duplicates

#### `createCommentMention(mentionData: CommentMentionData): Promise<number>`
- **Purpose**: Create mention in comment
- **Features**: Comment-specific mention tracking

#### `getUserMentions(userId: string, limit?: number): Promise<Mention[]>`
- **Purpose**: Retrieve user's mentions
- **Returns**: Array of mentions with context

### 9. AI Integration (`src/utils/embeddings.ts`)

**Purpose**: OpenAI integration for generating and managing vector embeddings.

**Key Functions**:

#### `generateEmbedding(text: string): Promise<number[]>`
- **Purpose**: Generate 1536-dimensional embeddings using OpenAI
- **Parameters**: Text input
- **Returns**: Vector embedding array
- **Model**: `text-embedding-ada-002`

#### `generateAnnotationEmbedding(annotationData: AnnotationData): Promise<number[]>`
- **Purpose**: Generate embeddings from structured annotation data
- **Features**: Combines place info, user info, review text, labels, metadata
- **Format**: Structured text representation for optimal semantic search

#### `calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number`
- **Purpose**: Calculate similarity between two embeddings
- **Returns**: Similarity score (0-1, where 1 is identical)

**Class Diagram**:
```mermaid
classDiagram
    class EmbeddingsModule {
        +generateEmbedding(text: string): Promise~number[]~
        +generateAnnotationEmbedding(data: AnnotationData): Promise~number[]~
        +generateSearchEmbedding(text: string): Promise~number[]~
        +generatePlaceEmbedding(data: PlaceData): Promise~number[]~
        +generateBatchEmbeddings(texts: string[]): Promise~number[][]~
        +calculateCosineSimilarity(emb1, emb2): number
        +validateEmbedding(embedding): boolean
    }
    
    class OpenAI {
        +embeddings: EmbeddingsAPI
        +create(request): Promise~EmbeddingResponse~
    }
    
    EmbeddingsModule --> OpenAI
```

### 10. AI Summaries (`src/utils/aiSummaries.ts`)

**Purpose**: Groq integration for generating intelligent search summaries.

**Key Functions**:

#### `generateAISummary(context: SearchContext): Promise<string>`
- **Purpose**: Generate contextual summaries of search results
- **Parameters**: Search context with results and metadata
- **Model**: `qwen/qwen3-32b` via Groq
- **Features**: 
  - Context-aware responses
  - User attribution
  - Fallback handling

**Class Diagram**:
```mermaid
classDiagram
    class SearchContext {
        +query: string
        +results: SearchResult[]
        +total_places: number
        +total_recommendations: number
    }
    
    class SearchResult {
        +place_name: string
        +place_address?: string
        +total_recommendations: number
        +average_similarity: number
        +recommendations: Recommendation[]
    }
    
    class Recommendation {
        +user_name: string
        +notes?: string
        +rating?: number
        +labels?: string[]
        +went_with?: string[]
        +visit_date?: string
    }
    
    class AISummariesModule {
        +generateAISummary(context: SearchContext): Promise~string~
        +generatePlaceAnalysis(query, placeName, recommendations): Promise~string~
        +generateFallbackSummary(context: SearchContext): string
    }
    
    class Groq {
        +chat: ChatAPI
        +completions: CompletionsAPI
        +create(request): Promise~ChatCompletion~
    }
    
    AISummariesModule --> SearchContext
    AISummariesModule --> Groq
    SearchContext --> SearchResult
    SearchResult --> Recommendation
```

### 11. Embedding Queue (`src/services/embeddingQueue.ts`)

**Purpose**: Asynchronous embedding generation with queue management and retry logic.

**Key Functions**:

#### `enqueue(type: 'annotation' | 'recommendation', recordId: number, data: any, priority?: 'high' | 'normal' | 'low'): Promise<string>`
- **Purpose**: Add embedding task to queue
- **Parameters**: Task type, record ID, data, priority level
- **Returns**: Task ID for tracking

#### `processQueue(): Promise<void>`
- **Purpose**: Process queued embedding tasks
- **Features**: Concurrent processing, retry logic, error handling

**Class Diagram**:
```mermaid
classDiagram
    class EmbeddingQueue {
        +enqueue(type, recordId, data, priority): Promise~string~
        +processQueue(): Promise~void~
        +getQueueStatus(): QueueStatus
        +clearQueue(): void
    }
    
    class EmbeddingTask {
        +id: string
        +type: 'annotation' | 'recommendation'
        +recordId: number
        +data: any
        +retryCount: number
        +maxRetries: number
        +priority: 'high' | 'normal' | 'low'
        +createdAt: Date
    }
    
    EmbeddingQueue --> EmbeddingTask
```

### 12. Service Deduplication (`src/services/serviceDeduplication.ts`)

**Purpose**: Intelligent service deduplication using fuzzy matching and similarity algorithms.

**Key Functions**:

#### `upsertService(serviceData: ServiceData): Promise<UpsertServiceResult>`
- **Purpose**: Create or update service with deduplication
- **Features**: Fuzzy name matching, phone/email normalization, confidence scoring
- **Returns**: Result with action taken and reasoning

#### `findSimilarServices(serviceData: ServiceData, threshold?: number): Promise<Service[]>`
- **Purpose**: Find potentially duplicate services
- **Parameters**: Service data, similarity threshold
- **Returns**: Array of similar services with confidence scores

**Class Diagram**:
```mermaid
classDiagram
    class ServiceDeduplication {
        +upsertService(serviceData): Promise~UpsertServiceResult~
        +findSimilarServices(serviceData, threshold): Promise~Service[]~
        +calculateSimilarity(service1, service2): number
    }
    
    class UpsertServiceResult {
        +action: 'created' | 'updated' | 'merged'
        +serviceId: number
        +confidence: number
        +reasoning: string
    }
    
    ServiceDeduplication --> UpsertServiceResult
```

---

## API Endpoints

### Authentication Routes (`/auth`)

```mermaid
sequenceDiagram
    participant Client
    participant AuthRoutes
    participant Passport
    participant Google
    participant Database
    
    Client->>AuthRoutes: GET /auth/dev-login
    AuthRoutes->>Database: Create/Update mock user
    AuthRoutes->>Client: Redirect with JWT token
    
    Client->>AuthRoutes: GET /auth/google
    AuthRoutes->>Passport: Authenticate with Google
    Passport->>Google: OAuth flow
    Google->>Passport: User profile
    Passport->>Database: Create/Update user
    AuthRoutes->>Client: Redirect with JWT token
```

**Endpoints**:
- `GET /auth/dev-login` - Development login bypass
- `GET /auth/google` - Google OAuth initiation
- `GET /auth/google/callback` - OAuth callback handler
- `GET /auth/logout` - User logout

### Recommendations Routes (`/api/recommendations`)

```mermaid
sequenceDiagram
    participant Client
    participant RecommendationRoutes
    participant PlacesModule
    participant AnnotationsModule
    participant EmbeddingsModule
    participant Database
    
    Client->>RecommendationRoutes: POST /save
    RecommendationRoutes->>PlacesModule: upsertPlace()
    PlacesModule->>Database: Insert/Update place
    RecommendationRoutes->>AnnotationsModule: insertAnnotation()
    AnnotationsModule->>EmbeddingsModule: generateAnnotationEmbedding()
    EmbeddingsModule->>OpenAI: Generate embedding
    AnnotationsModule->>Database: Insert annotation
    RecommendationRoutes->>Client: Success response
```

**Endpoints**:

#### `POST /api/recommendations/save`
- **Purpose**: Save new recommendation with place and annotation
- **Request Body**:
  ```typescript
  interface SaveRecommendationRequest {
    google_place_id?: string;
    place_name: string;
    place_address?: string;
    place_lat?: number;
    place_lng?: number;
    place_metadata?: Record<string, any>;
    went_with?: string[];
    labels?: string[];
    notes?: string;
    metadata?: Record<string, any>;
    visit_date?: string;
    rating?: number;
    visibility?: 'friends' | 'public';
    user_id: string;
  }
  ```
- **Response**:
  ```typescript
  interface SaveRecommendationResponse {
    success: boolean;
    place_id: number;
    annotation_id: number;
    message: string;
  }
  ```

#### `POST /api/recommendations/search`
- **Purpose**: Semantic search using AI embeddings
- **Request Body**:
  ```typescript
  {
    query: string;
    limit?: number;
    threshold?: number;
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean;
    data: {
      query: string;
      summary: string;
      results: SearchResult[];
      total_places: number;
      total_recommendations: number;
    }
  }
  ```

#### `GET /api/recommendations/user/:userId`
- **Purpose**: Get user's recommendations with pagination
- **Query Parameters**: `limit`, `offset`
- **Response**: Array of recommendations with place details

#### `GET /api/recommendations/place/:placeId`
- **Purpose**: Get recommendations for specific place
- **Query Parameters**: `visibility`, `limit`
- **Response**: Array of recommendations with user details

### Profile Routes (`/api/profile`)

**Endpoints**:

#### `GET /api/profile/:userId`
- **Purpose**: Get user profile information
- **Response**: User data with display name, email, profile picture

#### `GET /api/profile/:userId/stats`
- **Purpose**: Get user statistics
- **Response**: Counts of recommendations, likes, saved items, average rating

#### `GET /api/profile/:userId/recommendations`
- **Purpose**: Get user recommendations with advanced filtering
- **Query Parameters**:
  - `rating`: Filter by minimum rating
  - `visibility`: Filter by visibility ('friends'|'public'|'all')
  - `category`: Filter by place category
  - `search`: Text search in place names and notes
  - `date_from`/`date_to`: Date range filter
  - `sort_field`/`sort_direction`: Sorting options
  - `limit`/`offset`: Pagination

### Social Routes (`/api/social`)

**Endpoints**:

#### `POST /api/social/follow`
- **Purpose**: Follow another user
- **Request Body**: `{ followingId: string }`
- **Response**: Success status

#### `DELETE /api/social/unfollow`
- **Purpose**: Unfollow a user
- **Request Body**: `{ followingId: string }`
- **Response**: Success status

#### `GET /api/social/followers/:userId`
- **Purpose**: Get user's followers
- **Query Parameters**: `limit`, `offset`
- **Response**: Array of follower users

#### `GET /api/social/following/:userId`
- **Purpose**: Get users that this user follows
- **Query Parameters**: `limit`, `offset`
- **Response**: Array of following users

### Friend Group Routes (`/api/friend-groups`)

**Endpoints**:

#### `POST /api/friend-groups`
- **Purpose**: Create new friend group
- **Request Body**: `{ name: string, description?: string, icon?: string, visibility?: 'private'|'members' }`
- **Response**: Group ID and details

#### `GET /api/friend-groups/user/:userId`
- **Purpose**: Get user's friend groups
- **Response**: Array of groups with member counts

#### `POST /api/friend-groups/:groupId/members`
- **Purpose**: Add member to group
- **Request Body**: `{ userId: string, role?: 'admin'|'member' }`
- **Response**: Success status

#### `DELETE /api/friend-groups/:groupId/members/:userId`
- **Purpose**: Remove member from group
- **Response**: Success status

### Notification Routes (`/api/notifications`)

**Endpoints**:

#### `GET /api/notifications/user/:userId`
- **Purpose**: Get user notifications
- **Query Parameters**: `limit`, `offset`, `unread_only`
- **Response**: Array of notifications

#### `PUT /api/notifications/:notificationId/read`
- **Purpose**: Mark notification as read
- **Response**: Success status

#### `PUT /api/notifications/user/:userId/read-all`
- **Purpose**: Mark all notifications as read
- **Response**: Success status

### Username Routes (`/api/username`)

**Endpoints**:

#### `POST /api/username/check`
- **Purpose**: Check username availability
- **Request Body**: `{ username: string }`
- **Response**: `{ available: boolean }`

#### `POST /api/username/set`
- **Purpose**: Set user's username
- **Request Body**: `{ username: string }`
- **Response**: Success status

### Database Viewer Routes (`/api/db`)

**Endpoints**:

#### `GET /api/db/recommendations`
- **Purpose**: View all recommendations (admin)
- **Query Parameters**: `limit`, `offset`
- **Response**: Array of recommendations

#### `GET /api/db/services`
- **Purpose**: View all services (admin)
- **Query Parameters**: `limit`, `offset`
- **Response**: Array of services

#### `GET /api/db/places`
- **Purpose**: View all places (admin)
- **Query Parameters**: `limit`, `offset`
- **Response**: Array of places

---

## Authentication System

### JWT-Only Authentication Architecture

**Purpose**: Stateless authentication using JWT tokens with Google OAuth integration.

**Features**:
- Stateless JWT-only authentication (no sessions)
- Google OAuth integration for user authentication
- Automatic user creation/update
- Token-based API access
- Automatic token expiration handling

**Architecture Diagram**:
```mermaid
classDiagram
    class JWTMiddleware {
        +authenticateJWT(req, res, next): void
        +getUserIdFromRequest(req): string
        +handleTokenExpiration(): void
        +handleInvalidToken(): void
    }
    
    class AuthRoutes {
        +googleOAuth(): void
        +googleCallback(): void
        +logout(): void
    }
    
    class PassportConfig {
        +configurePassport(): void
        +createGoogleStrategy(): void
    }
    
    class GoogleStrategy {
        +clientID: string
        +clientSecret: string
        +callbackURL: string
        +scope: string[]
        +verify(accessToken, refreshToken, profile, done): void
    }
    
    JWTMiddleware --> AuthRoutes
    AuthRoutes --> PassportConfig
    PassportConfig --> GoogleStrategy
```

### JWT Authentication Flow

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> GoogleOAuth: /auth/google
    GoogleOAuth --> GoogleCallback: OAuth flow
    GoogleCallback --> JWTIssued: JWT token created
    JWTIssued --> Authenticated: Token stored in localStorage
    Authenticated --> Unauthenticated: Token removed from localStorage
    Authenticated --> TokenExpired: Token expires (24h)
    TokenExpired --> Unauthenticated: Auto-redirect to login
```

---

## AI Integration

### Embedding Generation Pipeline

```mermaid
flowchart TD
    A[User Input] --> B{Input Type}
    B -->|Text| C[generateEmbedding]
    B -->|Annotation| D[generateAnnotationEmbedding]
    B -->|Search Query| E[generateSearchEmbedding]
    B -->|Place Data| F[generatePlaceEmbedding]
    
    C --> G[OpenAI API]
    D --> H[Structured Text]
    H --> G
    E --> G
    F --> I[Place Text]
    I --> G
    
    G --> J[1536-dim Vector]
    J --> K[Database Storage]
    J --> L[Similarity Search]
```

### Semantic Search Process

```mermaid
sequenceDiagram
    participant Client
    participant SearchAPI
    participant EmbeddingsModule
    participant Database
    participant AISummariesModule
    participant Groq
    
    Client->>SearchAPI: POST /search {query}
    SearchAPI->>EmbeddingsModule: generateSearchEmbedding(query)
    EmbeddingsModule->>OpenAI: Generate query embedding
    SearchAPI->>Database: searchAnnotationsBySimilarity()
    Database->>SearchAPI: Similar annotations
    SearchAPI->>AISummariesModule: generateAISummary(context)
    AISummariesModule->>Groq: Generate summary
    SearchAPI->>Client: Search results + AI summary
```

---

## Deployment

### Docker Configuration

**Backend Dockerfile**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication (JWT-only)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=your_jwt_secret

# AI Services
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key

# Application
PORT=5000
NODE_ENV=development|production

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

### Database Migrations

**Migration File**: `migrations/1753179166530_initial-schema.js`

**Key Features**:
- PostGIS and pgvector extensions
- Complete schema with spatial and vector support
- Backward compatibility tables
- Proper indexing for performance

---

## Performance Considerations

### Database Optimization

1. **Spatial Indexes**: PostGIS GIST indexes on geometry columns
2. **Vector Indexes**: pgvector HNSW indexes for similarity search
3. **Connection Pooling**: Configurable pool limits and timeouts
4. **Query Optimization**: Efficient joins and pagination
5. **Statement Timeouts**: 30-second timeout prevents hung queries
6. **Pool Monitoring**: Real-time connection pool metrics
7. **Slow Query Detection**: Automated identification of performance bottlenecks

### CORS Configuration

1. **Environment-Driven Origins**: Configurable via `ALLOWED_ORIGINS` environment variable
2. **Multiple Origins Support**: Comma-separated list for different environments
3. **Development Defaults**: Falls back to `http://localhost:5173` for local development
4. **Production Ready**: Supports multiple domains and subdomains

### Caching Strategy

1. **Embedding Cache**: Cache generated embeddings to reduce API calls
2. **Search Results**: Cache frequent search queries
3. **User Authentication**: JWT-based stateless authentication

### Scalability

1. **Horizontal Scaling**: Stateless API design
2. **Database Sharding**: Geographic partitioning for places
3. **CDN Integration**: Static asset delivery
4. **Load Balancing**: Multiple API instances

---

## Security Considerations

### JWT Authentication Security

1. **JWT Tokens**: Secure token generation and validation with 24-hour expiration
2. **OAuth 2.0**: Secure Google OAuth implementation
3. **Stateless Architecture**: No server-side session storage
4. **Token Expiration**: Automatic cleanup of expired tokens
5. **CORS Configuration**: Proper cross-origin settings

### Data Security

1. **Input Validation**: Comprehensive request validation
2. **SQL Injection Prevention**: Parameterized queries
3. **XSS Protection**: Output sanitization
4. **Rate Limiting**: API rate limiting implementation

### API Security

1. **Authentication Middleware**: Route protection
2. **Authorization**: User-based access control
3. **Error Handling**: Secure error responses
4. **Logging**: Security event logging

---

## Testing Strategy

### Unit Tests

1. **Database Functions**: Test all CRUD operations
2. **AI Integration**: Mock API calls for testing
3. **Authentication**: Test OAuth flows
4. **Validation**: Test input validation

### Integration Tests

1. **API Endpoints**: Test complete request/response cycles
2. **Database Integration**: Test with real database
3. **External APIs**: Test OpenAI and Groq integration

### Performance Tests

1. **Load Testing**: Test API performance under load
2. **Database Performance**: Test query performance
3. **AI API Limits**: Test rate limiting and quotas

---

## Monitoring and Logging

### Application Logging

```typescript
// Structured logging throughout the application
console.log('🔍 SearchBar: Initializing autocomplete...');
console.log('✅ Recommendation saved successfully:', result);
console.error('❌ Error in semantic search:', error);
```

### Performance Monitoring

```typescript
// Pool metrics logging (production only)
console.log('📊 DB Pool metrics:', {
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount
});

// Slow query detection with sampling
console.log('🐌 Slow query detected (250ms):', {
  query: 'SELECT * FROM places WHERE...',
  duration: 250,
  timestamp: '2024-01-15T10:30:00.000Z'
});
```

### Database Monitoring

1. **Query Performance**: Monitor slow queries with automated detection
2. **Connection Pool**: Monitor pool usage with real-time metrics
3. **Index Usage**: Monitor index effectiveness
4. **Statement Timeouts**: Track and alert on query timeouts
5. **Pool Health**: Automated monitoring of connection pool statistics

### AI Service Monitoring

1. **API Usage**: Monitor OpenAI and Groq usage
2. **Rate Limits**: Monitor API rate limits
3. **Error Rates**: Monitor API error rates

---

## Future Enhancements

### Planned Features

1. **Real-time Updates**: WebSocket integration
2. **Advanced Analytics**: User behavior analytics
3. **Machine Learning**: Personalized recommendations
4. **Mobile API**: Native mobile app support

### Technical Improvements

1. **GraphQL**: API query optimization
2. **Microservices**: Service decomposition
3. **Event Sourcing**: Event-driven architecture
4. **CQRS**: Command Query Responsibility Segregation

---

## Conclusion

The recce_ backend is a robust, scalable platform built with modern technologies and best practices. The combination of PostgreSQL with PostGIS and pgvector extensions, along with AI integration via OpenAI and Groq, provides a powerful foundation for location-based social recommendations.

The modular architecture, comprehensive documentation, and extensive testing strategy ensure maintainability and reliability. The system is designed to scale from development to production environments with proper security, monitoring, and performance optimization.

### Recent Performance Improvements

The backend now includes advanced performance monitoring and optimization features:

- **Environment-Driven Configuration**: CORS origins and other settings configurable via environment variables
- **Database Performance Monitoring**: Automated slow query detection and pool metrics logging
- **Connection Protection**: Statement timeouts prevent hung database connections
- **Production Observability**: Comprehensive logging and monitoring for production environments

These improvements ensure the system remains performant and observable as it scales to handle increased load and complexity.

---

## TODO: Performance & Infrastructure Improvements

### 🔴 **High Priority - Critical Performance Issues**

#### 1. JWT Token Optimization ✅ COMPLETED
- **Issue**: JWT tokens require validation on each request
- **Impact**: CPU overhead for token verification
- **Solution**: 
  - ✅ Implemented JWT-only authentication (no sessions)
  - ✅ Optimized token verification with proper error handling
  - ✅ Automatic token expiration and cleanup
- **Effort**: Medium
- **Files**: `src/index.ts`, `src/config/passport.ts`, `src/middleware/auth.ts`

#### 2. Database Connection Pool Tuning
- **Issue**: Fixed pool size may not scale with load
- **Impact**: Connection exhaustion under high load
- **Solution**:
  - Implement dynamic pool sizing based on load
  - Add connection pool health monitoring
  - Create pool metrics dashboard
- **Effort**: Medium
- **Files**: `src/db.ts`

### 🟡 **Medium Priority - Scalability & Reliability**

#### 3. Caching Strategy Implementation
- **Issue**: No caching layer for frequently accessed data
- **Impact**: Repeated database queries for same data
- **Solution**:
  - Implement Redis caching for:
    - User profile data
    - Place information
    - Search results
    - Embedding vectors
  - Add cache invalidation strategies
- **Effort**: High
- **Files**: New `src/cache/` module

#### 4. API Rate Limiting
- **Issue**: No protection against abuse or excessive API calls
- **Impact**: Potential service degradation, high costs
- **Solution**:
  - Add rate limiting middleware
  - Implement per-user and per-IP limits
  - Add rate limiting for AI API calls
- **Effort**: Low
- **Files**: `src/middleware/rateLimiter.ts`

#### 5. Request/Response Optimization
- **Issue**: No compression, large response sizes
- **Impact**: Slower API responses, higher bandwidth usage
- **Solution**:
  - Add gzip compression middleware
  - Implement response size optimization
  - Add request size limits
- **Effort**: Low
- **Files**: `src/index.ts`

### 🟢 **Low Priority - Monitoring & Observability**

#### 6. Enhanced Logging & Monitoring
- **Issue**: Basic logging, no request tracking
- **Impact**: Difficult debugging and performance analysis
- **Solution**:
  - Add structured request/response logging
  - Implement request ID tracking
  - Add performance timing for API endpoints
- **Effort**: Medium
- **Files**: `src/middleware/logging.ts`

#### 7. Health Check Endpoints
- **Issue**: Basic database connection test only
- **Impact**: Limited health monitoring
- **Solution**:
  - Add comprehensive health check endpoint
  - Include database, Redis, and external service status
  - Implement readiness and liveness probes
- **Effort**: Low
- **Files**: `src/routes/healthRoutes.ts`

#### 8. Error Handling Standardization
- **Issue**: Inconsistent error responses
- **Impact**: Poor API user experience
- **Solution**:
  - Implement centralized error handling
  - Add error categorization and alerting
  - Create error response standardization
- **Effort**: Medium
- **Files**: `src/middleware/errorHandler.ts`

### 🔧 **Database Optimization**

#### 9. Advanced Indexing Strategy
- **Issue**: Basic indexes may not cover all query patterns
- **Impact**: Slow queries on complex operations
- **Solution**:
  - Add composite indexes for common query patterns
  - Implement partial indexes for filtered queries
  - Monitor index usage and optimize
- **Effort**: Medium
- **Files**: Database migration files

#### 10. Query Performance Monitoring
- **Issue**: Limited query performance visibility
- **Impact**: Hard to identify slow queries
- **Solution**:
  - Add query performance metrics
  - Implement slow query alerting
  - Create query optimization dashboard
- **Effort**: Medium
- **Files**: `src/middleware/queryMonitor.ts`

### 🚀 **Future Enhancements**

#### 11. Microservices Architecture
- **Issue**: Monolithic structure may limit scaling
- **Impact**: Difficult to scale individual components
- **Solution**:
  - Separate AI services into microservice
  - Implement service mesh
  - Add API gateway
- **Effort**: Very High
- **Files**: New service architecture

#### 12. Advanced Caching Strategies
- **Issue**: No intelligent cache invalidation
- **Impact**: Stale data, cache misses
- **Solution**:
  - Implement cache warming strategies
  - Add cache hit/miss analytics
  - Create cache optimization algorithms
- **Effort**: High
- **Files**: `src/cache/` module

### 📊 **Implementation Priority Matrix**

| Priority | Task | Impact | Effort | Timeline |
|----------|------|--------|--------|----------|
| ✅ Completed | JWT Authentication | High | Medium | Week 1-2 |
| 🔴 High | Pool Tuning | High | Medium | Week 2-3 |
| 🟡 Medium | Rate Limiting | Medium | Low | Week 3-4 |
| 🟡 Medium | Compression | Medium | Low | Week 4-5 |
| 🟡 Medium | Redis Caching | High | High | Week 5-8 |
| 🟢 Low | Health Checks | Low | Low | Week 6-7 |
| 🟢 Low | Enhanced Logging | Medium | Medium | Week 7-8 |

### 🎯 **Quick Wins (Can be implemented immediately)**

1. **Rate Limiting**: Add express-rate-limit middleware
2. **Compression**: Add compression middleware
3. **Health Checks**: Create simple health endpoint
4. **Request Logging**: Add morgan or winston logging

### 📈 **Success Metrics**

- **Database Load**: Reduce query count by 60% through caching
- **Response Time**: Achieve <200ms average API response time
- **Error Rate**: Maintain <1% error rate under load
- **Resource Usage**: Optimize memory and CPU usage by 30%
- **Scalability**: Support 1000+ concurrent users

### 🔄 **Implementation Strategy**

1. **Phase 1** (Weeks 1-4): Critical performance fixes
2. **Phase 2** (Weeks 5-8): Caching and optimization
3. **Phase 3** (Weeks 9-12): Monitoring and observability
4. **Phase 4** (Weeks 13-16): Advanced features and microservices

### 📝 **Notes**

- All improvements should be implemented with feature flags
- Performance testing should be conducted after each phase
- Monitoring should be added before optimization
- Database migrations should be tested in staging first 