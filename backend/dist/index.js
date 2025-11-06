"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
require("./config/env");
const passport_1 = __importDefault(require("passport"));
const passport_2 = __importDefault(require("./config/passport"));
const auth_1 = require("./middleware/auth");
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
const questionRoutes_1 = __importDefault(require("./routes/questionRoutes"));
const publicPreviewRoutes_1 = __importDefault(require("./routes/publicPreviewRoutes"));
const ogRoutes_1 = __importDefault(require("./routes/ogRoutes"));
// env is loaded by ./config/env
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
// CORS configuration with environment-driven origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173']; // Default for development
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json());
// JWT-only authentication (no sessions)
app.use(passport_1.default.initialize());
(0, passport_2.default)();
// OAuth routes (no JWT required)
app.use('/auth', authRoutes_1.default);
// Public, unauthenticated routes
app.use('/api/public', publicPreviewRoutes_1.default);
app.use('/share', ogRoutes_1.default);
// All API routes require JWT authentication
app.use('/api/recommendations', auth_1.authenticateJWT, recommendationRoutes_1.default);
app.use('/api/ai-recommendation', auth_1.authenticateJWT, aiRecommendationRoutes_1.default);
app.use('/api/location', auth_1.authenticateJWT, locationRoutes_1.default);
app.use('/api/profile', auth_1.authenticateJWT, profileRoutes_1.default);
app.use('/api/social', auth_1.authenticateJWT, socialRoutes_1.default);
app.use('/api/feed', auth_1.authenticateJWT, feedRoutes_1.default);
app.use('/api/friend-groups', auth_1.authenticateJWT, friendGroupRoutes_1.default);
app.use('/api/username', auth_1.authenticateJWT, usernameRoutes_1.default);
app.use('/api/notifications', auth_1.authenticateJWT, notificationRoutes_1.default);
app.use('/api/db', auth_1.authenticateJWT, dbViewerRoutes_1.default);
app.use('/api/questions', auth_1.authenticateJWT, questionRoutes_1.default);
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
