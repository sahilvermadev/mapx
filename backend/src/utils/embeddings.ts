import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { AnnotationData } from '../db/annotations';

// Load .env file from the root directory (two levels up from backend/src)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embedding from text using OpenAI's text-embedding-ada-002 model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embedding from annotation data by combining relevant fields
 */
export async function generateAnnotationEmbedding(annotationData: AnnotationData & {
  place_name?: string;
  place_address?: string;
  user_name?: string;
}): Promise<number[]> {
  // Combine relevant fields into a meaningful text representation
  const textParts: string[] = [];

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
 * Generate embedding from a simple text string (for search queries)
 */
export async function generateSearchEmbedding(searchText: string): Promise<number[]> {
  return generateEmbedding(searchText);
}

/**
 * Generate embedding from place data for semantic search
 */
export async function generatePlaceEmbedding(placeData: {
  name: string;
  address?: string;
  metadata?: Record<string, any>;
}): Promise<number[]> {
  const textParts: string[] = [];

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
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
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

    return response.data.map((item: any) => item.embedding);
  } catch (error) {
    console.error('Error generating batch embeddings:', error);
    throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
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
export function validateEmbedding(embedding: number[]): boolean {
  return embedding.length === 1536 && embedding.every(val => typeof val === 'number' && !isNaN(val));
} 