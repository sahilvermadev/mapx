import { upsertPlace, getPlaceById, getPlaceByGoogleId, searchPlacesNearby } from './places';

// Example usage of upsertPlace function
async function exampleUsage() {
  try {
    // Example 1: Create a new place with Google Place ID
    const placeId1 = await upsertPlace({
      google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      name: 'Sydney Opera House',
      address: 'Bennelong Point, Sydney NSW 2000, Australia',
      lat: -33.8568,
      lng: 151.2153,
      metadata: {
        type: 'landmark',
        architecture: 'expressionist',
        year_built: 1973
      }
    });
    console.log('Created/Updated place with ID:', placeId1);

    // Example 2: Update existing place (same google_place_id)
    const placeId2 = await upsertPlace({
      google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      name: 'Sydney Opera House',
      address: 'Bennelong Point, Sydney NSW 2000, Australia',
      lat: -33.8568,
      lng: 151.2153,
      metadata: {
        type: 'landmark',
        architecture: 'expressionist',
        year_built: 1973,
        updated_info: 'Added more metadata'
      }
    });
    console.log('Updated place with ID:', placeId2); // Same ID as placeId1

    // Example 3: Create place without Google Place ID
    const placeId3 = await upsertPlace({
      name: 'Local Coffee Shop',
      address: '123 Main St, City',
      lat: -33.8568,
      lng: 151.2153,
      metadata: {
        type: 'cafe',
        wifi: true,
        outdoor_seating: true
      }
    });
    console.log('Created new place with ID:', placeId3);

    // Example 4: Get place by ID
    const place = await getPlaceById(placeId1);
    console.log('Retrieved place:', place);

    // Example 5: Get place by Google Place ID
    const placeByGoogleId = await getPlaceByGoogleId('ChIJN1t_tDeuEmsRUsoyG83frY4');
    console.log('Retrieved place by Google ID:', placeByGoogleId);

    // Example 6: Search places nearby
    const nearbyPlaces = await searchPlacesNearby(-33.8568, 151.2153, 1000, 10);
    console.log('Nearby places:', nearbyPlaces);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run the example
// exampleUsage(); 