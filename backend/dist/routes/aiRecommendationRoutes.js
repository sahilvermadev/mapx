"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const recommendationAI_1 = require("../services/recommendationAI");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = express_1.default.Router();
// Timeout configuration for AI requests
const AI_REQUEST_TIMEOUT = 30000; // 30 seconds
const AI_MAX_RETRIES = 2;
const AI_RETRY_DELAY = 1000; // 1 second
// Analyze recommendation text
router.post('/analyze', rateLimiter_1.aiRateLimiter, async (req, res) => {
    const startTime = Date.now();
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
        // Add timeout handling
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI request timeout')), AI_REQUEST_TIMEOUT);
        });
        const analysisPromise = recommendationAI_1.recommendationAI.analyzeRecommendation(text);
        const analysis = await Promise.race([analysisPromise, timeoutPromise]);
        const duration = Date.now() - startTime;
        console.log(`AI analysis completed in ${duration}ms`);
        res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Error analyzing recommendation after ${duration}ms:`, error);
        if (error instanceof Error && error.message === 'AI request timeout') {
            res.status(408).json({
                success: false,
                error: 'AI analysis request timed out. Please try again.'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to analyze recommendation'
            });
        }
    }
});
// Generate follow-up question
router.post('/question', rateLimiter_1.aiRateLimiter, async (req, res) => {
    const startTime = Date.now();
    try {
        const { currentData, missingField, contentType, conversationHistory } = req.body;
        if (!missingField || !contentType) {
            return res.status(400).json({
                success: false,
                error: 'Missing field and content type are required'
            });
        }
        // Add timeout handling
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI request timeout')), AI_REQUEST_TIMEOUT);
        });
        const questionPromise = recommendationAI_1.recommendationAI.generateFollowUpQuestion(currentData || {}, missingField, contentType, conversationHistory || []);
        const question = await Promise.race([questionPromise, timeoutPromise]);
        const duration = Date.now() - startTime;
        console.log(`AI question generation completed in ${duration}ms`);
        res.json({
            success: true,
            data: question
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Error generating follow-up question after ${duration}ms:`, error);
        if (error instanceof Error && error.message === 'AI request timeout') {
            res.status(408).json({
                success: false,
                error: 'AI question generation timed out. Please try again.'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to generate follow-up question'
            });
        }
    }
});
// Validate user response
router.post('/validate', rateLimiter_1.aiRateLimiter, async (req, res) => {
    const startTime = Date.now();
    try {
        const { question, userResponse, expectedField } = req.body;
        if (!question || !userResponse || !expectedField) {
            return res.status(400).json({
                success: false,
                error: 'Question, user response, and expected field are required'
            });
        }
        // Add timeout handling
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI request timeout')), AI_REQUEST_TIMEOUT);
        });
        const validationPromise = recommendationAI_1.recommendationAI.validateUserResponse(question, userResponse, expectedField);
        const validation = await Promise.race([validationPromise, timeoutPromise]);
        const duration = Date.now() - startTime;
        console.log(`AI validation completed in ${duration}ms`);
        res.json({
            success: true,
            data: validation
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Error validating user response after ${duration}ms:`, error);
        if (error instanceof Error && error.message === 'AI request timeout') {
            res.status(408).json({
                success: false,
                error: 'AI validation timed out. Please try again.'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to validate user response'
            });
        }
    }
});
// Format recommendation text using LLM
router.post('/format', rateLimiter_1.aiRateLimiter, async (req, res) => {
    const startTime = Date.now();
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
        // Add timeout handling
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('AI request timeout')), AI_REQUEST_TIMEOUT);
        });
        console.log('aiRecommendationRoutes - Calling recommendationAI.formatRecommendationPost');
        const formatPromise = recommendationAI_1.recommendationAI.formatRecommendationPost(data, originalText);
        const formattedText = await Promise.race([formatPromise, timeoutPromise]);
        console.log('aiRecommendationRoutes - formattedText result:', formattedText);
        const duration = Date.now() - startTime;
        console.log(`AI formatting completed in ${duration}ms`);
        res.json({
            success: true,
            formattedText
        });
    }
    catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Error formatting recommendation after ${duration}ms:`, error);
        if (error instanceof Error && error.message === 'AI request timeout') {
            res.status(408).json({
                success: false,
                error: 'AI formatting timed out. Please try again.'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to format recommendation'
            });
        }
    }
});
exports.default = router;
