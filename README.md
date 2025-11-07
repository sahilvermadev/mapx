# recce_ - AI-Powered Semantic Search

recce_ is a location-based recommendation platform that uses AI-powered semantic search to help users discover amazing places. The system leverages vector embeddings and natural language processing to understand user queries and provide intelligent, contextual recommendations.

## 🚀 Enhanced Semantic Search Features

### **Rich Embedding Data**
The system now generates embeddings that include comprehensive information:

- **📍 Place Information**: Place names and addresses for location-based searches
- **👤 User Information**: Reviewer names for finding recommendations by specific users
- **📝 Review Content**: Detailed notes and experiences
- **🏷️ Labels/Tags**: User-defined categories and features
- **⭐ Ratings**: 1-5 star ratings with context
- **👥 Companions**: Who the user went with
- **📅 Visit Dates**: When the visit occurred
- **🍽️ Metadata**: Favorite dishes, visit type, companion count

### **Advanced Search Capabilities**

The enhanced embeddings enable powerful semantic searches:

#### **Location-Based Searches**
- "places in Hauz Khas"
- "restaurants in Old Delhi"
- "cafes near Connaught Place"
- "best spots in Greater Kailash"

#### **Place-Specific Searches**
- "reviews for Mainland China"
- "what people say about Karims"
- "feedback on EVOO restaurant"

#### **User-Based Searches**
- "reviews by Sahil"
- "recommendations from Neha"
- "places suggested by Rohan"

#### **Feature-Based Searches**
- "family friendly restaurants"
- "quiet cafes good for work"
- "romantic dinner spots"
- "budget-friendly places"

#### **Activity-Based Searches**
- "good for date night"
- "work-friendly cafes"
- "places for group dining"

## 🏗️ Architecture

### **Backend Components**

#### **Enhanced Embedding Generation (`backend/src/utils/embeddings.ts`)**
- **`generateRecommendationEmbedding()`**: Creates embeddings with place/service/user context and rich content
- **`generateSearchEmbedding()`**: Converts user queries into embeddings for similarity search
- **`generatePlaceEmbedding()`**: Generates embeddings for place information

#### **Database Operations (`backend/src/db/recommendations.ts`)**
- **`insertRecommendation()`**: Queues embedding generation asynchronously
- **`searchRecommendationsBySimilarity()`**: Performs vector similarity search using pgvector
- **`regenerateAllRecommendationEmbeddings()`**: Updates existing embeddings with enhanced data

#### **Search API (`backend/src/routes/recommendationRoutes.ts`)**
- **`POST /api/recommendations/search`**: Main semantic search endpoint with AI-powered summaries
- **`POST /api/recommendations/regenerate-embeddings`**: Regenerates all embeddings with enhanced data

#### **AI Summary Generation (`backend/src/utils/aiSummaries.ts`)**
- Uses Groq's Qwen/Qwen3-32b model for intelligent, contextual summaries
- Attributes recommendations to specific users
- Provides concise, actionable answers

### **Frontend Components**

#### **Search Interface (`frontend/recce_-frontend/src/components/SearchBar.tsx`)**
- Dual-mode search: Google Places API + AI Semantic Search
- Intelligent query handling and mode switching
- Real-time search suggestions

#### **Search Results (`frontend/recce_-frontend/src/components/SearchResults.tsx`)**
- Displays AI-generated summaries with 🤖 badge
- Shows place information with similarity scores
- Lists individual recommendations with user attribution
- Provides search tips for better results

## 🔧 Technical Implementation

### **Enhanced Embedding Text Format**
```
"Place: Mainland China. Address: Greater Kailash, New Delhi. Reviewer: Sahil. Review: absolutely yum food, worth a visit. Tags: Family friendly, Fine dining. Went with: Neha. Rating: 4/5 stars. Visited: 2025-08-13. Details: favorite_dishes: crispy spinach, visit_type: leisure, companions_count: 1"
```

### **Vector Similarity Search**
- Uses OpenAI's `text-embedding-ada-002` model (1536 dimensions)
- PostgreSQL with pgvector extension for efficient similarity search
- Configurable similarity thresholds and result limits

### **AI Summary Features**
- **Contextual Understanding**: Analyzes query intent and available data
- **User Attribution**: Always mentions who made recommendations
- **Location Awareness**: Includes relevant location context
- **Conciseness**: 3-4 sentence summaries with actionable insights
- **Fallback Handling**: Graceful degradation when AI fails

## 📚 Documentation

### Getting Started
- **[Development Guide](./DEVELOPMENT.md)** - Complete local development setup and workflow
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Workflow Guide](./WORKFLOW.md)** - Development-to-production workflow

### Production
- **[Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md)** - Production best practices
- **[HTTPS Setup Guide](./HTTPS_SETUP.md)** - SSL/HTTPS configuration
- **[Domain Migration Guide](./DOMAIN_MIGRATION.md)** - Change domain easily
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Common issues and solutions

### Technical Documentation
All technical documentation is organized in the [`docs/`](./docs/) folder:

- **[Complete Documentation Index](./docs/README.md)** - Overview of all documentation
- **[Authentication Strategy](./docs/COMPREHENSIVE_AUTHENTICATION_STRATEGY.md)** - Complete authentication system
- **[Backend Documentation](./docs/BACKEND_DOCUMENTATION.md)** - API and implementation details
- **[AI Features](./docs/ASYNC_EMBEDDING_IMPLEMENTATION.md)** - Embedding and semantic search
- **[Frontend Components](./docs/LANDING_PAGE_README.md)** - UI implementation guides

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+
- PostgreSQL 13+ with pgvector extension
- Redis 7+ (for authentication)
- OpenAI API key
- Groq API key

### **Environment Variables**
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/recce_

# Redis (for authentication)
REDIS_URL=redis://localhost:6379

# AI Services
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key

# Google Services
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# JWT Secret
JWT_SECRET=your_jwt_secret_key
```

### **Installation & Setup**

1. **Clone and install dependencies**
```bash
git clone <repository>
cd recce_
npm install
cd backend && npm install
cd ../frontend/recce_-frontend && npm install
```

2. **Set up services**
```bash
# Start PostgreSQL and Redis
docker-compose up db redis

# Run migrations
cd backend
npm run migrate
```

3. **Start services**
```bash
# Backend (from root directory)
cd backend && npm run dev

# Frontend (from root directory)
cd frontend/recce_-frontend && npm run dev
```

4. **Regenerate embeddings (for existing data)**
```bash
# Option 1: Use the API endpoint
curl -X POST http://localhost:5000/api/recommendations/regenerate-embeddings

# Option 2: Use the script
cd backend && node regenerate_embeddings.js
```

## 🧪 Testing Enhanced Features

### **Test Enhanced Embeddings**
```bash
cd backend && node test_enhanced_embeddings.js
```

### **Manual Testing**
```bash
# Test place name search
curl -X POST http://localhost:5000/api/recommendations/search \
  -H "Content-Type: application/json" \
  -d '{"query": "reviews for Mainland China"}'

# Test location search
curl -X POST http://localhost:5000/api/recommendations/search \
  -H "Content-Type: application/json" \
  -d '{"query": "places in Hauz Khas"}'

# Test user search
curl -X POST http://localhost:5000/api/recommendations/search \
  -H "Content-Type: application/json" \
  -d '{"query": "reviews by Sahil"}'
```

## 📊 Performance Considerations

### **Embedding Generation**
- New recommendations automatically get enhanced embeddings
- Existing embeddings can be regenerated in batches
- Process handles 10 annotations concurrently to avoid API rate limits

### **Search Performance**
- Vector similarity search is highly optimized with pgvector
- Results are cached and paginated for better UX
- AI summaries are generated on-demand with fallback handling

### **Database Optimization**
- Embeddings stored as 1536-dimensional vectors
- Indexed for fast similarity search
- Regular maintenance recommended for large datasets

## 🔮 Future Enhancements

### **Planned Features**
- **Conversational AI**: Multi-turn search conversations
- **Advanced Filtering**: Combine semantic search with traditional filters
- **Personalization**: User preference learning and recommendations
- **Real-time Updates**: Live embedding updates for new reviews
- **Multi-language Support**: Embeddings in multiple languages

### **AI Improvements**
- **Context Memory**: Remember previous search context
- **Query Expansion**: Automatically expand search terms
- **Sentiment Analysis**: Enhanced emotion-aware summaries
- **Trend Detection**: Identify popular and trending places

## 🛠️ Troubleshooting

### **Common Issues**

#### **Embedding Generation Failures**
- Check OpenAI API key and quota
- Verify database connectivity
- Review annotation data completeness

#### **AI Summary Failures**
- Ensure Groq API key is valid
- Check network connectivity
- Review query complexity and length

#### **Search Performance Issues**
- Monitor database query performance
- Check pgvector extension installation
- Review embedding index optimization

### **Debugging Tools**
- **Embedding Test Script**: `backend/test_enhanced_embeddings.js`
- **Regeneration Script**: `backend/regenerate_embeddings.js`
- **API Testing**: Use the provided curl commands
- **Database Queries**: Direct pgvector similarity searches

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

---

**recce_** - Discover amazing places with AI-powered intelligence! 🗺️✨ 