"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.generateAnnotationEmbedding = generateAnnotationEmbedding;
exports.generateSearchEmbedding = generateSearchEmbedding;
exports.generatePlaceEmbedding = generatePlaceEmbedding;
exports.generateBatchEmbeddings = generateBatchEmbeddings;
exports.calculateCosineSimilarity = calculateCosineSimilarity;
exports.validateEmbedding = validateEmbedding;
const openai_1 = __importDefault(require("openai"));
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
 * Generate embedding from a simple text string (for search queries)
 */
async function generateSearchEmbedding(searchText) {
    return generateEmbedding(searchText);
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
