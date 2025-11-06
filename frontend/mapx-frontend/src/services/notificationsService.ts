import { apiClient, type ApiResponse } from './apiClient';

// Types for notifications
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

export interface NotificationData {
  mentioned_by_user_id?: string;
  content_id?: number;
  content_type?: 'post' | 'comment';
  content_preview?: string;
  // Question answer notification fields
  question_id?: number;
  answered_by_user_id?: string;
  recommendation_id?: number;
  question_preview?: string;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
}

// Notifications API service
export const notificationsApi = {
  /**
   * Get notifications for the current user
   */
  async getNotifications(
    currentUserId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<ApiResponse<Notification[]>> {
    return apiClient.get('/notifications', { 
      currentUserId, 
      limit, 
      offset 
    });
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(currentUserId: string): Promise<ApiResponse<{ count: number }>> {
    return apiClient.get('/notifications/unread-count', { currentUserId });
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: number, currentUserId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.put(`/notifications/${notificationId}/read`, { currentUserId });
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(currentUserId: string): Promise<ApiResponse<{ marked_count: number; message: string }>> {
    return apiClient.put('/notifications/mark-all-read', { currentUserId });
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: number, currentUserId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete(`/notifications/${notificationId}`, { currentUserId });
  }
};

// Helper functions for notification display
export const notificationHelpers = {
  /**
   * Format notification message for display
   */
  formatMessage(notification: Notification): string {
    return notification.message;
  },

  /**
   * Get notification type display name
   */
  getTypeDisplayName(type: string): string {
    switch (type) {
      case 'mention':
        return 'Mention';
      case 'like':
        return 'Like';
      case 'comment':
        return 'Comment';
      case 'follow':
        return 'Follow';
      case 'question_answered':
        return 'Question Answered';
      default:
        return 'Notification';
    }
  },

  /**
   * Get notification icon based on type
   */
  getTypeIcon(type: string): string {
    switch (type) {
      case 'mention':
        return '@';
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'follow':
        return '👤';
      case 'question_answered':
        return '❓';
      default:
        return '🔔';
    }
  },

  /**
   * Check if notification is recent (within last 24 hours)
   */
  isRecent(notification: Notification): boolean {
    const createdAt = new Date(notification.created_at);
    const now = new Date();
    const diffInHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return diffInHours < 24;
  },

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(notification: Notification): string {
    const createdAt = new Date(notification.created_at);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }
};


