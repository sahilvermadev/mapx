import pool from '../db';
import { createMentionNotifications } from './notifications';

const TOKEN_REGEX = /@\[(?<id>[a-f0-9-]{36}):(?<name>[^\]]+)\]/gi;

export function extractMentionUserIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    if (match.groups?.id) ids.add(match.groups.id);
  }
  return Array.from(ids);
}

export async function savePostMentions(recommendationId: number, mentionedUserIds: string[], mentionedByUserId: string, contentPreview?: string) {
  if (!mentionedUserIds.length) return;
  const values = mentionedUserIds.map((_, i) => `($1, $${i + 2}, $${mentionedUserIds.length + 2})`).join(', ');
  await pool.query(
    `INSERT INTO post_mentions (recommendation_id, mentioned_user_id, mentioned_by_user_id)
     VALUES ${values}
     ON CONFLICT (recommendation_id, mentioned_user_id) DO NOTHING`,
    [recommendationId, ...mentionedUserIds, mentionedByUserId]
  );
  
  // Create notifications for mentioned users
  try {
    await createMentionNotifications(
      mentionedUserIds,
      mentionedByUserId,
      recommendationId,
      'post',
      contentPreview || 'New recommendation'
    );
  } catch (error) {
    console.error('Failed to create mention notifications:', error);
    // Don't fail the main operation if notifications fail
  }
}

export async function saveCommentMentions(commentId: number, mentionedUserIds: string[], mentionedByUserId: string, contentPreview?: string) {
  if (!mentionedUserIds.length) return;
  const values = mentionedUserIds.map((_, i) => `($1, $${i + 2}, $${mentionedUserIds.length + 2})`).join(', ');
  await pool.query(
    `INSERT INTO comment_mentions (comment_id, mentioned_user_id, mentioned_by_user_id)
     VALUES ${values}
     ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING`,
    [commentId, ...mentionedUserIds, mentionedByUserId]
  );
  
  // Create notifications for mentioned users
  try {
    await createMentionNotifications(
      mentionedUserIds,
      mentionedByUserId,
      commentId,
      'comment',
      contentPreview || 'New comment'
    );
  } catch (error) {
    console.error('Failed to create mention notifications:', error);
    // Don't fail the main operation if notifications fail
  }
}


