# GPS-Based Location Search Implementation

## Problem with Stored Coordinates

The initial implementation attempted to store `current_coordinates` in the database, which has several issues:

1. **Privacy Concerns**: Constantly tracking user location raises privacy issues
2. **Battery Drain**: Continuous location updates drain mobile device batteries
3. **Stale Data**: Stored coordinates become outdated as users travel
4. **Database Overhead**: Frequent updates create unnecessary database load
5. **User Control**: Users may not want to share their location persistently

## Solution: On-Demand GPS Coordinates

The improved implementation uses **on-demand GPS coordinates** from the browser's geolocation API:

### How It Works

1. **User Searches**: When a user searches with "near me" intent (e.g., "quiet café near me", "restaurants nearby")

2. **Frontend Detection**: The frontend detects "near me" keywords using `isNearMeQuery()`:
   - "near me"
   - "nearby"
   - "close to me"
   - "around me"
   - "local"
   - "in my area"

3. **Get GPS On-Demand**: Frontend calls `getCurrentLocation()` which:
   - Uses browser's `navigator.geolocation.getCurrentPosition()`
   - Gets fresh coordinates at search time
   - Accepts cached location up to 1 minute old (for performance)
   - Returns `null` if user denies permission or location unavailable

4. **Pass to Backend**: GPS coordinates are included in the search request:
   ```typescript
   {
     query: "quiet café near me",
     user_lat: 28.6139,
     user_lng: 77.2090
   }
   ```

5. **Backend Processing**: 
   - Function calling LLM sees "near me" and sets `location: null`
   - Backend receives `user_lat` and `user_lng` from request
   - Uses these coordinates for 15km radius search
   - No database lookup needed

### Benefits

✅ **Privacy-Friendly**: Location only shared when user explicitly searches "near me"
✅ **Always Fresh**: Coordinates are current at search time, not stale
✅ **No Battery Drain**: Only requests location when needed, not continuously
✅ **User Control**: User can deny location permission and search still works (without location filter)
✅ **No Database Updates**: No need to constantly update user coordinates
✅ **Graceful Degradation**: If GPS unavailable, search proceeds without location filter

### Implementation Details

#### Frontend (`frontend/mapx-frontend/src/utils/geolocation.ts`)
- `getCurrentLocation()`: Gets GPS coordinates from browser
- `isNearMeQuery()`: Detects "near me" intent in search query
- Handles permission denial gracefully

#### Backend (`backend/src/services/structuredSearch.ts`)
- `resolveLocation()`: Accepts GPS coordinates from request
- Priority: string location → GPS coordinates → no location filter
- Uses 15km radius for GPS, 50km for geocoded locations

#### Function Calling (`backend/src/config/searchTools.ts`)
- Tool accepts `user_lat` and `user_lng` parameters
- LLM can use these when `location: null` is set for "near me" searches

### Example Flow

```
User types: "quiet café near me"
  ↓
Frontend detects "near me" → calls getCurrentLocation()
  ↓
Browser requests GPS permission (if not already granted)
  ↓
GPS coordinates: { lat: 28.6139, lng: 77.2090 }
  ↓
Frontend sends to backend:
  {
    query: "quiet café near me",
    user_lat: 28.6139,
    user_lng: 77.2090
  }
  ↓
LLM function calling sets: location: null
  ↓
Backend uses user_lat/user_lng for 15km radius search
  ↓
Returns results within 15km of user's current location
```

### Migration Notes

**No database migration needed** - The GPS search uses on-demand coordinates from the browser, not stored database fields. This keeps the implementation:
- Privacy-friendly (no location tracking)
- Always fresh (coordinates from current search)
- Simple (no database overhead)

If you need stored location fields for other features (e.g., user profile default city), create a separate migration for that specific use case.

### Best Practices

1. **Always request location on-demand** when user searches "near me"
2. **Don't store GPS coordinates** unless user explicitly opts in
3. **Handle permission denial gracefully** - search should still work
4. **Use cached location** (up to 1 minute old) for better performance
5. **Clear coordinates** after search completes (don't persist in frontend state)

