"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const path_1 = __importDefault(require("path"));
const passport_2 = __importDefault(require("./config/passport"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const recommendationRoutes_1 = __importDefault(require("./routes/recommendationRoutes"));
const aiRecommendationRoutes_1 = __importDefault(require("./routes/aiRecommendationRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const profileRoutes_1 = __importDefault(require("./routes/profileRoutes"));
const socialRoutes_1 = __importDefault(require("./routes/socialRoutes"));
const feedRoutes_1 = __importDefault(require("./routes/feedRoutes"));
const friendGroupRoutes_1 = __importDefault(require("./routes/friendGroupRoutes"));
const usernameRoutes_1 = __importDefault(require("./routes/usernameRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const dbViewerRoutes_1 = __importDefault(require("./routes/dbViewerRoutes"));
const db_1 = __importDefault(require("./db"));
// Load .env file from the root directory (two levels up from backend/src)
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
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
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)({ origin: 'http://localhost:5173', credentials: true }));
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
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
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
(0, passport_2.default)();
passport_1.default.serializeUser((user, done) => done(null, user.id));
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const result = await db_1.default.query('SELECT id, google_id, email, display_name, profile_picture_url FROM users WHERE id = $1', [id]);
        done(null, result.rows[0] || false);
    }
    catch (err) {
        done(err, false);
    }
});
app.use('/auth', authRoutes_1.default);
app.use('/api/recommendations', recommendationRoutes_1.default);
app.use('/api/ai-recommendation', aiRecommendationRoutes_1.default);
app.use('/api/location', locationRoutes_1.default);
app.use('/api/profile', profileRoutes_1.default);
app.use('/api/social', socialRoutes_1.default);
app.use('/api/feed', feedRoutes_1.default);
app.use('/api/friend-groups', friendGroupRoutes_1.default);
app.use('/api/username', usernameRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/db', dbViewerRoutes_1.default);
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
