import express from 'express';
import { Client } from '@googlemaps/google-maps-services-js';

const router = express.Router();

// Initialize Google Maps client
const googleMapsClient = new Client({});

// Temporary auth middleware (replace with your actual auth)
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const currentUserId = req.body.currentUserId || req.query.currentUserId;
  if (!currentUserId) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  req.user = { id: currentUserId };
  next();
};

/**
 * POST /api/location/search
 * Search for places using Google Places API
 */
router.post('/search', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { query, types = ['establishment', 'geocode'] } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required and must be a string' 
      });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'Google Maps API key not configured' 
      });
    }

    // Search for places using Google Places Autocomplete API (server-side)
    // Note: Autocomplete does not support 'fields' param; details are fetched in a second call below
    const response = await googleMapsClient.placeAutocomplete({
      params: {
        input: query.trim(),
        key: process.env.GOOGLE_MAPS_API_KEY,
      }
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', response.data.status);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to search for places' 
      });
    }

    const predictions = response.data.predictions || [];
    
    // Get detailed information for each prediction
    const detailedPlaces = await Promise.all(
      predictions.slice(0, 5).map(async (prediction: any) => {
        try {
          const detailsResponse = await googleMapsClient.placeDetails({
            params: {
              place_id: prediction.place_id!,
              key: process.env.GOOGLE_MAPS_API_KEY!,
              fields: ['place_id', 'name', 'formatted_address', 'geometry', 'types', 'photos']
            }
          });

          if (detailsResponse.data.status === 'OK' && detailsResponse.data.result) {
            const place = detailsResponse.data.result;
            return {
              place_id: place.place_id,
              name: place.name || '',
              formatted_address: place.formatted_address || '',
              geometry: {
                location: {
                  lat: place.geometry?.location?.lat || 0,
                  lng: place.geometry?.location?.lng || 0
                }
              },
              types: place.types || [],
              photos: place.photos?.slice(0, 3).map((photo: any) => ({
                photo_reference: photo.photo_reference,
                height: photo.height,
                width: photo.width
              })) || []
            };
          }
          return null;
        } catch (error) {
          console.error('Error getting place details:', error);
          return null;
        }
      })
    );

    // Filter out null results
    const validPlaces = detailedPlaces.filter(place => place !== null);

    res.json({
      success: true,
      data: validPlaces
    });

  } catch (error) {
    console.error('Error searching for places:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search for places' 
    });
  }
});

/**
 * GET /api/location/place/:placeId
 * Get detailed information for a specific place
 */
router.get('/place/:placeId', requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { placeId } = req.params;
    
    if (!placeId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Place ID is required' 
      });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'Google Maps API key not configured' 
      });
    }

    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_MAPS_API_KEY,
        fields: [
          'place_id', 
          'name', 
          'formatted_address', 
          'geometry', 
          'types', 
          'photos',
          'rating',
          'user_ratings_total',
          'price_level',
          'opening_hours',
          'website',
          'formatted_phone_number'
        ]
      }
    });

    if (response.data.status !== 'OK') {
      return res.status(404).json({ 
        success: false, 
        error: 'Place not found' 
      });
    }

    const place: any = response.data.result;
    
    res.json({
      success: true,
      data: {
        place_id: place.place_id,
        name: place.name || '',
        formatted_address: place.formatted_address || '',
        geometry: {
          location: {
            lat: place.geometry?.location?.lat || 0,
            lng: place.geometry?.location?.lng || 0
          }
        },
        types: place.types || [],
        rating: place.rating,
        user_ratings_total: place.user_ratings_total,
        price_level: place.price_level,
        opening_hours: place.opening_hours,
        website: place.website,
        formatted_phone_number: place.formatted_phone_number,
        photos: place.photos?.slice(0, 5).map((photo: any) => ({
          photo_reference: photo.photo_reference,
          height: photo.height,
          width: photo.width
        })) || []
      }
    });

  } catch (error) {
    console.error('Error getting place details:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get place details' 
    });
  }
});

export default router;
