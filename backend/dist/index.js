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
const passport_2 = __importDefault(require("./config/passport"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const recommendationRoutes_1 = __importDefault(require("./routes/recommendationRoutes"));
const profileRoutes_1 = __importDefault(require("./routes/profileRoutes"));
const db_1 = __importDefault(require("./db"));
dotenv_1.default.config();
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
app.use('/api/profile', profileRoutes_1.default);
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
