const axios = require('axios');

async function testEnhancedEmbeddings() {
  try {
    console.log('🧪 Testing enhanced embedding generation...');
    
    // Test search with place name
    console.log('\n📍 Testing search with place name...');
    const placeSearch = await axios.post('http://localhost:5000/api/recommendations/search', {
      query: 'reviews for Mainland China',
      limit: 5,
      threshold: 0.5
    });
    
    if (placeSearch.data.success) {
      console.log('✅ Place name search successful');
      console.log(`📊 Found ${placeSearch.data.data.total_places} places`);
      console.log(`🤖 AI Summary: ${placeSearch.data.data.summary}`);
    }
    
    // Test search with location
    console.log('\n🗺️ Testing search with location...');
    const locationSearch = await axios.post('http://localhost:5000/api/recommendations/search', {
      query: 'places in Hauz Khas',
      limit: 5,
      threshold: 0.5
    });
    
    if (locationSearch.data.success) {
      console.log('✅ Location search successful');
      console.log(`📊 Found ${locationSearch.data.data.total_places} places`);
      console.log(`🤖 AI Summary: ${locationSearch.data.data.summary}`);
    }
    
    // Test search by reviewer
    console.log('\n👤 Testing search by reviewer...');
    const reviewerSearch = await axios.post('http://localhost:5000/api/recommendations/search', {
      query: 'reviews by Sahil',
      limit: 5,
      threshold: 0.5
    });
    
    if (reviewerSearch.data.success) {
      console.log('✅ Reviewer search successful');
      console.log(`📊 Found ${reviewerSearch.data.data.total_places} places`);
      console.log(`🤖 AI Summary: ${reviewerSearch.data.data.summary}`);
    }
    
    console.log('\n🎉 Enhanced embedding tests completed!');
    
  } catch (error) {
    console.error('❌ Error testing enhanced embeddings:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the tests
testEnhancedEmbeddings(); 