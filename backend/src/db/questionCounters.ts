import { pool } from './index';

/**
 * Update question answer counters when a recommendation is created/updated/deleted
 */
export async function updateQuestionCounters(questionId: number): Promise<void> {
  if (!questionId) return;

  try {
    // Get current answer count and last answer info
    const result = await pool.query(`
      SELECT 
        COUNT(*) as answers_count,
        MAX(created_at) as last_answer_at,
        (SELECT user_id FROM recommendations 
         WHERE question_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1) as last_answer_user_id
      FROM recommendations 
      WHERE question_id = $1
    `, [questionId]);

    const { answers_count, last_answer_at, last_answer_user_id } = result.rows[0];

    // Update the question with new counters
    await pool.query(`
      UPDATE questions 
      SET 
        answers_count = $1,
        last_answer_at = $2,
        last_answer_user_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [answers_count, last_answer_at, last_answer_user_id, questionId]);

    console.log(`Updated question ${questionId} counters: ${answers_count} answers`);
  } catch (error) {
    console.error(`Failed to update question counters for question ${questionId}:`, error);
    // Don't throw - this is a background operation
  }
}

/**
 * Update question counters when a recommendation is created
 */
export async function onRecommendationCreated(recommendationId: number, questionId?: number): Promise<void> {
  if (questionId) {
    await updateQuestionCounters(questionId);
  }
}

/**
 * Update question counters when a recommendation is deleted
 */
export async function onRecommendationDeleted(recommendationId: number, questionId?: number): Promise<void> {
  if (questionId) {
    await updateQuestionCounters(questionId);
  }
}

/**
 * Update question counters when a recommendation is updated (question_id might change)
 */
export async function onRecommendationUpdated(
  recommendationId: number, 
  oldQuestionId?: number, 
  newQuestionId?: number
): Promise<void> {
  // Update old question if it changed
  if (oldQuestionId && oldQuestionId !== newQuestionId) {
    await updateQuestionCounters(oldQuestionId);
  }
  
  // Update new question
  if (newQuestionId) {
    await updateQuestionCounters(newQuestionId);
  }
}
