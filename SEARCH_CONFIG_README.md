# Search Configuration Guide

## Overview
All search parameters are now centralized in configuration files for easy tweaking and maintenance.

## Configuration Files

### Frontend Configuration
- **File**: `frontend/recce_-frontend/src/config/searchConfig.ts`
- **Purpose**: Controls frontend search behavior

### Backend Configuration  
- **File**: `backend/src/config/searchConfig.ts`
- **Purpose**: Controls backend search behavior

## Key Parameters

### 🔍 Semantic Search
```typescript
SEMANTIC_SEARCH: {
  THRESHOLD: 0.3,        // Similarity threshold (0.0-1.0)
  LIMIT: 10,             // Max results to return
  DEFAULT_CONTENT_TYPE: 'place'
}
```

**Threshold Guidelines:**
- `0.0-0.2`: Very permissive (shows loosely related results)
- `0.3-0.5`: Moderate (good balance)
- `0.6-0.8`: Strict (only very similar results)
- `0.9-1.0`: Very strict (only nearly identical results)

### 🤖 AI Summary
```typescript
AI_SUMMARY: {
  MAX_RESULTS_FOR_SUMMARY: 10,
  ENABLED: true
}
```

### 🔧 Filtering
```typescript
FILTERING: {
  ENABLE_KEYWORD_FILTERING: true,
  KEYWORD_FILTER_THRESHOLD: 0.5
}
```

### 🐛 Debug
```typescript
DEBUG: {
  ENABLE_LOGGING: true,
  LOG_SIMILARITY_SCORES: true
}
```

## How to Tweak Parameters

### 1. **Adjust Similarity Threshold**
If search returns too few results:
```typescript
THRESHOLD: 0.2  // Lower = more permissive
```

If search returns too many irrelevant results:
```typescript
THRESHOLD: 0.5  // Higher = more strict
```

### 2. **Adjust Result Limit**
```typescript
LIMIT: 20  // Return more results
```

### 3. **Enable/Disable Features**
```typescript
AI_SUMMARY: {
  ENABLED: false  // Disable AI summaries
}

FILTERING: {
  ENABLE_KEYWORD_FILTERING: false  // Disable keyword filtering
}
```

## Common Scenarios

### Scenario 1: "No results found" 
**Problem**: Search returns 0 results
**Solution**: Lower the threshold
```typescript
THRESHOLD: 0.1  // Very permissive
```

### Scenario 2: "Too many irrelevant results"
**Problem**: Search returns irrelevant matches
**Solution**: Raise the threshold
```typescript
THRESHOLD: 0.6  // More strict
```

### Scenario 3: "AI summary not using results"
**Problem**: AI summary shows fallback message
**Solution**: Check if results are being filtered out
```typescript
FILTERING: {
  ENABLE_KEYWORD_FILTERING: false  // Disable strict filtering
}
```

## Testing Changes

1. **Update the configuration file**
2. **Restart the backend server** (if backend config changed)
3. **Refresh the frontend** (if frontend config changed)
4. **Test with a search query**
5. **Check the logs** for similarity scores and results

## Logs to Watch

Look for these log messages:
- `🔍 Search parameters: { threshold: 0.3, limit: 10 }`
- `📊 [DB] Query returned X rows`
- `📊 Similarity scores: [...]`
- `🤖 AI Summary generated successfully`

## Best Practices

1. **Start with moderate settings** (threshold: 0.3-0.4)
2. **Test with real queries** from your users
3. **Monitor the logs** to understand what's happening
4. **Adjust gradually** - don't make big jumps
5. **Document changes** when you find good settings

## Troubleshooting

### Still getting 0 results?
1. Check if users are following each other
2. Check if recommendations have embeddings
3. Lower threshold to 0.1
4. Check database logs for query issues

### AI summary still shows fallback?
1. Check if search results are being returned
2. Check if results are being filtered out
3. Disable keyword filtering temporarily
4. Check AI summary logs

### Too many irrelevant results?
1. Raise the threshold
2. Enable keyword filtering
3. Check similarity scores in logs


