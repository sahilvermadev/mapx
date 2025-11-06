import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import './config/env';
import { validateEnvironment } from './config/env';
import passport from 'passport';
import configurePassport from './config/passport';
import { authenticateJWT } from './middleware/auth';
import { createErrorHandlerMiddleware } from './utils/errorHandling';
import { requestTrackingMiddleware, requestLoggingMiddleware } from './middleware/requestTracking';
import logger from './utils/logger';
import authRoutes from './routes/authRoutes';
import recommendationRoutes from './routes/recommendationRoutes';
import aiRecommendationRoutes from './routes/aiRecommendationRoutes';
import locationRoutes from './routes/locationRoutes';
import profileRoutes from './routes/profileRoutes';
import socialRoutes from './routes/socialRoutes';
import feedRoutes from './routes/feedRoutes';
import friendGroupRoutes from './routes/friendGroupRoutes';
import usernameRoutes from './routes/usernameRoutes';
import notificationRoutes from './routes/notificationRoutes';
import dbViewerRoutes from './routes/dbViewerRoutes';
import questionRoutes from './routes/questionRoutes';
import publicPreviewRoutes from './routes/publicPreviewRoutes';
import ogRoutes from './routes/ogRoutes';
import pool from './db';

// env is loaded by ./config/env

// Validate environment variables
const envValidation = validateEnvironment();
if (!envValidation.isValid) {
  logger.error('Environment validation failed', { errors: envValidation.errors });
  envValidation.errors.forEach(error => logger.error(error));
  process.exit(1);
}

// Log environment check (without sensitive values)
const envCheck = {
  DATABASE_URL: !!process.env.DATABASE_URL,
  JWT_SECRET: !!process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  GROQ_API_KEY: !!process.env.GROQ_API_KEY,
  GOOGLE_MAPS_API_KEY: !!process.env.GOOGLE_MAPS_API_KEY,
  PORT: process.env.PORT || '5000 (default)',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
logger.info('Environment check completed', envCheck);

const app = express();
const port = process.env.PORT || 5000;

// Health check endpoint (before CORS middleware to allow internal health checks)
app.get('/health', async (req, res) => {
  const health: {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    environment: string;
    services: {
      database: { status: string; error?: string };
      redis: { status: string; error?: string };
      memory: { used: number; total: number; percentage: number };
      databasePool: { total: number; idle: number; waiting: number };
    };
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
      memory: { used: 0, total: 0, percentage: 0 },
      databasePool: { total: 0, idle: 0, waiting: 0 },
    },
  };

  let degraded = false;

  // Database health check
  try {
    await pool.query('SELECT 1');
    health.services.database = { status: 'healthy' };
  } catch (error: any) {
    health.services.database = { 
      status: 'unhealthy', 
      error: error?.message || 'Database connection failed' 
    };
    degraded = true;
  }

  // Database pool metrics
  health.services.databasePool = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };

  // Redis health check
  try {
    const { checkRedisHealth } = await import('./utils/redis');
    const redisHealth = await checkRedisHealth();
    if (redisHealth.healthy) {
      health.services.redis = { status: 'healthy' };
    } else {
      health.services.redis = { 
        status: 'unhealthy', 
        error: redisHealth.error 
      };
      // Redis is optional for some features, so don't mark as degraded
    }
  } catch (error: any) {
    health.services.redis = { 
      status: 'unknown', 
      error: error?.message || 'Redis check failed' 
    };
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  const memTotal = memUsage.heapTotal;
  const memUsed = memUsage.heapUsed;
  const memPercentage = (memUsed / memTotal) * 100;
  health.services.memory = {
    used: Math.round(memUsed / 1024 / 1024), // MB
    total: Math.round(memTotal / 1024 / 1024), // MB
    percentage: Math.round(memPercentage * 100) / 100,
  };

  // Determine overall status
  if (health.services.database.status === 'unhealthy') {
    health.status = 'unhealthy';
  } else if (degraded) {
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

// CORS configuration with environment-driven origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173']; // Default for development

// CORS configuration - strict in production, but allow navigation requests without Origin
const isProduction = process.env.NODE_ENV === 'production';

// Paths that allow requests without Origin header (browser navigations don't send Origin)
const allowNoOriginPaths = [
  '/auth',          // OAuth redirects/initiations
  '/health',        // health checks
  '/share',         // public OG routes
  '/api/public',   // public API
];

// Custom CORS middleware that checks the request path
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  const path = req.path;
  const isNoOriginAllowed = allowNoOriginPaths.some(prefix => path.startsWith(prefix));

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    if (!origin) {
      if (isProduction && !isNoOriginAllowed) {
        return res.status(403).json({ error: 'CORS: Origin header required in production' });
      }
      // Allow preflight for no-origin paths (no credentials for no-origin)
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
      return res.sendStatus(200);
    }
    
    // Check if origin is allowed
    const isAllowed = isProduction 
      ? allowedOrigins.includes(origin)
      : allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1');
    
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      logger.warn('CORS blocked origin', { origin, allowedOrigins, path });
      return res.status(403).json({ error: `CORS: Origin ${origin} not allowed` });
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.header('Access-Control-Expose-Headers', 'Content-Type, Cache-Control, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');
    return res.sendStatus(200);
  }

  // Handle actual requests
  if (!origin) {
    if (isProduction && !isNoOriginAllowed) {
      return res.status(403).json({ error: 'CORS: Origin header required in production' });
    }
    // Allow no-origin for specific paths (no credentials for no-origin)
    res.header('Access-Control-Allow-Origin', '*');
    return next();
  }

  // Check if origin is allowed
  const isAllowed = isProduction 
    ? allowedOrigins.includes(origin)
    : allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1');

  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    logger.warn('CORS blocked origin', { origin, allowedOrigins, path });
    return res.status(403).json({ error: `CORS: Origin ${origin} not allowed` });
  }

  res.header('Access-Control-Expose-Headers', 'Content-Type, Cache-Control, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');
  next();
});
// Configure compression to exclude image responses (they're already compressed)
app.use(compression({
  filter: (req, res) => {
    // Don't compress image responses
    if (req.path.includes('/profile-picture')) {
      return false;
    }
    // Use compression for everything else
    return compression.filter(req, res);
  }
}));

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"], // Allow images from all sources for profile pictures
      connectSrc: ["'self'", "https:", "http:"], // Allow connections to backend and external APIs
      fontSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for Google Maps and other services
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource loading for images
}));

// Request tracking middleware (early in the chain)
app.use(requestTrackingMiddleware);
app.use(requestLoggingMiddleware);

// Request body parsing with size limits
// IMPORTANT: Skip parsing for multipart/form-data - multer needs the raw stream
// Create conditional middleware that applies parsers only for non-multipart requests
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  // Skip body parsing for multipart/form-data - multer will handle it
  if (contentType.includes('multipart/form-data')) {
    return next();
  }
  // For other content types, apply JSON parser first
  const jsonParser = express.json({ limit: '10mb' });
  jsonParser(req, res, (err) => {
    if (err) return next(err);
    // Then apply URL-encoded parser
    const urlencodedParser = express.urlencoded({ extended: true, limit: '10mb' });
    urlencodedParser(req, res, next);
  });
});

// JWT-only authentication (no sessions)
app.use(passport.initialize());
configurePassport();

// OAuth routes (no JWT required)
app.use('/auth', authRoutes);

// Public, unauthenticated routes
app.use('/api/public', publicPreviewRoutes);
app.use('/share', ogRoutes);

// Profile routes - banner images are public, others require auth
// We'll handle auth in the route itself for flexibility
app.use('/api/profile', profileRoutes);

// All API routes require JWT authentication
app.use('/api/recommendations', authenticateJWT, recommendationRoutes);
app.use('/api/ai-recommendation', authenticateJWT, aiRecommendationRoutes);
app.use('/api/location', authenticateJWT, locationRoutes);
app.use('/api/social', authenticateJWT, socialRoutes);
app.use('/api/feed', authenticateJWT, feedRoutes);
app.use('/api/friend-groups', authenticateJWT, friendGroupRoutes);
app.use('/api/username', authenticateJWT, usernameRoutes);
app.use('/api/notifications', authenticateJWT, notificationRoutes);
app.use('/api/db', authenticateJWT, dbViewerRoutes);
app.use('/api/questions', authenticateJWT, questionRoutes);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    },
  });
});

// Global error handler middleware (must be last)
app.use(createErrorHandlerMiddleware());

// Store server reference for graceful shutdown
let server: ReturnType<typeof app.listen> | null = null;

server = app.listen(port, () => {
  logger.info('Server started', { port, environment: process.env.NODE_ENV || 'development' });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown`);
  
  // Stop accepting new requests
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Set shutdown timeout
  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    // Close database pool
    logger.info('Closing database pool');
    await pool.end();
    logger.info('Database pool closed');

    // Close Redis connections
    try {
      const { getRedisClient } = await import('./utils/redis');
      const redisClient = await getRedisClient();
      if (redisClient) {
        await redisClient.quit();
        logger.info('Redis connection closed');
      }
    } catch (redisError: any) {
      logger.warn('Redis cleanup error (non-critical)', { error: redisError.message });
    }

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error: any) {
    logger.error('Error during shutdown', { error: error.message, stack: error.stack });
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
};

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: String(promise)
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    message: error.message, 
    stack: error.stack,
    name: error.name
  });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});