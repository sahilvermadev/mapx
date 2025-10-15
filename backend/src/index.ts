import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import path from 'path';
import configurePassport from './config/passport';
import { authenticateJWT } from './middleware/auth';
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
import pool from './db';

// Load .env file from the root directory (two levels up from backend/src)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug: Log environment variables (without sensitive values)
console.log('🔧 Environment check:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('  GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Set' : '❌ Not set');
console.log('  GOOGLE_MAPS_API_KEY:', process.env.GOOGLE_MAPS_API_KEY ? '✅ Set' : '❌ Not set');
console.log('  PORT:', process.env.PORT || '5000 (default)');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const app = express();
const port = process.env.PORT || 5000;

// CORS configuration with environment-driven origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:5173']; // Default for development

app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));
app.use(express.json());

// JWT-only authentication (no sessions)
app.use(passport.initialize());
configurePassport();

// OAuth routes (no JWT required)
app.use('/auth', authRoutes);

// All API routes require JWT authentication
app.use('/api/recommendations', authenticateJWT, recommendationRoutes);
app.use('/api/ai-recommendation', authenticateJWT, aiRecommendationRoutes);
app.use('/api/location', authenticateJWT, locationRoutes);
app.use('/api/profile', authenticateJWT, profileRoutes);
app.use('/api/social', authenticateJWT, socialRoutes);
app.use('/api/feed', authenticateJWT, feedRoutes);
app.use('/api/friend-groups', authenticateJWT, friendGroupRoutes);
app.use('/api/username', authenticateJWT, usernameRoutes);
app.use('/api/notifications', authenticateJWT, notificationRoutes);
app.use('/api/db', authenticateJWT, dbViewerRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});