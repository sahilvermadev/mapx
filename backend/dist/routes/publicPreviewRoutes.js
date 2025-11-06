"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const router = express_1.default.Router();
// Public preview for a recommendation (safe fields only)
router.get('/recommendations/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid id' });
        // public recommendation preview
        const q = await db_1.default.query(`SELECT 
         r.id as recommendation_id,
         r.title, r.description, r.rating, r.created_at,
         r.content_type,
         p.name as place_name, p.address as place_address,
         u.id as user_id, u.display_name as user_name, u.profile_picture_url as user_picture,
         0::int as likes_count,
         '0'::text as comments_count,
         false as is_liked_by_current_user
       FROM recommendations r
       LEFT JOIN places p ON r.place_id = p.id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.id = $1`, [id]);
        const row = q.rows[0];
        if (!row)
            return res.status(404).json({ success: false, error: 'Not found' });
        res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
        return res.json({ success: true, data: row });
    }
    catch (e) {
        console.error('Public preview error (recommendations):', e);
        return res.status(500).json({ success: false, error: 'Failed to load post' });
    }
});
// Public preview for a question (safe fields only)
router.get('/questions/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ error: 'Invalid id' });
        // public question preview
        const q = await db_1.default.query(`SELECT 
         q.id, q.text, q.created_at,
         u.id as user_id, u.display_name as user_name, u.profile_picture_url as user_picture,
         0::int as answers_count
       FROM questions q
       LEFT JOIN users u ON q.user_id = u.id
       WHERE q.id = $1`, [id]);
        const row = q.rows[0];
        if (!row)
            return res.status(404).json({ success: false, error: 'Not found' });
        res.set('Cache-Control', 'public, max-age=60, s-maxage=300');
        return res.json({ success: true, data: row });
    }
    catch (e) {
        console.error('Public preview error (questions):', e);
        return res.status(500).json({ success: false, error: 'Failed to load question' });
    }
});
exports.default = router;
