"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMentionUserIds = extractMentionUserIds;
exports.savePostMentions = savePostMentions;
exports.saveCommentMentions = saveCommentMentions;
const db_1 = __importDefault(require("../db"));
const notifications_1 = require("./notifications");
const TOKEN_REGEX = /@\[(?<id>[a-f0-9-]{36}):(?<name>[^\]]+)\]/gi;
function extractMentionUserIds(text) {
    if (!text)
        return [];
    const ids = new Set();
    let match;
    while ((match = TOKEN_REGEX.exec(text)) !== null) {
        if (match.groups?.id)
            ids.add(match.groups.id);
    }
    return Array.from(ids);
}
async function savePostMentions(recommendationId, mentionedUserIds, mentionedByUserId, contentPreview) {
    if (!mentionedUserIds.length)
        return;
    const values = mentionedUserIds.map((_, i) => `($1, $${i + 2}, $${mentionedUserIds.length + 2})`).join(', ');
    await db_1.default.query(`INSERT INTO post_mentions (recommendation_id, mentioned_user_id, mentioned_by_user_id)
     VALUES ${values}
     ON CONFLICT (recommendation_id, mentioned_user_id) DO NOTHING`, [recommendationId, ...mentionedUserIds, mentionedByUserId]);
    // Create notifications for mentioned users
    try {
        await (0, notifications_1.createMentionNotifications)(mentionedUserIds, mentionedByUserId, recommendationId, 'post', contentPreview || 'New recommendation');
    }
    catch (error) {
        console.error('Failed to create mention notifications:', error);
        // Don't fail the main operation if notifications fail
    }
}
async function saveCommentMentions(commentId, mentionedUserIds, mentionedByUserId, contentPreview) {
    if (!mentionedUserIds.length)
        return;
    const values = mentionedUserIds.map((_, i) => `($1, $${i + 2}, $${mentionedUserIds.length + 2})`).join(', ');
    await db_1.default.query(`INSERT INTO comment_mentions (comment_id, mentioned_user_id, mentioned_by_user_id)
     VALUES ${values}
     ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING`, [commentId, ...mentionedUserIds, mentionedByUserId]);
    // Create notifications for mentioned users
    try {
        await (0, notifications_1.createMentionNotifications)(mentionedUserIds, mentionedByUserId, commentId, 'comment', contentPreview || 'New comment');
    }
    catch (error) {
        console.error('Failed to create mention notifications:', error);
        // Don't fail the main operation if notifications fail
    }
}
