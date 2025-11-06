# Location Picker Implementation

This document describes the implementation of the AI-powered location picker feature for the recommendation system.

## Overview

The location picker feature allows users to select precise locations using Google Maps when the AI detects that a recommendation needs location information. The AI analyzes the user's input and determines when a location picker should be offered.

## Components

### 1. AI Analysis Enhancement (`backend/src/services/recommendationAI.ts`)

- **Enhanced Interface**: Added `needsLocationPicker` field to `RecommendationAnalysis.missingFields`
- **AI Prompt**: Updated to instruct the AI to set `needsLocationPicker: true` for location-related fields
- **Field Detection**: AI automatically detects when location, address, or place information is needed

### 2. Location Picker Component (`frontend/recce_-frontend/src/components/LocationPicker.tsx`)

- **Google Maps Integration**: Uses Google Places API for location search
- **Search Interface**: Provides autocomplete search for places and addresses
- **Location Selection**: Allows users to select from search results
- **Data Return**: Returns structured location data including coordinates and Google Place ID

### 3. Backend API (`backend/src/routes/locationRoutes.ts`)

- **Search Endpoint**: `/api/location/search` - Search for places using Google Places API
- **Details Endpoint**: `/api/location/place/:placeId` - Get detailed place information
- **Authentication**: Requires user authentication for all endpoints

### 4. Recommendation Composer Integration (`frontend/recce_-frontend/src/components/RecommendationComposer.tsx`)

- **AI Detection**: Checks if current field needs location picker
- **UI Integration**: Shows "📍 Pick Location" button when needed
- **Data Handling**: Stores location data in multiple formats for backend compatibility
- **Flow Integration**: Seamlessly integrates with existing recommendation flow

## How It Works

### 1. User Input Analysis
```
User: "I found this amazing coffee shop"
AI Analysis: 
- Content Type: "place"
- Missing Fields: [
    {
      field: "location",
      question: "Where is this coffee shop located?",
      needsLocationPicker: true
    }
  ]
```

### 2. Location Picker Trigger
- When `needsLocationPicker: true`, the "📍 Pick Location" button appears
- User can either type a location or use the location picker
- Location picker opens with Google Maps search interface

### 3. Location Selection
- User searches for the location using Google Places API
- Results show place name, address, and types
- User selects the correct location
- Location data is stored with coordinates and Google Place ID

### 4. Data Storage
The location data is stored in multiple formats:
```javascript
{
  location: "Coffee Shop Name, 123 Main St",
  location_lat: 40.7128,
  location_lng: -74.0060,
  location_google_place_id: "ChIJ...",
  location_name: "Coffee Shop Name",
  location_address: "123 Main St"
}
```

## API Endpoints

### POST `/api/location/search`
Search for places using Google Places API.

**Request:**
```json
{
  "query": "coffee shop near me",
  "types": ["establishment", "geocode"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "place_id": "ChIJ...",
      "name": "Coffee Shop Name",
      "formatted_address": "123 Main St, City, State",
      "geometry": {
        "location": {
          "lat": 40.7128,
          "lng": -74.0060
        }
      },
      "types": ["cafe", "establishment", "food"]
    }
  ]
}
```

### GET `/api/location/place/:placeId`
Get detailed information for a specific place.

## Environment Variables

Add to your `.env` file:
```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## Dependencies

### Backend
- `@googlemaps/google-maps-services-js` - Google Maps API client

### Frontend
- Google Maps JavaScript API (loaded via script tag)
- Existing UI components (Button, Input, etc.)

## Usage Examples

### Example 1: Restaurant Recommendation
```
User: "This restaurant has amazing pasta"
AI: Detects place type, asks for location with picker
User: Clicks "📍 Pick Location" → Searches "Italian restaurant" → Selects location
Result: Recommendation saved with precise coordinates
```

### Example 2: Service Provider
```
User: "Great plumber, very reliable"
AI: Detects service type, asks for contact info and service area
User: For service area, clicks "📍 Pick Location" → Selects service area
Result: Service recommendation with location data
```

## Benefits

1. **Precision**: Users can select exact locations instead of typing addresses
2. **Consistency**: All location data includes coordinates and Google Place IDs
3. **User Experience**: Intuitive location selection with visual feedback
4. **Data Quality**: Structured location data improves search and recommendations
5. **AI Integration**: Seamless integration with existing AI analysis flow

## Future Enhancements

1. **Map Visualization**: Show selected location on a map
2. **Location History**: Remember recently selected locations
3. **Geofencing**: Suggest locations based on user's current location
4. **Batch Selection**: Allow multiple location selections for service areas
5. **Offline Support**: Cache location data for offline use

