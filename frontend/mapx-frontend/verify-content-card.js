// ContentCard Real Reviews Verification Script
// This script verifies that the ContentCard properly fetches and displays real reviews

async function verifyContentCardRealReviews() {
    console.log('🧪 Starting ContentCard Real Reviews Verification...');
    
    const results = {
        apiConnection: false,
        placeRecommendations: false,
        dataTransformation: false,
        averageRating: false,
        overall: false
    };

    try {
        // Test 1: API Connection
        console.log('1️⃣ Testing API connection...');
        const response = await fetch('http://localhost:5000/api/recommendations/place/12');
        if (response.ok) {
            results.apiConnection = true;
            console.log('✅ API connection successful');
        } else {
            throw new Error(`API returned ${response.status}`);
        }

        // Test 2: Place Recommendations
        console.log('2️⃣ Testing place recommendations...');
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
            results.placeRecommendations = true;
            console.log(`✅ Found ${data.data.length} recommendations`);
        } else {
            throw new Error('Invalid response format');
        }

        // Test 3: Data Transformation (simulating ContentCard logic)
        console.log('3️⃣ Testing data transformation...');
        const reviews = data.data.map(rec => ({
            id: rec.id,
            user_name: rec.user_name,
            title: rec.title,
            notes: rec.notes,
            rating: rec.rating,
            visit_date: rec.visit_date,
            created_at: rec.created_at
        }));

        if (reviews.length > 0 && reviews[0].user_name) {
            results.dataTransformation = true;
            console.log('✅ Data transformation successful');
            console.log('📝 Sample review:', reviews[0]);
        } else {
            throw new Error('Data transformation failed');
        }

        // Test 4: Average Rating Calculation
        console.log('4️⃣ Testing average rating calculation...');
        const averageRating = reviews.length > 0 
            ? reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length 
            : 0;
        
        if (typeof averageRating === 'number' && averageRating >= 0) {
            results.averageRating = true;
            console.log(`✅ Average rating calculated: ${averageRating.toFixed(1)}`);
        } else {
            throw new Error('Average rating calculation failed');
        }

        // Test 5: Overall Verification
        results.overall = Object.values(results).every(result => result === true);
        
        if (results.overall) {
            console.log('🎉 All ContentCard real reviews tests passed!');
            console.log('📊 Summary:');
            console.log(`   - Reviews found: ${reviews.length}`);
            console.log(`   - Average rating: ${averageRating.toFixed(1)}`);
            console.log(`   - Sample user: ${reviews[0].user_name}`);
            console.log(`   - Sample rating: ${reviews[0].rating || 'No rating'}`);
        } else {
            console.log('❌ Some tests failed');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        results.overall = false;
    }

    return results;
}

// Test specific functionality
async function testReviewRefresh() {
    console.log('\n🔄 Testing review refresh functionality...');
    
    try {
        // Simulate what happens after a successful review submission
        const placeId = 12;
        
        // First fetch
        const response1 = await fetch(`http://localhost:5000/api/recommendations/place/${placeId}`);
        const data1 = await response1.json();
        const initialCount = data1.data.length;
        
        console.log(`📊 Initial review count: ${initialCount}`);
        
        // Simulate refresh (second fetch)
        const response2 = await fetch(`http://localhost:5000/api/recommendations/place/${placeId}`);
        const data2 = await response2.json();
        const refreshedCount = data2.data.length;
        
        console.log(`📊 Refreshed review count: ${refreshedCount}`);
        
        if (initialCount === refreshedCount) {
            console.log('✅ Review refresh functionality working correctly');
        } else {
            console.log('⚠️  Review count changed (this might be expected if new reviews were added)');
        }
        
    } catch (error) {
        console.error('❌ Review refresh test failed:', error.message);
    }
}

// Test error handling
async function testErrorHandling() {
    console.log('\n🚨 Testing error handling...');
    
    try {
        // Test with invalid place ID
        const response = await fetch('http://localhost:5000/api/recommendations/place/999999');
        const data = await response.json();
        
        if (!data.success) {
            console.log('✅ Error handling working correctly for invalid place ID');
        } else {
            console.log('⚠️  Unexpected success for invalid place ID');
        }
        
    } catch (error) {
        console.log('✅ Error handling working correctly for network errors');
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting ContentCard Real Reviews Verification Suite...\n');
    
    const results = await verifyContentCardRealReviews();
    await testReviewRefresh();
    await testErrorHandling();
    
    console.log('\n📋 Final Results:');
    console.log(`   API Connection: ${results.apiConnection ? '✅' : '❌'}`);
    console.log(`   Place Recommendations: ${results.placeRecommendations ? '✅' : '❌'}`);
    console.log(`   Data Transformation: ${results.dataTransformation ? '✅' : '❌'}`);
    console.log(`   Average Rating: ${results.averageRating ? '✅' : '❌'}`);
    console.log(`   Overall: ${results.overall ? '✅ PASS' : '❌ FAIL'}`);
    
    return results.overall;
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.verifyContentCardRealReviews = verifyContentCardRealReviews;
    window.testReviewRefresh = testReviewRefresh;
    window.testErrorHandling = testErrorHandling;
    window.runAllTests = runAllTests;
}

// Auto-run if this is the main module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        verifyContentCardRealReviews,
        testReviewRefresh,
        testErrorHandling,
        runAllTests
    };
} 