const axios = require('axios');

async function regenerateEmbeddings() {
  try {
    console.log('🔄 Starting embedding regeneration...');
    
    const response = await axios.post('http://localhost:5000/api/recommendations/regenerate-embeddings');
    
    if (response.data.success) {
      console.log('✅ Embedding regeneration completed successfully!');
      console.log(`📊 Results: ${response.data.data.success} successful, ${response.data.data.failed} failed`);
      console.log(`💬 Message: ${response.data.message}`);
    } else {
      console.error('❌ Embedding regeneration failed:', response.data.error);
    }
    
  } catch (error) {
    console.error('❌ Error calling embedding regeneration API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the regeneration
regenerateEmbeddings(); 