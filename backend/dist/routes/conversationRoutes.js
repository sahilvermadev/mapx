"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const conversationAI_1 = require("../services/conversationAI");
const router = express_1.default.Router();
// Temporary authentication middleware (will be replaced with proper auth)
const requireAuth = (req, res, next) => {
    // For now, we'll use a mock user ID from query params
    // In production, this would come from JWT token
    const userId = req.query.currentUserId || req.body.currentUserId;
    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    req.user = { id: userId };
    next();
};
/**
 * POST /api/conversation/chat
 * Process a conversation message
 */
router.post('/chat', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { message, session_id } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }
        // Generate session ID if not provided
        const sessionId = session_id || `session_${userId}_${Date.now()}`;
        const result = await conversationAI_1.conversationAI.processMessage(sessionId, userId, message.trim());
        res.json({
            success: true,
            data: {
                response: result.response,
                action: result.action,
                session_id: sessionId,
                content_type: result.content_type,
                extracted_data: result.extracted_data
            }
        });
    }
    catch (error) {
        console.error('Error processing conversation message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process message',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /api/conversation/save
 * Save extracted data from conversation
 */
router.post('/save', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { extracted_data, content_type } = req.body;
        if (!extracted_data || !content_type) {
            return res.status(400).json({
                success: false,
                message: 'Extracted data and content type are required'
            });
        }
        const result = await conversationAI_1.conversationAI.saveExtractedData(extracted_data, content_type, userId);
        res.json({
            success: result.success,
            data: {
                place_id: result.place_id,
                annotation_id: result.annotation_id
            },
            message: result.message
        });
    }
    catch (error) {
        console.error('Error saving extracted data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save data',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/conversation/start
 * Start a new conversation session
 */
router.get('/start', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const sessionId = `session_${userId}_${Date.now()}`;
        res.json({
            success: true,
            data: {
                session_id: sessionId,
                welcome_message: "Hi! I'm here to help you share local knowledge. What would you like to tell me about? A place, service, tip, or contact?"
            }
        });
    }
    catch (error) {
        console.error('Error starting conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start conversation',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
