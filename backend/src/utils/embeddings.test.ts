import { 
  generateEmbedding, 
  generateAnnotationEmbedding, 
  generateSearchEmbedding,
  generatePlaceEmbedding,
  generateBatchEmbeddings,
  calculateCosineSimilarity,
  validateEmbedding
} from './embeddings';
// Use a local test type to avoid importing deprecated annotations module
type TestAnnotation = {
  place_id: number;
  user_id: string;
  title?: string;
  went_with?: string[];
  labels?: string[];
  notes?: string;
  metadata?: Record<string, any>;
  visit_date?: string;
  rating?: number;
  visibility?: 'friends' | 'public';
};

// Example usage of embedding functions
async function exampleUsage() {
  try {
    console.log('Testing embedding utilities...');

    // Example 1: Generate embedding from simple text
    const simpleText = "Great coffee shop with excellent atmosphere for working";
    const simpleEmbedding = await generateEmbedding(simpleText);
    console.log('Simple text embedding generated:', simpleEmbedding.length, 'dimensions');
    console.log('Embedding validation:', validateEmbedding(simpleEmbedding));

    // Example 2: Generate embedding from annotation data
    const annotationData: TestAnnotation = {
      place_id: 1,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Amazing Coffee Experience',
      went_with: ['Sarah', 'Mike'],
      labels: ['Coffee', 'Work-friendly', 'Atmosphere'],
      notes: 'The coffee here is absolutely fantastic. The atmosphere is perfect for working remotely, with great WiFi and comfortable seating. The baristas are friendly and the pastries are delicious.',
      metadata: {
        visit_type: 'work',
        wifi: true,
        seating: 'comfortable',
        noise_level: 'moderate'
      },
      visit_date: '2024-01-15',
      rating: 5,
      visibility: 'public'
    };

    const annotationEmbedding = await generateAnnotationEmbedding(annotationData);
    console.log('Annotation embedding generated:', annotationEmbedding.length, 'dimensions');

    // Example 3: Generate search embedding
    const searchQuery = "coffee shops good for working";
    const searchEmbedding = await generateSearchEmbedding(searchQuery);
    console.log('Search embedding generated:', searchEmbedding.length, 'dimensions');

    // Example 4: Generate place embedding
    const placeData = {
      name: 'Starbucks Reserve',
      address: '123 Main St, Downtown',
      metadata: {
        type: 'coffee_shop',
        features: ['wifi', 'outdoor_seating', 'reserve_coffee'],
        price_range: '$$'
      }
    };

    const placeEmbedding = await generatePlaceEmbedding(placeData);
    console.log('Place embedding generated:', placeEmbedding.length, 'dimensions');

    // Example 5: Batch embeddings
    const texts = [
      "Great coffee and atmosphere",
      "Perfect for working remotely",
      "Friendly staff and fast service",
      "Comfortable seating and good WiFi"
    ];

    const batchEmbeddings = await generateBatchEmbeddings(texts);
    console.log('Batch embeddings generated:', batchEmbeddings.length, 'embeddings');

    // Example 6: Calculate similarity
    const similarity = calculateCosineSimilarity(simpleEmbedding, searchEmbedding);
    console.log('Similarity between simple text and search query:', similarity.toFixed(4));

    // Example 7: Compare annotation with search query
    const annotationSearchSimilarity = calculateCosineSimilarity(annotationEmbedding, searchEmbedding);
    console.log('Similarity between annotation and search query:', annotationSearchSimilarity.toFixed(4));

    // Example 8: Test with different annotation data
    const differentAnnotation: TestAnnotation = {
      place_id: 2,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Quick Lunch Spot',
      labels: ['Lunch', 'Fast', 'Casual'],
      notes: 'Quick service for lunch. Food is decent but nothing special. Good for a fast meal.',
      rating: 3,
      visibility: 'public'
    };

    const differentEmbedding = await generateAnnotationEmbedding(differentAnnotation);
    const differentSimilarity = calculateCosineSimilarity(annotationEmbedding, differentEmbedding);
    console.log('Similarity between coffee and lunch annotations:', differentSimilarity.toFixed(4));

    console.log('✅ All embedding tests completed successfully!');

  } catch (error) {
    console.error('❌ Error in embedding tests:', error);
  }
}

// Example of using embeddings for semantic search
async function semanticSearchExample() {
  try {
    console.log('\n--- Semantic Search Example ---');

    // Create a search query
    const searchQuery = "places with good coffee and wifi for working";
    const searchEmbedding = await generateSearchEmbedding(searchQuery);

    // Simulate some stored annotations (in real app, these would come from database)
    const storedAnnotations = [
      {
        id: 1,
        title: "Great Coffee Shop",
        notes: "Amazing coffee and perfect for working. Great WiFi and comfortable seating.",
        embedding: await generateEmbedding("Amazing coffee and perfect for working. Great WiFi and comfortable seating.")
      },
      {
        id: 2,
        title: "Quick Lunch Spot",
        notes: "Fast food place. Quick service but no WiFi.",
        embedding: await generateEmbedding("Fast food place. Quick service but no WiFi.")
      },
      {
        id: 3,
        title: "Cozy Cafe",
        notes: "Excellent coffee, good WiFi, perfect atmosphere for remote work.",
        embedding: await generateEmbedding("Excellent coffee, good WiFi, perfect atmosphere for remote work.")
      }
    ];

    // Calculate similarities and sort by relevance
    const searchResults = storedAnnotations
      .map(annotation => ({
        ...annotation,
        similarity: calculateCosineSimilarity(searchEmbedding, annotation.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity);

    console.log('Search results for "places with good coffee and wifi for working":');
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (similarity: ${result.similarity.toFixed(4)})`);
      console.log(`   ${result.notes}`);
    });

  } catch (error) {
    console.error('Error in semantic search example:', error);
  }
}

// Uncomment to run the examples
// exampleUsage();
// semanticSearchExample(); 