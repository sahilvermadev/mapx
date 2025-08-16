"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const annotations_1 = require("./annotations");
const places_1 = require("./places");
// Example usage of annotation functions
async function exampleUsage() {
    try {
        // First, create a place to reference
        const placeId = await (0, places_1.upsertPlace)({
            google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
            name: 'Sydney Opera House',
            address: 'Bennelong Point, Sydney NSW 2000, Australia',
            lat: -33.8568,
            lng: 151.2153,
            metadata: {
                type: 'landmark',
                architecture: 'expressionist'
            }
        });
        console.log('Created place with ID:', placeId);
        // Example user ID (UUID)
        const userId = '550e8400-e29b-41d4-a716-446655440000';
        // Example 1: Insert annotation without embedding
        const annotationId1 = await (0, annotations_1.insertAnnotation)({
            place_id: placeId,
            user_id: userId,
            title: 'Amazing Architecture',
            went_with: ['Sarah', 'Mike'],
            labels: ['Landmark', 'Architecture', 'Tourist Spot'],
            notes: 'The Sydney Opera House is absolutely breathtaking. The architecture is incredible and the views are spectacular.',
            metadata: {
                visit_type: 'sightseeing',
                weather: 'sunny',
                crowd_level: 'moderate'
            },
            visit_date: '2024-01-15',
            rating: 5,
            visibility: 'public'
        });
        console.log('Created annotation with ID:', annotationId1);
        // Example 2: Insert annotation with vector embedding (mock 1536-dimensional vector)
        const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());
        const annotationId2 = await (0, annotations_1.insertAnnotation)({
            place_id: placeId,
            user_id: userId,
            title: 'Cultural Experience',
            went_with: ['Family'],
            labels: ['Culture', 'Arts', 'Educational'],
            notes: 'Attended a performance here. The acoustics are phenomenal and the cultural experience was enriching.',
            metadata: {
                visit_type: 'performance',
                show_type: 'opera',
                seating: 'orchestra'
            },
            visit_date: '2024-02-20',
            rating: 5,
            visibility: 'friends',
            embedding: mockEmbedding
        });
        console.log('Created annotation with embedding, ID:', annotationId2);
        // Example 3: Insert annotation with AUTO-GENERATED embedding (NEW FEATURE!)
        const annotationId3 = await (0, annotations_1.insertAnnotation)({
            place_id: placeId,
            user_id: userId,
            title: 'Coffee Shop Review',
            went_with: ['Colleague'],
            labels: ['Coffee', 'Work-friendly', 'WiFi'],
            notes: 'Great coffee and atmosphere. Perfect for working remotely with excellent WiFi and comfortable seating.',
            metadata: {
                visit_type: 'work',
                wifi: true,
                seating: 'comfortable',
                noise_level: 'low'
            },
            visit_date: '2024-03-10',
            rating: 4,
            visibility: 'public',
            auto_generate_embedding: true // This will automatically generate an embedding using OpenAI
        });
        console.log('Created annotation with AUTO-GENERATED embedding, ID:', annotationId3);
        // Example 4: Get annotation by ID
        const annotation = await (0, annotations_1.getAnnotationById)(annotationId1);
        console.log('Retrieved annotation:', annotation);
        // Example 5: Get annotations for a place
        const placeAnnotations = await (0, annotations_1.getAnnotationsByPlaceId)(placeId, 'all', 10);
        console.log('Annotations for place:', placeAnnotations.length);
        // Example 6: Get annotations by user
        const userAnnotations = await (0, annotations_1.getAnnotationsByUserId)(userId, 10);
        console.log('User annotations:', userAnnotations.length);
        // Example 7: Update annotation
        const updateSuccess = await (0, annotations_1.updateAnnotation)(annotationId1, {
            rating: 4,
            notes: 'Updated: Still amazing but a bit crowded during peak hours.',
            metadata: {
                visit_type: 'sightseeing',
                weather: 'sunny',
                crowd_level: 'high',
                updated: true
            }
        });
        console.log('Update successful:', updateSuccess);
        // Example 8: Search by semantic similarity (using the mock embedding)
        const similarAnnotations = await (0, annotations_1.searchAnnotationsBySimilarity)(mockEmbedding, 5, 0.5);
        console.log('Similar annotations found:', similarAnnotations.length);
        // Example 9: Delete annotation (commented out to avoid deleting test data)
        // const deleteSuccess = await deleteAnnotation(annotationId1, userId);
        // console.log('Delete successful:', deleteSuccess);
        // Example 10: Test validation - invalid rating
        try {
            await (0, annotations_1.insertAnnotation)({
                place_id: placeId,
                user_id: userId,
                title: 'Invalid Rating Test',
                rating: 6, // Invalid: should be 1-5
                visibility: 'public'
            });
        }
        catch (error) {
            console.log('Validation error caught:', error.message);
        }
        // Example 11: Test validation - invalid visibility
        try {
            await (0, annotations_1.insertAnnotation)({
                place_id: placeId,
                user_id: userId,
                title: 'Invalid Visibility Test',
                visibility: 'private', // Invalid: should be 'friends' or 'public'
                rating: 3
            });
        }
        catch (error) {
            console.log('Validation error caught:', error.message);
        }
    }
    catch (error) {
        console.error('Error in example usage:', error);
    }
}
// Example of generating embeddings (mock function)
function generateMockEmbedding(text) {
    // In a real application, this would use an AI model like OpenAI's text-embedding-ada-002
    // For now, we'll generate a mock 1536-dimensional vector
    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const embedding = [];
    for (let i = 0; i < 1536; i++) {
        // Simple hash-based generation for demo purposes
        const hash = (seed * (i + 1)) % 1000;
        embedding.push((hash / 1000) * 2 - 1); // Normalize to [-1, 1]
    }
    return embedding;
}
// Example of creating annotation with AI-generated embedding
async function createAnnotationWithAIEmbedding() {
    try {
        const placeId = await (0, places_1.upsertPlace)({
            name: 'Local Coffee Shop',
            address: '123 Main St, City',
            lat: -33.8568,
            lng: 151.2153
        });
        const reviewText = "Great coffee and atmosphere. Perfect for working remotely.";
        const embedding = generateMockEmbedding(reviewText);
        const annotationId = await (0, annotations_1.insertAnnotation)({
            place_id: placeId,
            user_id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'Coffee Review',
            notes: reviewText,
            rating: 4,
            visibility: 'public',
            embedding: embedding
        });
        console.log('Created annotation with AI embedding, ID:', annotationId);
        return annotationId;
    }
    catch (error) {
        console.error('Error creating annotation with AI embedding:', error);
    }
}
// Example of creating annotation with AUTO-GENERATED embedding
async function createAnnotationWithAutoEmbedding() {
    try {
        const placeId = await (0, places_1.upsertPlace)({
            name: 'Artisan Bakery',
            address: '456 Oak Ave, City',
            lat: -33.8568,
            lng: 151.2153
        });
        // This will automatically generate an embedding using OpenAI
        const annotationId = await (0, annotations_1.insertAnnotation)({
            place_id: placeId,
            user_id: '550e8400-e29b-41d4-a716-446655440000',
            title: 'Best Pastries in Town',
            went_with: ['Friend'],
            labels: ['Bakery', 'Pastries', 'Breakfast'],
            notes: 'Incredible pastries and bread. The croissants are flaky perfection and the sourdough is amazing. Great for breakfast or coffee.',
            metadata: {
                visit_type: 'breakfast',
                food_quality: 'excellent',
                price_range: '$$'
            },
            visit_date: '2024-03-15',
            rating: 5,
            visibility: 'public',
            auto_generate_embedding: true // This triggers automatic embedding generation
        });
        console.log('Created annotation with AUTO-GENERATED embedding, ID:', annotationId);
        return annotationId;
    }
    catch (error) {
        console.error('Error creating annotation with auto embedding:', error);
    }
}
// Uncomment to run the examples
// exampleUsage();
// createAnnotationWithAIEmbedding();
// createAnnotationWithAutoEmbedding(); 
