# Service Deduplication System

This document describes the service deduplication system implemented for the MapX recommendation platform. The system automatically deduplicates and links recommendations for the same service provider across users, even if they use slightly different names.

## 🎯 Core Objectives

- **Automatic Deduplication**: Link recommendations for the same service provider using phone number or email as unique identifiers
- **Name Conflict Resolution**: Handle cases where the same phone/email is associated with different names using fuzzy matching
- **Comprehensive Profile Building**: Aggregate all recommendations for a provider into one canonical entity
- **Intelligent Matching**: Use advanced name similarity algorithms to detect variations of the same person

## 🏗️ Database Schema

### Services Table
```sql
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100), -- e.g., 'painter', 'plumber'
  business_name VARCHAR(255),
  address TEXT,
  website VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Service Names Table
```sql
CREATE TABLE service_names (
  id SERIAL PRIMARY KEY,
  service_id INT REFERENCES services(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  frequency INT DEFAULT 1,
  confidence FLOAT DEFAULT 1.0,
  last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

### Updated Recommendations Table
```sql
ALTER TABLE recommendations
  ADD COLUMN service_id INT REFERENCES services(id) ON DELETE SET NULL;
```

## 🔧 Core Components

### 1. Name Similarity Utilities (`src/utils/nameSimilarity.ts`)

- **Levenshtein Distance**: Calculates edit distance between strings
- **Similarity Scoring**: Converts distance to similarity ratio (0-1)
- **Fuzzy Matching**: Detects name variations with configurable threshold (default: 0.85)
- **Name Normalization**: Handles common abbreviations and variations
- **Service Type Extraction**: Automatically detects service type from name/business name

### 2. Service Database Models (`src/db/services.ts`)

- **Phone/Email Normalization**: Standardizes phone numbers and emails
- **Service CRUD Operations**: Create, read, update, delete services
- **Name Variation Management**: Track multiple name variations per service
- **Canonical Name Updates**: Automatically determine the most common name

### 3. Deduplication Service (`src/services/serviceDeduplication.ts`)

- **Upsert Logic**: Main function that handles all deduplication scenarios
- **Conflict Detection**: Identifies potential conflicts between different names
- **Confidence Scoring**: Assigns confidence levels to name matches
- **Automatic Merging**: Links recommendations to existing services when appropriate

## 🚀 API Integration

### Enhanced Recommendation Endpoint

The `/api/recommendations/save` endpoint now supports service deduplication:

```typescript
// Request body for service recommendations
{
  "content_type": "service",
  "service_name": "Ramesh Singh",
  "service_phone": "9910192219",
  "service_email": "ramesh.painter@gmail.com",
  "service_type": "painter",
  "service_business_name": "Ramesh Paint Works",
  "service_address": "123 Main St, Delhi",
  "service_website": "www.rameshpaint.com",
  "description": "Excellent painter, very professional",
  "rating": 5,
  "user_id": "user-uuid"
}
```

### Response Format

```typescript
{
  "success": true,
  "data": {
    "service_id": 123,
    "recommendation_id": 456,
    "service_deduplication": {
      "action": "created", // or "updated" or "merged"
      "confidence": 0.95,
      "reasoning": "Found existing service by phone. Names are similar."
    }
  }
}
```

## 📊 Deduplication Scenarios

### Scenario 1: Exact Match
- **Input**: Same phone/email, identical name
- **Result**: Links to existing service, updates canonical name if needed
- **Confidence**: 1.0

### Scenario 2: Similar Names
- **Input**: Same phone/email, similar name (e.g., "Ramesh Singh" vs "Ramesh S")
- **Result**: Adds name variation, updates canonical name based on frequency
- **Confidence**: 0.85-0.95

### Scenario 3: Different Names (Conflict)
- **Input**: Same phone/email, different name (e.g., "Ramesh Singh" vs "Shyam Kumar")
- **Result**: Links with low confidence, flags for manual review
- **Confidence**: 0.3

### Scenario 4: New Service
- **Input**: New phone/email combination
- **Result**: Creates new service entity
- **Confidence**: 1.0

## 🔍 Name Similarity Algorithm

The system uses multiple heuristics to determine if two names refer to the same person:

1. **Exact Match**: Direct string comparison
2. **Levenshtein Distance**: Edit distance calculation
3. **Abbreviation Detection**: Common name abbreviations (Kumar → K, Singh → S)
4. **Initial Matching**: For very short names, compare initials
5. **Variation Generation**: Creates common variations for matching

### Example Matches

| Name 1 | Name 2 | Similarity | Match |
|--------|--------|------------|-------|
| Ramesh Singh | Ramesh Singh | 1.00 | ✅ |
| Ramesh Singh | Ramesh S | 0.92 | ✅ |
| Ramesh Singh | R Singh | 0.88 | ✅ |
| Ramesh Singh | Shyam Singh | 0.75 | ❌ |
| Amit Kumar | Amit K | 0.90 | ✅ |

## 🛠️ Usage Examples

### Basic Service Recommendation

```typescript
// User recommends a painter
const response = await fetch('/api/recommendations/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content_type: 'service',
    service_name: 'Ramesh Singh',
    service_phone: '9910192219',
    service_type: 'painter',
    description: 'Great painter, very professional',
    rating: 5,
    user_id: 'user-uuid'
  })
});
```

### Service with Email

```typescript
// User recommends with email instead of phone
const response = await fetch('/api/recommendations/save', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content_type: 'service',
    service_name: 'Amit Kumar',
    service_email: 'amit.painter@gmail.com',
    service_type: 'painter',
    description: 'Excellent work, highly recommended',
    rating: 4,
    user_id: 'user-uuid'
  })
});
```

## 🔧 Configuration

### Similarity Threshold
```typescript
// Default threshold for name similarity
const SIMILARITY_THRESHOLD = 0.85;

// Adjust based on your needs
const result = areNamesLikelySame(name1, name2, 0.9); // Stricter matching
```

### Service Type Detection
The system automatically detects service types from names and business names:

```typescript
const serviceTypes = {
  'painter': ['painter', 'painting', 'paint'],
  'plumber': ['plumber', 'plumbing'],
  'electrician': ['electrician', 'electrical', 'electric'],
  'carpenter': ['carpenter', 'carpentry'],
  'mechanic': ['mechanic', 'automobile', 'auto', 'repair']
  // ... more types
};
```

## 🧪 Testing

Run the test scenarios to verify deduplication:

```bash
# Run service deduplication tests
npm run test:services

# Or run specific scenarios
node src/tests/serviceDeduplication.test.ts
```

### Test Scenarios

1. **Same phone, similar names**: Should merge and update canonical name
2. **Same phone, different names**: Should flag as conflict with low confidence
3. **Same email, different phone**: Should merge by email
4. **New service**: Should create new entity

## 📈 Performance Considerations

### Database Indexes
- `services(phone_number)` - Fast phone lookups
- `services(email)` - Fast email lookups
- `service_names(service_id)` - Efficient name queries
- `recommendations(service_id)` - Fast service-based queries

### Caching Strategy
- Cache frequently accessed services
- Use Redis for name similarity results
- Implement service lookup caching

### Batch Processing
- Process multiple recommendations in batches
- Use database transactions for consistency
- Implement async processing for heavy operations

## 🔮 Future Enhancements

### Phase 2 Features
- **Manual Conflict Resolution**: Admin interface for resolving conflicts
- **Service Profile Pages**: Dedicated pages for service providers
- **Advanced Analytics**: Service performance metrics
- **Integration APIs**: Connect with external service directories

### Machine Learning Integration
- **Name Embeddings**: Use ML models for better name matching
- **Service Classification**: Automatic service type detection
- **Quality Scoring**: ML-based service quality assessment

## 🚨 Error Handling

### Common Error Scenarios
1. **Invalid Phone/Email**: Validation errors for malformed identifiers
2. **Database Conflicts**: Handle unique constraint violations
3. **Name Similarity Failures**: Fallback to exact matching
4. **Transaction Failures**: Rollback on errors

### Error Response Format
```typescript
{
  "success": false,
  "error": "Service validation failed",
  "details": {
    "field": "phone_number",
    "message": "Phone number must be between 10 and 15 digits"
  }
}
```

## 📝 Migration Guide

### Database Migration
1. Run the services schema migration
2. Update existing recommendations to use service_id
3. Run data migration scripts for existing data

### API Updates
1. Update frontend to send service data
2. Handle new response format with service_deduplication
3. Update recommendation display to show service information

## 🤝 Contributing

### Adding New Service Types
1. Update `extractServiceType` function
2. Add new type to database enum
3. Update frontend type definitions

### Improving Name Similarity
1. Add new similarity algorithms
2. Update confidence scoring
3. Add language-specific handling

### Testing New Scenarios
1. Add test cases to `serviceDeduplication.test.ts`
2. Update documentation with new scenarios
3. Verify edge cases and error handling

---

This service deduplication system provides a robust foundation for managing service provider recommendations while maintaining data quality and user experience. The system is designed to be extensible and can be enhanced with additional features as the platform grows.
