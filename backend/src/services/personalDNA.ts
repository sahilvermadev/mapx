import pool from '../db';

export interface PersonalTasteDNA {
  priceRange: string;
  freshnessDays: number;
  topReviewers: Array<{ name: string; trust: number }>;
  loves: string[];
  hates: string[];
}

const PRICE_LEVEL_MAP: Record<string, string> = {
  '1': '₹0–500',
  '2': '₹500–1,000',
  '3': '₹1,000–2,000',
  '4': '₹2,000+'
};

function mapPriceLevel(level: string | null): string {
  if (!level) return '₹500–1,500';
  return PRICE_LEVEL_MAP[level] || '₹500–1,500';
}

export async function getPersonalTasteDNA(userId: string): Promise<PersonalTasteDNA> {
  const defaults: PersonalTasteDNA = {
    priceRange: '₹500–1,500',
    freshnessDays: 60,
    topReviewers: [],
    loves: [],
    hates: []
  };

  try {
    const [priceRes, freshnessRes, reviewerRes, lovesRes, hatesRes] = await Promise.all([
      pool.query(
        `SELECT content_data->>'price_level' as price_level, COUNT(*) 
         FROM recommendations 
         WHERE user_id = $1 
           AND content_data ? 'price_level'
         GROUP BY 1
         ORDER BY COUNT(*) DESC
         LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400) AS avg_days
         FROM recommendations
         WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT u.display_name, uf.following_id, COUNT(r.id) as rec_count
         FROM user_follows uf
         JOIN users u ON u.id = uf.following_id
         LEFT JOIN recommendations r 
           ON r.user_id = uf.following_id 
          AND r.visibility IN ('friends','public')
         WHERE uf.follower_id = $1
         GROUP BY u.display_name, uf.following_id
         ORDER BY rec_count DESC NULLS LAST
         LIMIT 3`,
        [userId]
      ),
      pool.query(
        `SELECT label, COUNT(*) 
         FROM (
           SELECT unnest(labels) AS label
           FROM recommendations
           WHERE user_id = $1 AND labels IS NOT NULL
         ) t
         GROUP BY label
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT label, COUNT(*)
         FROM (
           SELECT jsonb_array_elements_text(metadata->'dislikes') AS label
           FROM recommendations
           WHERE user_id = $1 AND metadata ? 'dislikes'
         ) t
         GROUP BY label
         ORDER BY COUNT(*) DESC
         LIMIT 5`,
        [userId]
      )
    ]);

    const priceRange = mapPriceLevel(priceRes.rows[0]?.price_level || null);
    const freshnessDays = Math.max(
      7,
      Math.min(
        120,
        Math.round(freshnessRes.rows[0]?.avg_days || defaults.freshnessDays)
      )
    );

    const topReviewers = reviewerRes.rows.map((row) => ({
      name: row.display_name || 'Friend',
      trust: Math.min(99, 60 + Number(row.rec_count || 0) * 5)
    }));

    const loves = lovesRes.rows.map((row) => row.label).filter(Boolean);
    const hates = hatesRes.rows.map((row) => row.label).filter(Boolean);

    return {
      priceRange,
      freshnessDays,
      topReviewers,
      loves,
      hates
    };
  } catch (error) {
    console.error('Failed to build personal taste DNA:', error);
    return defaults;
  }
}



