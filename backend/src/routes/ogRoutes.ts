import express from 'express';
import pool from '../db';

const router = express.Router();

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string));
}

router.get('/post/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).send('Invalid id');
    const q = await pool.query(
      `SELECT r.id as recommendation_id, r.title, r.description, r.rating, r.created_at,
              p.name as place_name, p.address as place_address,
              u.display_name as author_name
         FROM recommendations r
         LEFT JOIN places p ON r.place_id = p.id
         LEFT JOIN users u ON r.user_id = u.id
        WHERE r.id = $1`,
      [id]
    );
    const row = q.rows[0];
    if (!row) return res.status(404).send('Not found');

    const title = escapeHtml(row.title || row.place_name || 'Recommendation on Recce');
    const desc = escapeHtml(row.description || `${row.author_name || 'Someone'} shared a recommendation`);
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = `${frontend}/post/${id}`;
    const image = `${frontend}/vite.svg`;

    res.set('Content-Type', 'text/html').send(`<!doctype html>
<html><head>
  <meta charset="utf-8">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <meta http-equiv="refresh" content="0; url='${url}'" />
</head><body>
  <script>location.replace(${JSON.stringify(url)});</script>
</body></html>`);
  } catch (e) {
    console.error('OG route error (post):', e);
    res.status(500).send('Server error');
  }
});

router.get('/question/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).send('Invalid id');
    const q = await pool.query(
      `SELECT q.id, q.text, u.display_name as author_name
         FROM questions q
         LEFT JOIN users u ON q.user_id = u.id
        WHERE q.id = $1`,
      [id]
    );
    const row = q.rows[0];
    if (!row) return res.status(404).send('Not found');

    const title = 'Question on Recce';
    const desc = escapeHtml(row.text || `${row.author_name || 'Someone'} asked a question`);
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    const url = `${frontend}/question/${id}`;
    const image = `${frontend}/vite.svg`;

    res.set('Content-Type', 'text/html').send(`<!doctype html>
<html><head>
  <meta charset="utf-8">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <meta http-equiv="refresh" content="0; url='${url}'" />
</head><body>
  <script>location.replace(${JSON.stringify(url)});</script>
</body></html>`);
  } catch (e) {
    console.error('OG route error (question):', e);
    res.status(500).send('Server error');
  }
});

export default router;





