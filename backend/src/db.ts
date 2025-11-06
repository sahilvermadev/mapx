import { Pool } from 'pg';
import logger from './utils/logger';
import './config/env';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established (increased for startup)
  // Add statement timeout to prevent hung queries (30 seconds)
  statement_timeout: 30000,
});

// Handle pool errors (only for idle clients - these are recoverable)
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { 
    error: err.message, 
    stack: err.stack 
  });
  // Don't exit on idle client errors - pool will handle reconnection
});

// Test the connection on startup with retry logic
async function testConnection(maxRetries = 5, delay = 2000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query('SELECT NOW()');
      logger.info('Database connected successfully');
      return;
    } catch (err: any) {
      if (attempt === maxRetries) {
        logger.error(`Database connection failed after ${maxRetries} attempts`, { 
          error: err.message,
          stack: err.stack 
        });
        // In development, warn but don't fail - pool will retry on actual queries
        if (process.env.NODE_ENV === 'production') {
          logger.warn('Database connection test failed. Server will start but database may not be ready.');
        }
        return;
      }
      const waitTime = delay * attempt; // Exponential backoff
      logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed, retrying in ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Test connection asynchronously (non-blocking)
testConnection().catch(err => {
  logger.error('Database connection test error', { error: err instanceof Error ? err.message : String(err) });
});

// Pool metrics logging (every 5 minutes in production)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    logger.info('DB Pool metrics', {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    });
  }, 5 * 60 * 1000); // 5 minutes
}

// Slow query instrumentation with sampling
const SLOW_QUERY_THRESHOLD = 200; // 200ms threshold
const SLOW_QUERY_SAMPLE_RATE = 0.1; // 10% sampling rate

// Create a wrapper function for slow query monitoring
export const queryWithTiming = async (text: string, params?: any[]): Promise<any> => {
  const startTime = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - startTime;
    
    // Log slow queries with sampling
    if (duration > SLOW_QUERY_THRESHOLD && Math.random() < SLOW_QUERY_SAMPLE_RATE) {
      logger.warn('Slow query detected', {
        query: text.substring(0, 100) + '...',
        duration,
        timestamp: new Date().toISOString()
      });
    }
    
    return result;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    
    // Log slow queries even if they fail
    if (duration > SLOW_QUERY_THRESHOLD && Math.random() < SLOW_QUERY_SAMPLE_RATE) {
      logger.warn('Slow query (failed) detected', {
        query: text.substring(0, 100) + '...',
        duration,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
    
    throw err;
  }
};

export default pool;