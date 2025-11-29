/**
 * Script to refresh all recommendation embeddings
 * 
 * This regenerates embeddings for all recommendations to include:
 * - Freshness information (visited-X-days-ago)
 * - Updated embedding format
 * 
 * Usage:
 *   npx tsx scripts/refresh-embeddings.ts
 * 
 * Or from Node.js:
 *   node -r ts-node/register scripts/refresh-embeddings.ts
 */

// CRITICAL: Load environment variables synchronously BEFORE any other imports
// This must happen at the top level, before any module that checks env vars
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// Try multiple common locations for the .env file
const candidatePaths = [
  path.resolve(process.cwd(), '.env'),      // current working directory (most reliable)
  path.resolve(__dirname, '../.env'),       // project root relative to script
  path.resolve(__dirname, '../backend/.env'), // backend/.env if exists
];

let envLoaded = false;
for (const p of candidatePaths) {
  try {
    if (fs.existsSync(p)) {
      const result = dotenv.config({ path: p, override: true }); // Use override: true to ensure it's set
      if (!result.error) {
        console.log(`✅ Loaded environment from: ${p}`);
        envLoaded = true;
        // Verify DATABASE_URL was loaded
        if (process.env.DATABASE_URL) {
          console.log(`✅ DATABASE_URL is set (length: ${process.env.DATABASE_URL.length})`);
        } else {
          // Try to see what env vars were loaded
          const envKeys = Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('DB'));
          if (envKeys.length > 0) {
            console.warn(`⚠️  DATABASE_URL not found, but found related vars: ${envKeys.join(', ')}`);
          } else {
            console.warn(`⚠️  DATABASE_URL not found in ${p}`);
            console.warn(`   Total env vars loaded: ${Object.keys(process.env).length}`);
          }
        }
        break;
      } else {
        console.warn(`⚠️  Error loading ${p}:`, result.error);
      }
    }
  } catch (err) {
    console.warn(`⚠️  Error checking ${p}:`, err);
  }
}

if (!envLoaded) {
  console.warn('⚠️  Warning: No .env file found. Make sure DATABASE_URL is set in environment.');
}

// Construct DATABASE_URL from DB_NAME, DB_USER, DB_PASSWORD if not set directly
if (!process.env.DATABASE_URL) {
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '5432';
  
  if (dbName && dbUser && dbPassword) {
    // Construct PostgreSQL connection string
    process.env.DATABASE_URL = `postgresql://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;
    console.log(`✅ Constructed DATABASE_URL from DB_NAME, DB_USER, DB_PASSWORD`);
  } else {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('   And could not construct from DB_NAME, DB_USER, DB_PASSWORD');
    console.error('   Found:', {
      DB_NAME: !!dbName,
      DB_USER: !!dbUser,
      DB_PASSWORD: !!dbPassword,
      DB_HOST: !!dbHost,
      DB_PORT: !!dbPort
    });
    console.error('   Please ensure your .env file contains either:');
    console.error('   - DATABASE_URL (full connection string), OR');
    console.error('   - DB_NAME, DB_USER, DB_PASSWORD (and optionally DB_HOST, DB_PORT)');
    process.exit(1);
  }
}

// Determine the correct path to backend code
// When run from root: ../backend/src (TypeScript source)
// When run from container (/app/scripts): ../dist (compiled JavaScript)
const backendSrcPath = (() => {
  const possiblePaths = [
    path.resolve(__dirname, '../dist'),           // Container: /app/scripts -> /app/dist (compiled)
    path.resolve(__dirname, '../backend/src'),   // Local: scripts -> backend/src (TypeScript)
  ];
  
  for (const p of possiblePaths) {
    // Check for either TypeScript source or compiled JavaScript
    if (fs.existsSync(path.join(p, 'config', 'env.ts')) || 
        fs.existsSync(path.join(p, 'config', 'env.js')) ||
        fs.existsSync(path.join(p, 'db', 'recommendations.js'))) {
      return p;
    }
  }
  // Default to container path (compiled)
  return path.resolve(__dirname, '../dist');
})();

// Use dynamic imports to ensure env is fully loaded before importing db modules
async function main() {
  console.log('🔄 Starting embedding regeneration...');
  console.log(`📁 Using backend source path: ${backendSrcPath}`);
  console.log('');
  
  try {
    // Import config/env to validate (if it exists)
    try {
      const envPath = path.join(backendSrcPath, 'config', 'env');
      await import(pathToFileURL(envPath).href);
    } catch (e) {
      // env config might not be needed if we already loaded .env
      console.log('ℹ️  Note: Could not import env config, using .env file directly');
    }
    
    // Dynamically import after env is confirmed loaded
    // Convert absolute paths to file:// URLs for ES module imports
    const recommendationsPath = pathToFileURL(path.join(backendSrcPath, 'db', 'recommendations')).href;
    const embeddingQueuePath = pathToFileURL(path.join(backendSrcPath, 'services', 'embeddingQueue')).href;
    
    const { regenerateAllRecommendationEmbeddings } = await import(recommendationsPath);
    const { embeddingQueue } = await import(embeddingQueuePath);
    
    const result = await regenerateAllRecommendationEmbeddings();
    
    console.log('');
    console.log('✅ Embedding regeneration queued successfully!');
    console.log(`   - Successfully queued: ${result.success}`);
    console.log(`   - Failed to queue: ${result.failed}`);
    console.log('');
    console.log('📊 Queue Status:');
    const status = embeddingQueue.getStatus();
    console.log(`   - Queue length: ${status.queueLength}`);
    console.log(`   - Currently processing: ${status.processing}`);
    console.log(`   - Is processing: ${status.isProcessing}`);
    console.log('');
    console.log('💡 Note: Embeddings are processed asynchronously in the background.');
    console.log('   Check queue status with: GET /api/recommendations/embedding-queue/status');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error regenerating embeddings:', error);
    if (error instanceof Error) {
      console.error('   Error details:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

main();

