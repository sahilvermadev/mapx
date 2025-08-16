"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/config/passport.ts
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const db_1 = __importDefault(require("../db"));
function configurePassport() {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    // Check if we're in development mode with test credentials
    const isDevelopmentMode = clientID === 'test' || clientSecret === 'test';
    if (!clientID || !clientSecret) {
        throw new Error('Missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET');
    }
    if (isDevelopmentMode) {
        console.log('⚠️  Running in development mode with test OAuth credentials');
        console.log('⚠️  OAuth will be bypassed for development purposes');
        // Create a mock strategy for development
        passport_1.default.use('google', new passport_google_oauth20_1.Strategy({
            clientID: 'test-client-id',
            clientSecret: 'test-client-secret',
            callbackURL: 'http://localhost:5000/auth/google/callback',
            scope: ['profile', 'email'],
        }, async (accessToken, refreshToken, profile, done) => {
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
                const existing = await db_1.default.query('SELECT * FROM users WHERE google_id = $1', [mockUser.google_id]);
                let user = existing.rows[0];
                if (user) {
                    await db_1.default.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
                }
                else {
                    const created = await db_1.default.query(`INSERT INTO users (google_id, email, display_name, profile_picture_url)
               VALUES ($1, $2, $3, $4) RETURNING *`, [mockUser.google_id, mockUser.email, mockUser.display_name, mockUser.profile_picture_url]);
                    user = created.rows[0];
                }
                done(null, user);
            }
            catch (err) {
                done(err, undefined);
            }
        }));
    }
    else {
        // Production OAuth configuration
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID,
            clientSecret,
            callbackURL: 'http://localhost:5000/auth/google/callback',
            scope: ['profile', 'email'],
        }, async (accessToken, refreshToken, profile, done) => {
            try {
                const existing = await db_1.default.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
                let user = existing.rows[0];
                if (user) {
                    await db_1.default.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
                }
                else {
                    const created = await db_1.default.query(`INSERT INTO users (google_id, email, display_name, profile_picture_url)
                 VALUES ($1, $2, $3, $4) RETURNING *`, [
                        profile.id,
                        profile.emails?.[0]?.value ?? null,
                        profile.displayName,
                        profile.photos?.[0]?.value ?? null,
                    ]);
                    user = created.rows[0];
                }
                done(null, user);
            }
            catch (err) {
                done(err, undefined);
            }
        }));
    }
}
exports.default = configurePassport;
