import { EmbeddingQueue } from './embeddingQueue';

// Mock the dependencies
jest.mock('../utils/embeddings', () => ({
  generateRecommendationEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
}));

jest.mock('../db/places', () => ({
  getPlaceById: jest.fn().mockResolvedValue({ name: 'Test Place', address: 'Test Address' }),
  getUserById: jest.fn().mockResolvedValue({ display_name: 'Test User' })
}));

jest.mock('../db', () => ({
  connect: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn()
  })
}));

describe('EmbeddingQueue', () => {
  let queue: EmbeddingQueue;

  beforeEach(() => {
    queue = new EmbeddingQueue({
      maxConcurrent: 2,
      retryDelay: 100,
      maxRetries: 2,
      batchSize: 3
    });
  });

  afterEach(() => {
    queue.clear();
  });

  test('should enqueue tasks correctly', async () => {
    const taskId = await queue.enqueue('recommendation', 1, { user_id: 'test-user' }, 'normal');
    
    expect(taskId).toMatch(/^recommendation-1-/);
    
    const status = queue.getStatus();
    expect(status.queueLength).toBe(1);
    expect(status.processing).toBe(0);
  });

  test('should process tasks asynchronously', async () => {
    const taskId = await queue.enqueue('recommendation', 1, { user_id: 'test-user' }, 'normal');
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const status = queue.getStatus();
    expect(status.queueLength).toBe(0);
  });

  test('should handle priority correctly', async () => {
    await queue.enqueue('recommendation', 1, { user_id: 'test-user' }, 'low');
    await queue.enqueue('recommendation', 2, { user_id: 'test-user' }, 'high');
    await queue.enqueue('recommendation', 3, { user_id: 'test-user' }, 'normal');
    
    const status = queue.getStatus();
    expect(status.queueLength).toBe(3);
  });

  test('should clear queue', () => {
    queue.enqueue('recommendation', 1, { user_id: 'test-user' }, 'normal');
    queue.enqueue('recommendation', 2, { user_id: 'test-user' }, 'normal');
    
    let status = queue.getStatus();
    expect(status.queueLength).toBe(2);
    
    queue.clear();
    status = queue.getStatus();
    expect(status.queueLength).toBe(0);
    expect(status.processing).toBe(0);
    expect(status.isProcessing).toBe(false);
  });
});
