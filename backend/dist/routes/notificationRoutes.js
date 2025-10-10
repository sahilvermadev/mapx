"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const notifications_1 = require("../db/notifications");
const router = express_1.default.Router();
// Helper to extract user id from Bearer JWT if session user is not set
function getUserIdFromRequest(req) {
    const sessionUser = req.user;
    if (sessionUser && sessionUser.id)
        return sessionUser.id;
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
        return null;
    const token = auth.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    try {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        return payload.id || payload.user_id || null;
    }
    catch {
        return null;
    }
}
/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const notifications = await (0, notifications_1.getNotifications)(userId, limit, offset);
        res.json({
            success: true,
            data: notifications,
            pagination: {
                limit,
                offset,
                total: notifications.length
            }
        });
    }
    catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get notifications',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the current user
 */
router.get('/unread-count', async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const count = await (0, notifications_1.getUnreadNotificationCount)(userId);
        res.json({
            success: true,
            data: { count }
        });
    }
    catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PUT /api/notifications/:id/read
 * Mark a specific notification as read
 */
router.put('/:id/read', async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        console.log('Notification mark as read - userId:', userId);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const notificationId = parseInt(req.params.id);
        if (isNaN(notificationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
        }
        const success = await (0, notifications_1.markNotificationAsRead)(notificationId, userId);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found or not authorized'
            });
        }
        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    }
    catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read for the current user
 */
router.put('/mark-all-read', async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        console.log('Notification mark all read - userId:', userId);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const count = await (0, notifications_1.markAllNotificationsAsRead)(userId);
        res.json({
            success: true,
            data: { marked_count: count },
            message: `Marked ${count} notifications as read`
        });
    }
    catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * DELETE /api/notifications/:id
 * Delete a specific notification
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = getUserIdFromRequest(req);
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        const notificationId = parseInt(req.params.id);
        if (isNaN(notificationId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid notification ID'
            });
        }
        const success = await (0, notifications_1.deleteNotification)(notificationId, userId);
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found or not authorized'
            });
        }
        res.json({
            success: true,
            message: 'Notification deleted'
        });
    }
    catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
