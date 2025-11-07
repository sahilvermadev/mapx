import express from 'express';
import pool from '../db';
import logger from '../utils/logger';

const router = express.Router();

function escapeHtml(s: string) {
  return (s || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string));
}

// Comprehensive bot detection regex
const BOT_PATTERN = /bot|crawler|spider|crawling|facebookexternalhit|twitterbot|linkedinbot|whatsapp|slackbot|telegram|discord|skype|pinterest|reddit|tumblr|flipboard|snapchat|applebot|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver/i;

function isBot(userAgent: string): boolean {
  return BOT_PATTERN.test(userAgent);
}

function getFrontendUrl(): string {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  // Ensure URL doesn't end with slash
  return frontend.replace(/\/$/, '');
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

    const title = escapeHtml(row.title || row.place_name || 'Recommendation on Rekky');
    const desc = escapeHtml((row.description || `${row.author_name || 'Someone'} shared a recommendation`).substring(0, 200)); // Limit description length
    const frontend = getFrontendUrl();
    const url = `${frontend}/post/${id}`;
    const image = `${frontend}/vite.svg`;
    const siteName = 'Rekky';

    // Check if this is a bot/crawler (for OG tags) or a regular browser (for redirect)
    const userAgent = req.headers['user-agent'] || '';
    const botDetected = isBot(userAgent);
    
    if (botDetected) {
      // Return HTML with OG tags for social media crawlers
      // Set cache headers (OG tags don't change often, but allow some freshness)
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      });
      
      res.send(`<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="canonical" href="${url}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${url}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:site" content="@rekky">
</head><body>
  <h1>${title}</h1>
  <p>${desc}</p>
  <p><a href="${url}">View on Rekky</a></p>
</body></html>`);
    } else {
      // For regular browsers, use HTTP 302 redirect (temporary redirect for share links)
      // This is more reliable than client-side redirects and works with CSP
      res.redirect(302, url);
    }
  } catch (e) {
    logger.error('OG route error (post)', { error: e, id: req.params.id });
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

    const title = 'Question on Rekky';
    const desc = escapeHtml((row.text || `${row.author_name || 'Someone'} asked a question`).substring(0, 200)); // Limit description length
    const frontend = getFrontendUrl();
    const url = `${frontend}/question/${id}`;
    const image = `${frontend}/vite.svg`;
    const siteName = 'Rekky';

    // Check if this is a bot/crawler (for OG tags) or a regular browser (for redirect)
    const userAgent = req.headers['user-agent'] || '';
    const botDetected = isBot(userAgent);
    
    if (botDetected) {
      // Return HTML with OG tags for social media crawlers
      // Set cache headers (OG tags don't change often, but allow some freshness)
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      });
      
      res.send(`<!doctype html>
<html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="canonical" href="${url}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="en_US">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${url}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:site" content="@rekky">
</head><body>
  <h1>${title}</h1>
  <p>${desc}</p>
  <p><a href="${url}">View on Rekky</a></p>
</body></html>`);
    } else {
      // For regular browsers, use HTTP 302 redirect (temporary redirect for share links)
      // This is more reliable than client-side redirects and works with CSP
      res.redirect(302, url);
    }
  } catch (e) {
    logger.error('OG route error (question)', { error: e, id: req.params.id });
    res.status(500).send('Server error');
  }
});

export default router;





