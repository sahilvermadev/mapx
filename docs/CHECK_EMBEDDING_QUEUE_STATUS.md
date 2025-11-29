# How to Check Embedding Queue Status

## Quick Method: Use the Script

```bash
./scripts/check-queue-status.sh [PORT] [JWT_TOKEN]
```

Example:
```bash
./scripts/check-queue-status.sh 5000 "your-jwt-token-here"
```

## Using curl

### With Authentication Token (Required)
The endpoint requires JWT authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5000/api/recommendations/embedding-queue/status
```

### Pretty-printed with jq
```bash
curl -s -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5000/api/recommendations/embedding-queue/status | jq
```

### Pretty-printed with Python
```bash
curl -s -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:5000/api/recommendations/embedding-queue/status | python3 -m json.tool
```

### Pretty-printed JSON
```bash
curl -s http://localhost:5000/api/recommendations/embedding-queue/status | jq
```

Or without jq:
```bash
curl -s http://localhost:5000/api/recommendations/embedding-queue/status | python3 -m json.tool
```

## Expected Response

```json
{
  "success": true,
  "data": {
    "queueLength": 15,
    "processing": 2,
    "isProcessing": true
  }
}
```

### Response Fields

- **queueLength**: Number of embeddings waiting to be processed
- **processing**: Number of embeddings currently being processed
- **isProcessing**: Boolean indicating if the queue is actively processing

## Using the Script

You can also create a simple monitoring script:

```bash
#!/bin/bash
# check-queue.sh

while true; do
  clear
  echo "=== Embedding Queue Status ==="
  curl -s http://localhost:5000/api/recommendations/embedding-queue/status | jq
  echo ""
  echo "Press Ctrl+C to stop"
  sleep 2
done
```

Make it executable:
```bash
chmod +x check-queue.sh
./check-queue.sh
```

## Using Node.js/TypeScript

```typescript
import fetch from 'node-fetch';

async function checkQueueStatus() {
  const response = await fetch('http://localhost:5000/api/recommendations/embedding-queue/status');
  const data = await response.json();
  console.log('Queue Status:', data);
}

checkQueueStatus();
```

## Getting a JWT Token

To get a JWT token for authentication:

1. **Via Browser (Easiest)**:
   - Log in to your application
   - Open Browser DevTools (F12)
   - Go to Application/Storage > Cookies
   - Find `jwt_token` cookie and copy its value

2. **Via API Login**:
   ```bash
   # Login and get token
   curl -X POST http://localhost:5000/auth/google \
        -H "Content-Type: application/json" \
        -d '{"idToken": "your-google-id-token"}'
   ```

3. **Check if token is in environment**:
   ```bash
   echo $JWT_TOKEN  # If you have it set
   ```

## Notes

- The endpoint is at: `GET /api/recommendations/embedding-queue/status`
- Default port is `5000` (check your `PORT` env variable)
- **Authentication is required** - you need a valid JWT token
- The endpoint shows real-time queue status

