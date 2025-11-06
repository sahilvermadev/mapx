import express from 'express';
import pool from '../db';
import { embeddingQueue } from '../services/embeddingQueue';
import { insertRecommendation, type RecommendationData } from '../db/recommendations';
import { upsertService } from '../services/serviceDeduplication';
import { extractServiceType } from '../utils/nameSimilarity';
import { upsertPlace } from '../db/places';

const router = express.Router();

// POST /api/questions  { text, visibility?, labels?, metadata? }
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { text, visibility = 'friends', labels, metadata } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    if (!['friends', 'public'].includes(visibility)) {
      return res.status(400).json({ success: false, error: 'Invalid visibility' });
    }

    const q = await pool.query(
      `INSERT INTO questions (user_id, text, visibility, labels, metadata)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
      [userId, text.trim(), visibility, Array.isArray(labels) ? labels : null, metadata || {}]
    );

    const id = q.rows[0].id;
    try {
      await embeddingQueue.enqueue('question', id, { text: text.trim(), labels, metadata }, 'normal');
    } catch (e) {
      // best-effort; ignore enqueue failure
      console.warn('Failed to enqueue question embedding', e);
    }

    return res.status(201).json({ success: true, data: { id, created_at: q.rows[0].created_at } });
  } catch (error) {
    console.error('Error creating question:', error);
    return res.status(500).json({ success: false, error: 'Failed to create question' });
  }
});

// GET /api/questions  (feed-like list)
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    const cursorCreatedAt = (req.query.cursorCreatedAt as string) || undefined;
    const cursorId = req.query.cursorId ? parseInt(req.query.cursorId as string, 10) : undefined;

    const params: any[] = [userId];
    let cursorClause = '';
    if (cursorCreatedAt && cursorId) {
      params.push(cursorCreatedAt, cursorId);
      cursorClause = ` AND (q.created_at, q.id) < ($2::timestamptz, $3::int)`;
    }
    params.push(limit + 1);

    const sql = `
      SELECT 
        q.*, 
        u.display_name as user_name, 
        u.profile_picture_url as user_picture
      FROM questions q
      JOIN users u ON u.id = q.user_id
      WHERE q.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $1)
        AND q.visibility IN ('public','friends')
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks 
          WHERE (blocker_id = $1 AND blocked_id = q.user_id) 
             OR (blocker_id = q.user_id AND blocked_id = $1)
        )
        ${cursorClause}
      ORDER BY q.created_at DESC
      LIMIT $${params.length}
    `;

    const result = await pool.query(sql, params);
    const hasNext = result.rows.length > limit;
    const data = hasNext ? result.rows.slice(0, limit) : result.rows;

    return res.json({ success: true, data, nextCursor: hasNext && data.length > 0 ? { createdAt: data[data.length - 1].created_at, id: data[data.length - 1].id } : null });
  } catch (error) {
    console.error('Error listing questions:', error);
    return res.status(500).json({ success: false, error: 'Failed to list questions' });
  }
});

// GET /api/questions/:id  (get single question)
router.get('/:id', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const questionId = parseInt(req.params.id, 10);

    console.log(`[GET /api/questions/${questionId}] User: ${userId}`);

    if (!Number.isFinite(questionId)) {
      return res.status(400).json({ success: false, error: 'Invalid question ID' });
    }

    const result = await pool.query(
      `SELECT 
        q.*, 
        u.display_name as user_name, 
        u.profile_picture_url as user_picture
      FROM questions q
      JOIN users u ON u.id = q.user_id
      WHERE q.id = $1
        AND (
          q.visibility = 'public' 
          OR (q.visibility = 'friends' AND (
            q.user_id = $2 
            OR EXISTS (SELECT 1 FROM user_follows WHERE follower_id = $2 AND following_id = q.user_id)
          ))
        )
        AND NOT EXISTS (
          SELECT 1 FROM user_blocks 
          WHERE (blocker_id = $2 AND blocked_id = q.user_id) 
             OR (blocker_id = q.user_id AND blocked_id = $2)
        )`,
      [questionId, userId]
    );

    console.log(`[GET /api/questions/${questionId}] Query result: ${result.rows.length} rows`);
    
    if (result.rows.length === 0) {
      console.log(`[GET /api/questions/${questionId}] Question not found for user ${userId}`);
      return res.status(404).json({ success: false, error: 'Question not found' });
    }

    console.log(`[GET /api/questions/${questionId}] Question found: ${result.rows[0].text}`);
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching question:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch question' });
  }
});

// POST /api/questions/:questionId/answers  { recommendation_id? , recommendation_payload?, text?, metadata? }
router.post('/:questionId/answers', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const questionId = parseInt(req.params.questionId, 10);
    const { recommendation_id, recommendation_payload, text, metadata } = req.body || {};

    if (!Number.isFinite(questionId)) {
      return res.status(400).json({ success: false, error: 'Invalid question id' });
    }

    let recId: number | undefined = recommendation_id;
    if (!recId && recommendation_payload) {
      const payload: RecommendationData = {
        ...(recommendation_payload as any),
        user_id: userId,
        question_id: questionId, // Link the recommendation to the question
        metadata: { ...((recommendation_payload && (recommendation_payload as any).metadata) || {}), questionContext: { question_id: questionId } },
        auto_generate_embedding: true,
      } as any;

      // Handle place creation if this is a place recommendation
      if (payload.content_type === 'place' && !payload.place_id) {
        try {
          // Extract place data from the payload
          const placeData = {
            google_place_id: payload.content_data?.location_google_place_id || null,
            name: payload.title || 'Unnamed Place',
            address: payload.content_data?.location_address || payload.content_data?.location || null,
            category_name: payload.content_data?.category || null,
            lat: payload.content_data?.location_lat || null,
            lng: payload.content_data?.location_lng || null,
            metadata: payload.content_data || {}
          };

          // Create or find the place
          const placeId = await upsertPlace(placeData);
          payload.place_id = placeId;
          
          console.log('Created place for question answer:', { placeId, placeName: placeData.name });
        } catch (error) {
          console.error('Failed to create place for question answer:', error);
          return res.status(500).json({ success: false, error: 'Failed to create place' });
        }
      }

      // Handle service creation if this is a service recommendation
      if (payload.content_type === 'service' && !payload.service_id) {
        try {
          // Extract service data from the payload
          const serviceData = {
            name: payload.title || 'Unnamed Service',
            phone_number: payload.content_data?.contact_info?.phone || undefined,
            email: payload.content_data?.contact_info?.email || undefined,
            service_type: payload.content_data?.specialities ? extractServiceType(payload.content_data.specialities, '') || undefined : undefined,
            business_name: payload.content_data?.business_name || undefined,
            address: payload.content_data?.location || undefined,
            website: payload.content_data?.website || undefined,
            metadata: payload.content_data || {}
          };

          // Create or find the service
          const serviceResult = await upsertService(serviceData);
          payload.service_id = serviceResult.serviceId;
          
          console.log('Created service for question answer:', { serviceId: serviceResult.serviceId, serviceName: serviceData.name });
        } catch (error) {
          console.error('Failed to create service for question answer:', error);
          return res.status(500).json({ success: false, error: 'Failed to create service' });
        }
      }

      recId = await insertRecommendation(payload);
    } else if (recId) {
      // If recommendation already exists, update it to link to the question
      await pool.query(
        `UPDATE recommendations SET question_id = $1 WHERE id = $2 AND user_id = $3`,
        [questionId, recId, userId]
      );
    }

    if (!recId) {
      return res.status(400).json({ success: false, error: 'Missing recommendation' });
    }

    // Note: The answers_count is automatically updated by the insertRecommendation function
    // through the onRecommendationCreated callback, so we don't need to manually increment it here

    // Get the recommendation details to return
    const recResult = await pool.query(
      `SELECT id, created_at FROM recommendations WHERE id = $1`,
      [recId]
    );

    if (recResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recommendation not found' });
    }

    return res.status(201).json({ 
      success: true, 
      data: { 
        id: recId, 
        created_at: recResult.rows[0].created_at, 
        recommendation_id: recId 
      } 
    });
  } catch (error) {
    console.error('Error creating answer:', error);
    return res.status(500).json({ success: false, error: 'Failed to create answer' });
  }
});

export default router;

// GET /api/questions/:questionId/answers
router.get('/:questionId/answers', async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const questionId = parseInt(req.params.questionId, 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);
    if (!Number.isFinite(questionId)) {
      return res.status(400).json({ success: false, error: 'Invalid question id' });
    }

    const result = await pool.query(
      `SELECT 
         r.id,
         r.user_id,
         u.display_name AS user_name,
         u.profile_picture_url AS user_picture,
         r.description AS text,
         r.metadata,
         r.created_at,
         r.id AS recommendation_id,
         r.title AS recommendation_title,
         r.description AS recommendation_description,
         r.rating AS recommendation_rating,
         r.labels AS recommendation_labels,
         r.place_id,
         p.name AS place_name,
         p.address AS place_address
       FROM recommendations r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN places p ON p.id = r.place_id
       WHERE r.question_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks 
           WHERE (blocker_id = $2 AND blocked_id = r.user_id) 
              OR (blocker_id = r.user_id AND blocked_id = $2)
         )
       ORDER BY r.created_at DESC
       LIMIT $3`,
      [questionId, userId, limit]
    );
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error listing answers:', error);
    return res.status(500).json({ success: false, error: 'Failed to list answers' });
  }
});

