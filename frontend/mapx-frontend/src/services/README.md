# API Service Layer

This directory contains the frontend API service layer that handles all communication with the backend API.

## Architecture

The API service layer follows a clean architecture pattern with:

- **Base API Client** (`api.ts`) - Handles HTTP requests, authentication, and error handling
- **Service Modules** (`recommendations.ts`) - Type-safe functions for specific API endpoints
- **Shared Types** (`../types/api.ts`) - Common TypeScript interfaces

## Files

### `api.ts`
Base API client with:
- JWT token management
- Request/response interceptors
- Automatic authentication headers
- Error handling and 401 redirects
- User authentication status checks

### `recommendations.ts`
Recommendation API functions:
- `saveRecommendation()` - Save a new recommendation
- `getMyRecommendations()` - Get user's recommendations
- `getPlaceRecommendations()` - Get recommendations for a place
- `updateRecommendation()` - Update existing recommendation
- `deleteRecommendation()` - Delete a recommendation

### `test-api.ts`
Test utilities for verifying API functionality.

## Usage

### Basic Usage

```typescript
import { apiClient } from '../services/api';
import { recommendationsApi } from '../services/recommendations';

// Check if user is authenticated
const isAuth = apiClient.isAuthenticated();

// Get current user from JWT
const user = apiClient.getCurrentUser();

// Save a recommendation
const result = await recommendationsApi.saveRecommendation({
  place_name: 'Coffee Shop',
  place_address: '123 Main St',
  notes: 'Great coffee!',
  rating: 5,
  visibility: 'friends'
});
```

### Authentication

The API client automatically:
- Extracts JWT tokens from `localStorage.getItem('authToken')`
- Adds `Authorization: Bearer <token>` headers to requests
- Handles 401 errors by redirecting to login
- Provides user information from JWT payload

### Error Handling

All API functions return consistent error responses:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

### Type Safety

All API functions are fully typed with TypeScript interfaces that match the backend API structure.

## Testing

Run the API service test in the browser console:

```javascript
// In browser console
await testApiService();
```

This will test:
- Authentication status
- User extraction from JWT
- Recommendation API calls (if authenticated)

## Integration

The API service layer is integrated with:

- **ReviewModal** - Saves reviews to the backend
- **MapPage** - Handles authentication status
- **ContentCard** - Passes place data for reviews

## Environment Variables

- `VITE_API_BASE_URL` - Backend API base URL (defaults to `http://localhost:5000/api`) 