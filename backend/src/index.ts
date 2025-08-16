import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import configurePassport from './config/passport';
import authRoutes from './routes/authRoutes';
import recommendationRoutes from './routes/recommendationRoutes';
import profileRoutes from './routes/profileRoutes';
import pool from './db';

// Load .env file from the root directory (two levels up from backend/src)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Debug: Log environment variables (without sensitive values)
console.log('🔧 Environment check:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('  GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Set' : '❌ Not set');
console.log('  PORT:', process.env.PORT || '5000 (default)');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

app.use(passport.initialize());
app.use(passport.session());
configurePassport();

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const result = await pool.query(
      'SELECT id, google_id, email, display_name, profile_picture_url FROM users WHERE id = $1',
      [id]
    );
    done(null, result.rows[0] || false);
  } catch (err) {
    done(err as Error, false);
  }
});

app.use('/auth', authRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/profile', profileRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});