# Refreshing Embeddings

## Overview

After updating the embedding generation to include freshness information, all existing recommendation embeddings need to be regenerated to include the new data.

## How to Refresh Embeddings

### Option 1: API Endpoint (Recommended)

Call the regeneration endpoint:

```bash
POST /api/recommendations/regenerate-embeddings
```

**Example using curl:**
```bash
curl -X POST http://localhost:3000/api/recommendations/regenerate-embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": 150,
    "failed": 0
  },
  "message": "Embedding regeneration complete. Success: 150, Failed: 0"
}
```

### Option 2: Direct Function Call

If you have direct access to the backend code, you can call:

```typescript
import { regenerateAllRecommendationEmbeddings } from './db/recommendations';

const result = await regenerateAllRecommendationEmbeddings();
console.log(`Success: ${result.success}, Failed: ${result.failed}`);
```

## What Gets Regenerated

The regeneration process will:

1. **Queue all recommendations** for async embedding generation
2. **Fetch full recommendation data** including:
   - All existing fields (title, description, labels, rating, etc.)
   - Place/service information (name, address, etc.)
   - User information (display name)
   - **`created_at` timestamp** (for freshness calculation)
   - Content data and metadata

3. **Generate new embeddings** with:
   - All original data
   - **Freshness information** (e.g., "Freshness: visited-11-days-ago")
   - Personal overlap placeholder (calculated at search time, not in static embeddings)

## Processing

- Embeddings are processed **asynchronously** via the embedding queue
- Processing happens in the **background** without blocking
- You can monitor queue status at: `GET /api/recommendations/embedding-queue/status`

## Important Notes

1. **Personal Overlap**: Personal overlap is **NOT** included in static embeddings (since it's user-specific). It's calculated at search time and used in hybrid reranking.

2. **Freshness**: Freshness is calculated from `created_at` or `visit_date` in `content_data` and included in the embedding text.

3. **Queue Processing**: The regeneration queues all recommendations, but actual processing happens asynchronously. Check queue status to monitor progress.

4. **No Downtime**: Regeneration doesn't block searches - old embeddings remain until new ones are generated.

## Monitoring

Check embedding queue status:

```bash
GET /api/recommendations/embedding-queue/status
```

Response:
```json
{
  "success": true,
  "data": {
    "queueLength": 45,
    "processing": 2,
    "isProcessing": true
  }
}
```

## After Regeneration

Once embeddings are regenerated:

- **Semantic search** will use embeddings with freshness information
- **Structured search** will use vector similarity for intent matching (instead of ILIKE)
- **Hybrid reranking** will boost fresh recommendations automatically



