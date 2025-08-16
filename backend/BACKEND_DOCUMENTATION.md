# MapX Backend Documentation

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
    
    annotations {
        SERIAL id PK
        INT place_id FK
        UUID user_id FK
        TEXT[] went_with
        TEXT[] labels
        TEXT notes
        JSONB metadata
        DATE visit_date
        SMALLINT rating
        TEXT visibility
        VECTOR embedding
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    media {
        SERIAL id PK
        INT place_id FK
        INT annotation_id FK
        UUID user_id FK
        TEXT url
        TEXT mime_type
        TIMESTAMPTZ created_at
    }
    
    recommendations {
        UUID id PK
        UUID owner_id FK
        VARCHAR name
        NUMERIC latitude
        NUMERIC longitude
        TEXT notes
        VARCHAR category
        VARCHAR privacy
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }
    
    likes {
        UUID user_id FK
        UUID recommendation_id FK
        TIMESTAMPTZ created_at
    }
    
    saved_recommendations {
        UUID user_id FK
        UUID recommendation_id FK
        TIMESTAMPTZ created_at
    }
    
    users ||--o{ annotations : "creates"
    users ||--o{ media : "uploads"
    users ||--o{ recommendations : "owns"
    users ||--o{ likes : "likes"
    users ||--o{ saved_recommendations : "saves"
    
    places ||--o{ annotations : "has"
    places ||--o{ media : "has"
    places }o--|| categories : "belongs_to"
    
    annotations ||--o{ media : "has"
    recommendations ||--o{ likes : "receives"
    recommendations ||--o{ saved_recommendations : "saved_by"
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

```typescript
interface DatabaseConfig {
  max: number;                    // Maximum connections in pool
  idleTimeoutMillis: number;      // Close idle connections after 30s
  connectionTimeoutMillis: number; // Connection timeout after 2s
}
```

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
    }
    
    Pool --> PoolConfig
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

### 3. Annotations Management (`src/db/annotations.ts`)

**Purpose**: CRUD operations for user reviews/recommendations with AI embedding support.

**Key Functions**:

#### `insertAnnotation(annotationData: AnnotationData): Promise<number>`
- **Purpose**: Create new annotation with optional AI embedding
- **Parameters**: Complete annotation data
- **Features**: 
  - Auto-generates embeddings if `auto_generate_embedding: true`
  - Validates rating (1-5) and visibility ('friends'|'public')
  - Transaction-based insertion

#### `getAnnotationsByPlaceId(placeId: number, visibility: string, limit: number): Promise<Annotation[]>`
- **Purpose**: Retrieve annotations for a specific place
- **Parameters**: Place ID, visibility filter, limit
- **Returns**: Array of annotations

#### `searchAnnotationsBySimilarity(embedding: number[], limit: number, threshold: number): Promise<AnnotationSearchResult[]>`
- **Purpose**: Semantic search using vector embeddings
- **Parameters**: Query embedding, limit, similarity threshold
- **Returns**: Annotations with similarity scores

#### `regenerateAllEmbeddings(): Promise<{success: number, failed: number}>`
- **Purpose**: Bulk regeneration of embeddings for all annotations
- **Features**: Batch processing, progress logging, error handling

**Class Diagram**:
```mermaid
classDiagram
    class AnnotationData {
        +place_id: number
        +user_id: string
        +went_with?: string[]
        +labels?: string[]
        +notes?: string
        +metadata?: Record~string, any~
        +visit_date?: string
        +rating?: number
        +visibility?: 'friends' | 'public'
        +embedding?: number[]
        +auto_generate_embedding?: boolean
    }
    
    class Annotation {
        +id: number
        +place_id: number
        +user_id: string
        +went_with?: string[]
        +labels?: string[]
        +notes?: string
        +metadata: Record~string, any~
        +visit_date?: string
        +rating?: number
        +visibility: 'friends' | 'public'
        +embedding?: number[]
        +created_at: Date
        +updated_at: Date
    }
    
    class AnnotationSearchResult {
        +similarity: number
    }
    
    class AnnotationsModule {
        +insertAnnotation(data: AnnotationData): Promise~number~
        +getAnnotationById(id: number): Promise~Annotation~
        +getAnnotationsByPlaceId(placeId, visibility, limit): Promise~Annotation[]~
        +getAnnotationsByUserId(userId, limit): Promise~Annotation[]~
        +updateAnnotation(id, updates): Promise~boolean~
        +deleteAnnotation(id, userId): Promise~boolean~
        +searchAnnotationsBySimilarity(embedding, limit, threshold): Promise~AnnotationSearchResult[]~
        +regenerateAnnotationEmbedding(id): Promise~void~
        +regenerateAllEmbeddings(): Promise~{success, failed}~
    }
    
    AnnotationsModule --> AnnotationData
    AnnotationsModule --> Annotation
    AnnotationSearchResult --|> Annotation
```

### 4. AI Integration (`src/utils/embeddings.ts`)

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

### 5. AI Summaries (`src/utils/aiSummaries.ts`)

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

---

## Authentication System

### Passport Configuration (`src/config/passport.ts`)

**Purpose**: Configure Google OAuth authentication with development mode support.

**Features**:
- Development mode with mock authentication
- Production Google OAuth integration
- Automatic user creation/update
- Session management

**Class Diagram**:
```mermaid
classDiagram
    class PassportConfig {
        +configurePassport(): void
        +createMockStrategy(): void
        +createGoogleStrategy(): void
    }
    
    class GoogleStrategy {
        +clientID: string
        +clientSecret: string
        +callbackURL: string
        +scope: string[]
        +verify(accessToken, refreshToken, profile, done): void
    }
    
    class MockStrategy {
        +clientID: string
        +clientSecret: string
        +callbackURL: string
        +scope: string[]
        +verify(accessToken, refreshToken, profile, done): void
    }
    
    PassportConfig --> GoogleStrategy
    PassportConfig --> MockStrategy
```

### Authentication Flow

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> DevelopmentLogin: /auth/dev-login
    Unauthenticated --> GoogleOAuth: /auth/google
    DevelopmentLogin --> Authenticated: Mock user created
    GoogleOAuth --> GoogleCallback: OAuth flow
    GoogleCallback --> Authenticated: User created/updated
    Authenticated --> Unauthenticated: /auth/logout
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

# Authentication
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

# AI Services
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key

# Application
PORT=5000
NODE_ENV=development|production
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

### Caching Strategy

1. **Embedding Cache**: Cache generated embeddings to reduce API calls
2. **Search Results**: Cache frequent search queries
3. **User Sessions**: JWT-based stateless authentication

### Scalability

1. **Horizontal Scaling**: Stateless API design
2. **Database Sharding**: Geographic partitioning for places
3. **CDN Integration**: Static asset delivery
4. **Load Balancing**: Multiple API instances

---

## Security Considerations

### Authentication Security

1. **JWT Tokens**: Secure token generation and validation
2. **OAuth 2.0**: Secure Google OAuth implementation
3. **Session Management**: Secure session handling
4. **CORS Configuration**: Proper cross-origin settings

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

### Database Monitoring

1. **Query Performance**: Monitor slow queries
2. **Connection Pool**: Monitor pool usage
3. **Index Usage**: Monitor index effectiveness

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

The MapX backend is a robust, scalable platform built with modern technologies and best practices. The combination of PostgreSQL with PostGIS and pgvector extensions, along with AI integration via OpenAI and Groq, provides a powerful foundation for location-based social recommendations.

The modular architecture, comprehensive documentation, and extensive testing strategy ensure maintainability and reliability. The system is designed to scale from development to production environments with proper security, monitoring, and performance optimization. 