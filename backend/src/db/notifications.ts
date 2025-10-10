import pool from '../db';

export interface Notification {
  id: number;
  user_id: string;
  type: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationData {
  user_id: string;
  type: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Create a new notification
 */
export async function createNotification(data: CreateNotificationData): Promise<number> {
  const { user_id, type, message, data: notificationData = {} } = data;
  
  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, message, data)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [user_id, type, message, JSON.stringify(notificationData)]
  );
  
  return result.rows[0].id;
}

/**
 * Get notifications for a user with pagination
 */
export async function getNotifications(
  userId: string, 
  limit: number = 50, 
  offset: number = 0
): Promise<Notification[]> {
  const result = await pool.query(
    `SELECT id, user_id, type, message, data, is_read, read_at, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  
  return result.rows.map((row: any) => ({
    ...row,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
  }));
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count
     FROM notifications
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  
  return parseInt(result.rows[0].count);
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: number, userId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );
  
  return result.rows.length > 0;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND is_read = false
     RETURNING id`,
    [userId]
  );
  
  return result.rows.length;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: number, userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM notifications
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );
  
  return result.rows.length > 0;
}

/**
 * Create mention notifications for multiple users
 */
export async function createMentionNotifications(
  mentionedUserIds: string[],
  mentionedByUserId: string,
  contentId: number,
  contentType: 'post' | 'comment',
  contentPreview: string
): Promise<void> {
  if (mentionedUserIds.length === 0) return;
  
  // Get the user who mentioned others
  const userResult = await pool.query(
    `SELECT display_name, username FROM users WHERE id = $1`,
    [mentionedByUserId]
  );
  
  if (userResult.rows.length === 0) return;
  
  const mentionedByUser = userResult.rows[0];
  const displayName = mentionedByUser.display_name || mentionedByUser.username || 'Someone';
  
  // Create notifications for each mentioned user
  const notifications = mentionedUserIds.map(userId => ({
    user_id: userId,
    type: 'mention',
    message: `${displayName} mentioned you in a ${contentType}`,
    data: {
      mentioned_by_user_id: mentionedByUserId,
      content_id: contentId,
      content_type: contentType,
      content_preview: contentPreview.substring(0, 100) + (contentPreview.length > 100 ? '...' : '')
    }
  }));
  
  // Insert all notifications in a single transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const notification of notifications) {
      await client.query(
        `INSERT INTO notifications (user_id, type, message, data)
         VALUES ($1, $2, $3, $4)`,
        [notification.user_id, notification.type, notification.message, JSON.stringify(notification.data)]
      );
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
