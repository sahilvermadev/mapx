import passport from 'passport';
import { Strategy as GoogleStrategy, VerifyCallback } from 'passport-google-oauth20';
import pool from '../db';
import logger from '../utils/logger';

function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID as string;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string;
  
  // Check if we're in development mode with test credentials
  const isDevelopmentMode = clientID === 'test' || clientSecret === 'test';
  
  if (!clientID || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
  }

  // Get callback URL from environment or default to localhost for development
  const backendUrl = process.env.BACKEND_URL || process.env.API_BASE_URL || 'http://localhost:5000';
  const callbackURL = `${backendUrl}/auth/google/callback`;

  if (isDevelopmentMode) {
    logger.warn('Running in development mode with test OAuth credentials');
    logger.warn('OAuth will be bypassed for development purposes');
    
    // Create a mock strategy for development
    passport.use('google', new GoogleStrategy(
      {
        clientID: 'test-client-id',
        clientSecret: 'test-client-secret',
        callbackURL,
        scope: ['profile', 'email'],
      },
      async (accessToken: string, refreshToken: string | undefined, profile: any, done: VerifyCallback) => {
        try {
          // Create a mock user for development
          const mockUser = {
            id: 'dev-user-123',
            google_id: 'dev-google-123',
            email: 'dev@example.com',
            display_name: 'Development User',
            profile_picture_url: null,
            created_at: new Date(),
            updated_at: new Date(),
            last_login_at: new Date()
          };

          // Check if mock user exists in database
          const existing = await pool.query('SELECT * FROM users WHERE google_id = $1', [mockUser.google_id]);
          let user = existing.rows[0];

          if (user) {
            await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
          } else {
            const created = await pool.query(
              `INSERT INTO users (google_id, email, display_name, profile_picture_url, username, username_set_at)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
              [mockUser.google_id, mockUser.email, mockUser.display_name, mockUser.profile_picture_url, null, null]
            );
            user = created.rows[0];
          }

          done(null, user);
        } catch (err) {
          done(err as Error, undefined);
        }
      }
    ));
  } else {
    // Production OAuth configuration
    logger.info('Configuring Google OAuth with callback URL', { callbackURL });
    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL,
          scope: ['profile', 'email', 'openid'],
        },
        async (
          accessToken: string,
          refreshToken: string | undefined,
          profile: any,
          done: VerifyCallback
        ) => {
          try {
            logger.debug('Google OAuth profile received', {
              id: profile.id,
              displayName: profile.displayName,
              email: profile.emails?.[0]?.value,
              hasPhotos: !!profile.photos?.length,
            });

            const existing = await pool.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
            let user = existing.rows[0];

            if (user) {
              logger.debug('Existing user found', { userId: user.id, displayName: user.display_name });
              await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
            } else {
              logger.info('Creating new user', { 
                googleId: profile.id,
                email: profile.emails?.[0]?.value,
                displayName: profile.displayName
              });
              const created = await pool.query(
                `INSERT INTO users (google_id, email, display_name, profile_picture_url, username, username_set_at)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [
                  profile.id,
                  profile.emails?.[0]?.value ?? null,
                  profile.displayName,
                  profile.photos?.[0]?.value ?? null,
                  null, // username starts as null
                  null  // username_set_at starts as null
                ]
              );
              user = created.rows[0];
              logger.info('New user created', { userId: user.id, displayName: user.display_name });
            }

            done(null, user);
          } catch (err: any) {
            logger.error('Google OAuth error', { 
              error: err.message, 
              stack: err.stack 
            });
            done(err as Error, undefined);
          }
        }
      )
    );
  }
}

export default configurePassport;
