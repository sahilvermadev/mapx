# MapX Semantic Search Implementation

## Overview

This document describes the implementation of semantic search functionality in MapX, which allows users to search for places using natural language queries like "What's the best cafe with wifi that I can work in Hauz Khas?"

## Architecture

### Backend Components

#### 1. Embedding Infrastructure (`backend/src/utils/embeddings.ts`)

The semantic search is powered by OpenAI's text-embedding-ada-002 model, which generates 1536-dimensional vector embeddings for text content.

**Key Functions:**
- `generateEmbedding(text: string)`: Generates embeddings for simple text
- `generateAnnotationEmbedding(annotationData)`: Creates embeddings from review data
- `generateSearchEmbedding(searchText)`: Generates embeddings for search queries
- `calculateCosineSimilarity(embedding1, embedding2)`: Computes similarity between embeddings

#### 2. Database Schema

The `annotations` table includes a `VECTOR(1536)` column to store embeddings:

```sql
CREATE TABLE annotations (
  -- ... other fields ...
  embedding: VECTOR(1536),  -- Stores OpenAI embeddings
  -- ... other fields ...
);
```

#### 3. Search API (`backend/src/routes/recommendationRoutes.ts`)

**Endpoint:** `POST /api/recommendations/search`

**Request Body:**
```json
{
  "query": "best cafe with wifi in Hauz Khas",
  "limit": 10,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "best cafe with wifi in Hauz Khas",
    "summary": "Based on 3 recommendation(s), \"Cafe XYZ\" seems to match your search. Users say: \"Great wifi and quiet atmosphere perfect for work...\"",
    "results": [
      {
        "place_id": 123,
        "place_name": "Cafe XYZ",
        "place_address": "Hauz Khas, Delhi",
        "recommendations": [...],
        "average_similarity": 0.85,
        "total_recommendations": 3
      }
    ],
    "total_places": 5,
    "total_recommendations": 12
  }
}
```

### Frontend Components

#### 1. Enhanced SearchBar (`frontend/src/components/SearchBar.tsx`)

The SearchBar now supports two modes:
- **Places Mode**: Traditional Google Places autocomplete
- **AI Search Mode**: Semantic search using natural language

**Features:**
- Toggle between search modes
- Real-time search suggestions
- Loading states and error handling

#### 2. SearchResults Component (`frontend/src/components/SearchResults.tsx`)

A modal component that displays semantic search results with:
- Search summary and statistics
- Place cards with similarity scores
- Recommendation previews
- Interactive place selection

#### 3. Updated MapPage (`frontend/src/pages/MapPage.tsx`)

Integrates semantic search with the main map interface:
- Handles search results display
- Converts search results to place details
- Manages search state and loading

## How It Works

### 1. Embedding Generation

When users create reviews, the system automatically generates embeddings:

```typescript
// Example annotation data
const annotationData = {
  notes: "Great coffee shop with excellent wifi for working",
  labels: ["Work-friendly", "Good wifi", "Quiet"],
  rating: 5,
  // ... other fields
};

// Generate embedding
const embedding = await generateAnnotationEmbedding(annotationData);
```

### 2. Search Process

1. **Query Processing**: User enters natural language query
2. **Embedding Generation**: Query is converted to embedding vector
3. **Vector Search**: Database finds similar annotations using cosine similarity
4. **Result Grouping**: Results are grouped by place to avoid duplicates
5. **Summary Generation**: AI generates contextual summary of results

### 3. Similarity Calculation

Uses cosine similarity to find the most relevant places:

```sql
SELECT *, 1 - (embedding <=> $1) as similarity
FROM annotations 
WHERE embedding IS NOT NULL 
  AND 1 - (embedding <=> $1) > $2
ORDER BY embedding <=> $1
LIMIT $3
```

## Usage Examples

### Example Queries

1. **Location-specific**: "best cafe with wifi in Hauz Khas"
2. **Activity-based**: "quiet restaurant good for dates"
3. **Feature-focused**: "family friendly places with outdoor seating"
4. **Work-related**: "coffee shops good for working remotely"
5. **Entertainment**: "restaurants with live music"

### User Interface

1. **Toggle Search Mode**: Users can switch between "Places" and "AI Search"
2. **Natural Language Input**: Type queries in plain English
3. **Results Display**: See relevant places with similarity scores
4. **Place Selection**: Click on results to view detailed place information

## Technical Requirements

### Backend Dependencies

- **OpenAI API**: For embedding generation
- **pgvector**: PostgreSQL extension for vector operations
- **Node.js**: Runtime environment

### Environment Variables

```bash
OPENAI_API_KEY=your_openai_api_key
```

### Database Setup

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to annotations table
ALTER TABLE annotations ADD COLUMN embedding VECTOR(1536);
```

## Performance Considerations

### Embedding Generation
- **Caching**: Consider caching embeddings for frequently searched terms
- **Batch Processing**: Generate embeddings in background jobs for large datasets
- **Rate Limiting**: Implement rate limiting for OpenAI API calls

### Search Performance
- **Indexing**: Ensure proper indexing on embedding column
- **Threshold Tuning**: Adjust similarity threshold based on data quality
- **Result Limiting**: Limit results to prevent performance issues

## Testing

### Test File
Use `frontend/mapx-frontend/test-semantic-search.html` to test the API directly.

### Example Test Queries
1. "best cafe with wifi in Hauz Khas"
2. "quiet restaurant good for dates"
3. "family friendly places with outdoor seating"

## Future Enhancements

### Potential Improvements

1. **Query Expansion**: Expand search terms for better matching
2. **Personalization**: Consider user preferences in search results
3. **Geographic Filtering**: Add location-based filtering
4. **Multi-language Support**: Support for multiple languages
5. **Advanced Filters**: Add filters for rating, price, etc.

### Advanced Features

1. **Conversational Search**: Support for follow-up questions
2. **Image Search**: Search based on uploaded photos
3. **Voice Search**: Voice-to-text search functionality
4. **Recommendation Engine**: Suggest similar places based on search history

## Troubleshooting

### Common Issues

1. **No Results**: Check if embeddings are being generated properly
2. **Low Similarity Scores**: Adjust threshold or improve query quality
3. **API Errors**: Verify OpenAI API key and rate limits
4. **Performance Issues**: Check database indexing and query optimization

### Debug Information

Enable debug logging to troubleshoot issues:

```typescript
console.log('Search query:', query);
console.log('Generated embedding length:', embedding.length);
console.log('Search results:', results);
```

## Conclusion

The semantic search implementation provides a powerful, user-friendly way to discover places using natural language. The combination of OpenAI embeddings, vector similarity search, and intuitive UI creates a modern search experience that understands user intent and provides relevant results. 