"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.generateAnnotationEmbedding = generateAnnotationEmbedding;
exports.generateSearchEmbedding = generateSearchEmbedding;
exports.generateRecommendationEmbedding = generateRecommendationEmbedding;
exports.generatePlaceEmbedding = generatePlaceEmbedding;
exports.generateBatchEmbeddings = generateBatchEmbeddings;
exports.calculateCosineSimilarity = calculateCosineSimilarity;
exports.validateEmbedding = validateEmbedding;
const openai_1 = __importDefault(require("openai"));
require("../config/env");
// NOTE: Avoid importing deprecated annotation types. Accept a flexible shape instead.
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Generate embedding from text using OpenAI's text-embedding-ada-002 model
 */
async function generateEmbedding(text) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text,
        });
        return response.data[0].embedding;
    }
    catch (error) {
        console.error('Error generating embedding:', error);
        throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Generate embedding from annotation data by combining relevant fields
 */
async function generateAnnotationEmbedding(annotationData) {
    // Combine relevant fields into a meaningful text representation
    const textParts = [];
    // Add place information (most important for location-based searches)
    if (annotationData.place_name) {
        textParts.push(`Place: ${annotationData.place_name}`);
    }
    if (annotationData.place_address) {
        textParts.push(`Address: ${annotationData.place_address}`);
    }
    // Add user information (for searching by reviewer)
    if (annotationData.user_name) {
        textParts.push(`Reviewer: ${annotationData.user_name}`);
    }
    // Add notes if present (most important for semantic meaning)
    if (annotationData.notes) {
        textParts.push(`Review: ${annotationData.notes}`);
    }
    // Add labels if present
    if (annotationData.labels && annotationData.labels.length > 0) {
        textParts.push(`Tags: ${annotationData.labels.join(', ')}`);
    }
    // Add companions if present
    if (annotationData.went_with && annotationData.went_with.length > 0) {
        textParts.push(`Went with: ${annotationData.went_with.join(', ')}`);
    }
    // Add rating if present
    if (annotationData.rating) {
        textParts.push(`Rating: ${annotationData.rating}/5 stars`);
    }
    // Add visit date if present
    if (annotationData.visit_date) {
        textParts.push(`Visited: ${annotationData.visit_date}`);
    }
    // Add relevant metadata if present
    if (annotationData.metadata) {
        const metadataText = Object.entries(annotationData.metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        if (metadataText) {
            textParts.push(`Details: ${metadataText}`);
        }
    }
    // Combine all parts
    const combinedText = textParts.join('. ');
    if (!combinedText.trim()) {
        throw new Error('No meaningful text content found in annotation data');
    }
    return generateEmbedding(combinedText);
}
/**
 * Generate embedding from a search query, structured to match recommendation embeddings
 */
async function generateSearchEmbedding(searchText) {
    // Structure the search query to match the recommendation embedding format
    // This helps the search query be more semantically similar to recommendation embeddings
    const structuredQuery = `Looking for: ${searchText}. Search query for recommendations.`;
    return generateEmbedding(structuredQuery);
}
/**
 * Generate embedding for recommendations, capturing rich context like title, description,
 * content type, labels, rating, place/service info, and arbitrary content_data/metadata.
 */
async function generateRecommendationEmbedding(recommendationData) {
    const textParts = [];
    if (recommendationData.content_type) {
        textParts.push(`Type: ${recommendationData.content_type}`);
    }
    if (recommendationData.title) {
        textParts.push(`Title: ${recommendationData.title}`);
    }
    if (recommendationData.description) {
        textParts.push(`Description: ${recommendationData.description}`);
    }
    if (recommendationData.labels && recommendationData.labels.length > 0) {
        textParts.push(`Tags: ${recommendationData.labels.join(', ')}`);
    }
    if (typeof recommendationData.rating === 'number') {
        textParts.push(`Rating: ${recommendationData.rating}/5`);
    }
    // Place context
    if (recommendationData.place_name) {
        textParts.push(`Place: ${recommendationData.place_name}`);
    }
    if (recommendationData.place_address) {
        textParts.push(`Address: ${recommendationData.place_address}`);
    }
    // Service context
    if (recommendationData.service_name) {
        textParts.push(`Service: ${recommendationData.service_name}`);
    }
    if (recommendationData.service_type) {
        textParts.push(`Service Type: ${recommendationData.service_type}`);
    }
    if (recommendationData.business_name) {
        textParts.push(`Business: ${recommendationData.business_name}`);
    }
    if (recommendationData.address) {
        textParts.push(`Service Address: ${recommendationData.address}`);
    }
    if (recommendationData.user_name) {
        textParts.push(`By: ${recommendationData.user_name}`);
    }
    // Extract price information from content_data in a consistent way
    const cd = recommendationData.content_data || {};
    const price_level = cd.price_level || cd.priceLevel;
    const price_label = cd.price_label;
    const price_text = cd.price_text;
    if (typeof price_level === 'number' || price_label || price_text) {
        const label = price_label || (price_level === 1 ? 'budget' : price_level === 2 ? 'moderate' : price_level === 3 ? 'higher-end' : price_level === 4 ? 'luxury' : undefined);
        const symbol = price_text || (price_level === 1 ? '₹' : price_level === 2 ? '₹₹' : price_level === 3 ? '₹₹₹' : price_level === 4 ? '₹₹₹₹' : undefined);
        const priceParts = [];
        if (symbol)
            priceParts.push(`Price ${symbol}`);
        if (label)
            priceParts.push(`Pricing ${label}`);
        if (priceParts.length > 0)
            textParts.push(priceParts.join(' '));
    }
    // Flatten JSON structures in a stable way
    const flattenRecord = (obj, label) => {
        if (!obj)
            return;
        const entries = Object.entries(obj)
            .filter(([_, v]) => v !== undefined && v !== null && `${v}`.trim().length > 0)
            .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
        if (entries.length > 0) {
            textParts.push(`${label || 'Data'}: ${entries.join(', ')}`);
        }
    };
    flattenRecord(recommendationData.content_data, 'Details');
    flattenRecord(recommendationData.metadata, 'Metadata');
    const combinedText = textParts.join('. ');
    if (!combinedText.trim()) {
        throw new Error('No meaningful text content found in recommendation data');
    }
    return generateEmbedding(combinedText);
}
/**
 * Generate embedding from place data for semantic search
 */
async function generatePlaceEmbedding(placeData) {
    const textParts = [];
    // Add place name
    textParts.push(`Place: ${placeData.name}`);
    // Add address if present
    if (placeData.address) {
        textParts.push(`Address: ${placeData.address}`);
    }
    // Add metadata if present
    if (placeData.metadata) {
        const metadataText = Object.entries(placeData.metadata)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        if (metadataText) {
            textParts.push(`Features: ${metadataText}`);
        }
    }
    const combinedText = textParts.join('. ');
    return generateEmbedding(combinedText);
}
/**
 * Batch generate embeddings for multiple texts
 */
async function generateBatchEmbeddings(texts) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }
        // Filter out empty texts
        const validTexts = texts.filter(text => text.trim().length > 0);
        if (validTexts.length === 0) {
            return [];
        }
        const response = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: validTexts,
        });
        return response.data.map((item) => item.embedding);
    }
    catch (error) {
        console.error('Error generating batch embeddings:', error);
        throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
/**
 * Calculate cosine similarity between two embeddings
 */
function calculateCosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
        throw new Error('Embeddings must have the same dimensions');
    }
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
        dotProduct += embedding1[i] * embedding2[i];
        norm1 += embedding1[i] * embedding1[i];
        norm2 += embedding2[i] * embedding2[i];
    }
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    if (norm1 === 0 || norm2 === 0) {
        return 0;
    }
    return dotProduct / (norm1 * norm2);
}
/**
 * Validate that an embedding has the correct dimensions (1536 for text-embedding-ada-002)
 */
function validateEmbedding(embedding) {
    return embedding.length === 1536 && embedding.every(val => typeof val === 'number' && !isNaN(val));
}
