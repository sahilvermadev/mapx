"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../db"));
const router = express_1.default.Router();
// Get all tables
router.get('/tables', async (req, res) => {
    try {
        const result = await db_1.default.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching tables:', error);
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});
// Get recommendations
router.get('/recommendations', async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const result = await db_1.default.query(`
      SELECT 
        r.id,
        r.content_type,
        r.title,
        r.description,
        r.rating,
        r.visibility,
        r.created_at,
        u.display_name as user_name,
        p.name as place_name
      FROM recommendations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN places p ON r.place_id = p.id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2;
    `, [limit, offset]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});
// Get services
router.get('/services', async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const result = await db_1.default.query(`
      SELECT 
        s.id,
        s.name,
        s.service_type,
        s.business_name,
        s.phone_number,
        s.email,
        s.address,
        s.website,
        s.created_at,
        COUNT(sn.id) as name_variations_count
      FROM services s
      LEFT JOIN service_names sn ON s.id = sn.service_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2;
    `, [limit, offset]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});
// Get service names for a specific service
router.get('/services/:id/names', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db_1.default.query(`
      SELECT name, frequency, confidence, last_seen
      FROM service_names
      WHERE service_id = $1
      ORDER BY frequency DESC, confidence DESC;
    `, [id]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching service names:', error);
        res.status(500).json({ error: 'Failed to fetch service names' });
    }
});
// Get places
router.get('/places', async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const result = await db_1.default.query(`
      SELECT 
        p.id,
        p.name,
        p.address,
        p.lat,
        p.lng,
        p.created_at,
        c.name as category_name
      FROM places p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2;
    `, [limit, offset]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching places:', error);
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});
// Get users
router.get('/users', async (req, res) => {
    try {
        const { limit = 10, offset = 0 } = req.query;
        const result = await db_1.default.query(`
      SELECT 
        id,
        google_id,
        email,
        display_name,
        username,
        created_at,
        last_login_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2;
    `, [limit, offset]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// Get database stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await Promise.all([
            db_1.default.query('SELECT COUNT(*) as count FROM users'),
            db_1.default.query('SELECT COUNT(*) as count FROM recommendations'),
            db_1.default.query('SELECT COUNT(*) as count FROM services'),
            db_1.default.query('SELECT COUNT(*) as count FROM places'),
            db_1.default.query('SELECT COUNT(*) as count FROM service_names')
        ]);
        res.json({
            users: parseInt(stats[0].rows[0].count),
            recommendations: parseInt(stats[1].rows[0].count),
            services: parseInt(stats[2].rows[0].count),
            places: parseInt(stats[3].rows[0].count),
            service_names: parseInt(stats[4].rows[0].count)
        });
    }
    catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
exports.default = router;
