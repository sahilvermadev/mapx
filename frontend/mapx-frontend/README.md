# recce_ Frontend

A React application with Google Maps integration for location-based recommendations.

## Setup

### Google Maps API Key

1. Get a Google Maps API key from the [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Maps JavaScript API
   - Places API (for location search)
3. Create a `.env` file in the frontend directory with:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

### Installation

```bash
npm install
npm run dev
```

## Features

- Google Maps integration
- User authentication with Google OAuth
- Location-based recommendations
- Responsive design

## Development

- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Preview**: `npm run preview`
- **Lint**: `npm run lint`
