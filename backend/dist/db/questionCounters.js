"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateQuestionCounters = updateQuestionCounters;
exports.onRecommendationCreated = onRecommendationCreated;
exports.onRecommendationDeleted = onRecommendationDeleted;
exports.onRecommendationUpdated = onRecommendationUpdated;
const index_1 = require("./index");
/**
 * Update question answer counters when a recommendation is created/updated/deleted
 */
async function updateQuestionCounters(questionId) {
    if (!questionId)
        return;
    try {
        // Get current answer count and last answer info
        const result = await index_1.pool.query(`
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
        await index_1.pool.query(`
      UPDATE questions 
      SET 
        answers_count = $1,
        last_answer_at = $2,
        last_answer_user_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [answers_count, last_answer_at, last_answer_user_id, questionId]);
        console.log(`Updated question ${questionId} counters: ${answers_count} answers`);
    }
    catch (error) {
        console.error(`Failed to update question counters for question ${questionId}:`, error);
        // Don't throw - this is a background operation
    }
}
/**
 * Update question counters when a recommendation is created
 */
async function onRecommendationCreated(recommendationId, questionId) {
    if (questionId) {
        await updateQuestionCounters(questionId);
    }
}
/**
 * Update question counters when a recommendation is deleted
 */
async function onRecommendationDeleted(recommendationId, questionId) {
    if (questionId) {
        await updateQuestionCounters(questionId);
    }
}
/**
 * Update question counters when a recommendation is updated (question_id might change)
 */
async function onRecommendationUpdated(recommendationId, oldQuestionId, newQuestionId) {
    // Update old question if it changed
    if (oldQuestionId && oldQuestionId !== newQuestionId) {
        await updateQuestionCounters(oldQuestionId);
    }
    // Update new question
    if (newQuestionId) {
        await updateQuestionCounters(newQuestionId);
    }
}
