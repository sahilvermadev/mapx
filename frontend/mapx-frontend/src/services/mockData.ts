import type { UserData, UserStats, PlaceCard } from './profile';

// Mock user data
export const mockUserData: UserData = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  displayName: 'John Doe',
  email: 'john.doe@example.com',
  profilePictureUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  created_at: '2024-01-15T10:30:00Z',
  last_login_at: '2024-12-11T14:22:00Z'
};

// Mock user stats
export const mockUserStats: UserStats = {
  total_recommendations: 24,
  total_likes: 156,
  total_saved: 89,
  average_rating: 4.2,
  total_places_visited: 67,
  total_reviews: 24
};

// Mock place cards
export const mockPlaceCards: PlaceCard[] = [
  {
    id: '1',
    place_name: 'Central Park Cafe',
    place_address: '123 Main St, New York, NY',
    category: 'cafe',
    rating: 5,
    notes: 'Amazing coffee and pastries! The outdoor seating is perfect for people watching.',
    visit_date: '2024-12-01',
    visibility: 'public',
    created_at: '2024-12-01T10:30:00Z',
    place_lat: 40.7589,
    place_lng: -73.9851,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    user_name: 'John Doe',
    title: 'Perfect morning spot',
    labels: ['Good for dates', 'Outdoor seating', 'Quick service']
  },
  {
    id: '2',
    place_name: 'Brooklyn Bridge Park',
    place_address: '334 Furman St, Brooklyn, NY',
    category: 'park',
    rating: 4,
    notes: 'Beautiful views of Manhattan skyline. Great for sunset walks.',
    visit_date: '2024-11-28',
    visibility: 'friends',
    created_at: '2024-11-28T16:45:00Z',
    place_lat: 40.7021,
    place_lng: -73.9969,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY5',
    user_name: 'John Doe',
    title: 'Sunset views',
    labels: ['Family friendly', 'Outdoor seating']
  },
  {
    id: '3',
    place_name: 'The Metropolitan Museum of Art',
    place_address: '1000 5th Ave, New York, NY',
    category: 'museum',
    rating: 5,
    notes: 'Incredible collection. Spent hours exploring the Egyptian wing.',
    visit_date: '2024-11-25',
    visibility: 'public',
    created_at: '2024-11-25T12:15:00Z',
    place_lat: 40.7794,
    place_lng: -73.9632,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY6',
    user_name: 'John Doe',
    title: 'Art lover\'s paradise',
    labels: ['Family friendly', 'Work-friendly']
  },
  {
    id: '4',
    place_name: 'Joe\'s Pizza',
    place_address: '123 Bleecker St, New York, NY',
    category: 'restaurant',
    rating: 4,
    notes: 'Classic NYC pizza. Thin crust, perfect sauce.',
    visit_date: '2024-11-20',
    visibility: 'friends',
    created_at: '2024-11-20T19:30:00Z',
    place_lat: 40.7308,
    place_lng: -73.9973,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY7',
    user_name: 'John Doe',
    title: 'Best pizza in the city',
    labels: ['Budget', 'Quick service']
  },
  {
    id: '5',
    place_name: 'High Line Park',
    place_address: '820 Washington St, New York, NY',
    category: 'park',
    rating: 5,
    notes: 'Unique elevated park with great city views. Perfect for a leisurely stroll.',
    visit_date: '2024-11-15',
    visibility: 'public',
    created_at: '2024-11-15T14:20:00Z',
    place_lat: 40.7484,
    place_lng: -74.0047,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY8',
    user_name: 'John Doe',
    title: 'Urban oasis',
    labels: ['Family friendly', 'Outdoor seating']
  }
];

// Mock data for different tabs
export const mockLikesData: PlaceCard[] = [
  {
    id: 'like1',
    place_name: 'Blue Bottle Coffee',
    place_address: '450 W 15th St, New York, NY',
    category: 'cafe',
    rating: 4,
    visit_date: '2024-12-05',
    visibility: 'public',
    created_at: '2024-12-05T09:15:00Z',
    place_lat: 40.7411,
    place_lng: -74.0047,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY9'
  },
  {
    id: 'like2',
    place_name: 'Times Square',
    place_address: 'Manhattan, NY 10036',
    category: 'tourist_attraction',
    rating: 3,
    visit_date: '2024-12-03',
    visibility: 'public',
    created_at: '2024-12-03T20:30:00Z',
    place_lat: 40.7580,
    place_lng: -73.9855,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY10'
  }
];

export const mockSavedData: PlaceCard[] = [
  {
    id: 'saved1',
    place_name: 'Katz\'s Delicatessen',
    place_address: '205 E Houston St, New York, NY',
    category: 'restaurant',
    rating: 4,
    visit_date: '2024-12-08',
    visibility: 'friends',
    created_at: '2024-12-08T12:45:00Z',
    place_lat: 40.7223,
    place_lng: -73.9874,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY11'
  },
  {
    id: 'saved2',
    place_name: 'Chelsea Market',
    place_address: '75 9th Ave, New York, NY',
    category: 'shopping',
    rating: 4,
    visit_date: '2024-12-06',
    visibility: 'public',
    created_at: '2024-12-06T15:20:00Z',
    place_lat: 40.7421,
    place_lng: -74.0049,
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY12'
  }
]; 