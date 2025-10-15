import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the root directory (two levels up from backend/src)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  // Add statement timeout to prevent hung queries (30 seconds)
  statement_timeout: 30000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test the connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Pool metrics logging (every 5 minutes in production)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    console.log('📊 DB Pool metrics:', {
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
      console.log(`🐌 Slow query detected (${duration}ms):`, {
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
      console.log(`🐌 Slow query (failed) detected (${duration}ms):`, {
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