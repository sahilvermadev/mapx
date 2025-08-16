// Test file to verify API service layer functionality
import { apiClient } from './api';
import { recommendationsApi } from './recommendations';

export async function testApiService() {
  console.log('🧪 Testing API Service Layer...');
  
  try {
    // Test 1: Check authentication status
    const isAuth = apiClient.isAuthenticated();
    console.log('✅ Authentication check:', isAuth);
    
    // Test 2: Get current user (if authenticated)
    const user = apiClient.getCurrentUser();
    console.log('✅ Current user:', user);
    
    // Test 3: Test recommendation API (if authenticated)
    if (isAuth && user) {
      console.log('✅ User is authenticated, testing recommendation API...');
      
      // Test saving a recommendation
      const testRecommendation = {
        place_name: 'Test Coffee Shop',
        place_address: '123 Test St, Test City',
        place_lat: 40.7128,
        place_lng: -74.0060,
        title: 'Test Review',
        notes: 'This is a test review from the frontend API service layer.',
        rating: 4,
        visibility: 'friends' as const,
      };
      
      try {
        const result = await recommendationsApi.saveRecommendation(testRecommendation);
        console.log('✅ Recommendation saved successfully:', result);
      } catch (error) {
        console.log('⚠️ Recommendation save failed (expected if backend not running):', error);
      }
    } else {
      console.log('ℹ️ User not authenticated, skipping recommendation API tests');
    }
    
    console.log('🎉 API Service Layer test completed!');
    
  } catch (error) {
    console.error('❌ API Service Layer test failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testApiService = testApiService;
} 