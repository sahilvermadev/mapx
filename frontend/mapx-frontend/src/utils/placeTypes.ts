// Helper function to get the primary Google Places type
export const getPrimaryGoogleType = (types: string[]): string => {
  if (!types || types.length === 0) return 'establishment';
  
  // Priority order for primary type selection
  const priorityTypes = [
    'restaurant', 'bar', 'cafe', 'night_club', 'lodging', 'hotel',
    'bakery', 'meal_takeaway', 'meal_delivery', 'food',
    'store', 'shopping_mall', 'department_store',
    'park', 'museum', 'art_gallery', 'tourist_attraction',
    'gym', 'spa', 'beauty_salon',
    'school', 'university', 'library',
    'hospital', 'doctor', 'dentist', 'pharmacy',
    'bank', 'post_office', 'police', 'fire_station'
  ];
  
  // Find the first type that matches our priority list
  for (const priorityType of priorityTypes) {
    if (types.includes(priorityType)) {
      return priorityType;
    }
  }
  
  // If no priority type found, return the first non-generic type
  const genericTypes = ['establishment', 'point_of_interest', 'place_of_interest'];
  for (const type of types) {
    if (!genericTypes.includes(type)) {
      return type;
    }
  }
  
  return types[0] || 'establishment';
};

// Helper function to format Google Places types for display
export const formatGoogleTypeForDisplay = (type: string): string => {
  const typeFormats: Record<string, string> = {
    'restaurant': 'Restaurant',
    'bar': 'Bar',
    'cafe': 'Cafe',
    'night_club': 'Night Club',
    'lodging': 'Lodging',
    'hotel': 'Hotel',
    'bakery': 'Bakery',
    'meal_takeaway': 'Takeaway',
    'meal_delivery': 'Food Delivery',
    'food': 'Food',
    'store': 'Store',
    'shopping_mall': 'Shopping Mall',
    'department_store': 'Department Store',
    'park': 'Park',
    'museum': 'Museum',
    'art_gallery': 'Art Gallery',
    'tourist_attraction': 'Tourist Attraction',
    'gym': 'Gym',
    'spa': 'Spa',
    'beauty_salon': 'Beauty Salon',
    'school': 'School',
    'university': 'University',
    'library': 'Library',
    'hospital': 'Hospital',
    'doctor': 'Doctor',
    'dentist': 'Dentist',
    'pharmacy': 'Pharmacy',
    'bank': 'Bank',
    'post_office': 'Post Office',
    'police': 'Police Station',
    'fire_station': 'Fire Station',
    'establishment': 'Establishment',
    'point_of_interest': 'Point of Interest'
  };
  
  return typeFormats[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Common Google Places types for filtering
export const COMMON_GOOGLE_PLACES_TYPES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'bar', label: 'Bar' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'night_club', label: 'Night Club' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'meal_takeaway', label: 'Takeaway' },
  { value: 'meal_delivery', label: 'Food Delivery' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'store', label: 'Store' },
  { value: 'shopping_mall', label: 'Shopping Mall' },
  { value: 'department_store', label: 'Department Store' },
  { value: 'park', label: 'Park' },
  { value: 'museum', label: 'Museum' },
  { value: 'art_gallery', label: 'Art Gallery' },
  { value: 'tourist_attraction', label: 'Tourist Attraction' },
  { value: 'gym', label: 'Gym' },
  { value: 'spa', label: 'Spa' },
  { value: 'beauty_salon', label: 'Beauty Salon' },
  { value: 'school', label: 'School' },
  { value: 'university', label: 'University' },
  { value: 'library', label: 'Library' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'bank', label: 'Bank' },
  { value: 'post_office', label: 'Post Office' },
  { value: 'police', label: 'Police Station' },
  { value: 'fire_station', label: 'Fire Station' },
  { value: 'establishment', label: 'Establishment' }
]; 