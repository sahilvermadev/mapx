"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const recommendationAI_1 = require("../services/recommendationAI");
const router = express_1.default.Router();
// Note: Authentication is now handled by the JWT middleware in index.ts
// Analyze recommendation text
router.post('/analyze', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Text is required and must be a string'
            });
        }
        if (text.length < 5) {
            return res.status(400).json({
                success: false,
                error: 'Text must be at least 5 characters long'
            });
        }
        const analysis = await recommendationAI_1.recommendationAI.analyzeRecommendation(text);
        res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        console.error('Error analyzing recommendation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze recommendation'
        });
    }
});
// Generate follow-up question
router.post('/question', async (req, res) => {
    try {
        const { currentData, missingField, contentType, conversationHistory } = req.body;
        if (!missingField || !contentType) {
            return res.status(400).json({
                success: false,
                error: 'Missing field and content type are required'
            });
        }
        const question = await recommendationAI_1.recommendationAI.generateFollowUpQuestion(currentData || {}, missingField, contentType, conversationHistory || []);
        res.json({
            success: true,
            data: question
        });
    }
    catch (error) {
        console.error('Error generating follow-up question:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate follow-up question'
        });
    }
});
// Validate user response
router.post('/validate', async (req, res) => {
    try {
        const { question, userResponse, expectedField } = req.body;
        if (!question || !userResponse || !expectedField) {
            return res.status(400).json({
                success: false,
                error: 'Question, user response, and expected field are required'
            });
        }
        const validation = await recommendationAI_1.recommendationAI.validateUserResponse(question, userResponse, expectedField);
        res.json({
            success: true,
            data: validation
        });
    }
    catch (error) {
        console.error('Error validating user response:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate user response'
        });
    }
});
// Format recommendation text using LLM
router.post('/format', async (req, res) => {
    try {
        console.log('=== LLM FORMAT ENDPOINT ===');
        console.log('aiRecommendationRoutes - req.body:', req.body);
        const { data, originalText } = req.body;
        console.log('aiRecommendationRoutes - data:', data);
        console.log('aiRecommendationRoutes - originalText:', originalText);
        if (!data) {
            console.log('aiRecommendationRoutes - No data provided');
            return res.status(400).json({
                success: false,
                error: 'Data is required'
            });
        }
        console.log('aiRecommendationRoutes - Calling recommendationAI.formatRecommendationPost');
        const formattedText = await recommendationAI_1.recommendationAI.formatRecommendationPost(data, originalText);
        console.log('aiRecommendationRoutes - formattedText result:', formattedText);
        res.json({
            success: true,
            formattedText
        });
    }
    catch (error) {
        console.error('Error formatting recommendation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to format recommendation'
        });
    }
});
exports.default = router;
