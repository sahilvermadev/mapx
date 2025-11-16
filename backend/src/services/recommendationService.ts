/**
 * Centralized recommendation service for handling all recommendation operations
 * This service optimizes the recommendation posting flow and provides a clean API
 */

import { insertRecommendation, type RecommendationData } from '../db/recommendations';
import { upsertPlace } from '../db/places';
import { getPlaceDetails, deriveAdmin, slugifyCity, normalizeFromPlaceDetails } from './placesClient';
import { upsertService } from '../services/serviceDeduplication';
import { embeddingQueue } from './embeddingQueue';
import { onRecommendationCreated } from '../db/questionCounters';
import { createQuestionAnswerNotification } from '../db/notifications';
import { handleError } from '../utils/errorHandling';

export interface SaveRecommendationRequest {
  content_type: 'place' | 'service' | 'tip' | 'contact' | 'unclear';
  place_name?: string;
  place_address?: string;
  place_lat?: number;
  place_lng?: number;
  google_place_id?: string;
  service_name?: string;
  service_type?: string;
  service_phone?: string;
  service_email?: string;
  service_address?: string;
  title?: string;
  description: string;
  content_data?: any;
  rating?: number;
  visibility?: 'friends' | 'public';
  labels?: string[];
  metadata?: any;
  question_id?: number;
}

export interface SaveRecommendationResponse {
  success: boolean;
  recommendation_id: number;
  place_id?: number;
  service_id?: number;
  message: string;
  service_deduplication?: any;
}

export interface RecommendationServiceOptions {
  enableEmbeddingGeneration?: boolean;
  enableMentionProcessing?: boolean;
  enableQuestionNotifications?: boolean;
  enableServiceDeduplication?: boolean;
}

/**
 * Main service class for recommendation operations
 */
export class RecommendationService {
  private defaultOptions: RecommendationServiceOptions = {
    enableEmbeddingGeneration: true,
    enableMentionProcessing: true,
    enableQuestionNotifications: true,
    enableServiceDeduplication: true,
  };

  /**
   * Save a recommendation with optimized flow
   */
  async saveRecommendation(
    request: SaveRecommendationRequest,
    userId: string,
    options: RecommendationServiceOptions = {}
  ): Promise<SaveRecommendationResponse> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // Step 1: Process place or service data
      const { placeId, serviceId, serviceDeduplication } = await this.processLocationData(request, userId, opts);
      
      // Step 2: Prepare recommendation data
      const recommendationData = this.prepareRecommendationData(request, userId, placeId, serviceId);
      
      // Step 3: Save recommendation to database
      const recommendationId = await this.insertRecommendationWithOptimizations(recommendationData, opts);
      
      // Step 4: Process async operations (mentions, notifications, embeddings)
      await this.processAsyncOperations(recommendationData, recommendationId, opts);
      
      return {
        success: true,
        recommendation_id: recommendationId,
        place_id: placeId,
        service_id: serviceId,
        message: 'Recommendation saved successfully',
        service_deduplication: serviceDeduplication,
      };
      
    } catch (error) {
      const appError = handleError(error, {
        context: 'RecommendationService.saveRecommendation',
        logError: true,
        includeStack: true,
      });
      throw appError;
    }
  }

  /**
   * Process location data (place or service) with optimizations
   */
  private async processLocationData(
    request: SaveRecommendationRequest,
    userId: string,
    options: RecommendationServiceOptions
  ): Promise<{ placeId?: number; serviceId?: number; serviceDeduplication?: any }> {
    console.log('[saveRecommendation] processLocationData: summary', {
      content_type: request.content_type,
      place_name: request.place_name,
      google_place_id: request.google_place_id,
      has_lat_lng: Boolean(request.place_lat && request.place_lng),
    });
    let placeId: number | undefined;
    let serviceId: number | undefined;
    let serviceDeduplication: any;

    if (request.content_type === 'place' && (request.place_name || request.google_place_id)) {
      // Enrich using Google Place Details when place_id is available
      let name = request.place_name;
      let address = request.place_address;
      let lat = request.place_lat;
      let lng = request.place_lng;
      let city_name: string | undefined;
      let city_slug: string | undefined;
      let admin1_name: string | undefined;
      let country_code: string | undefined;
      let primary_type: string | undefined;
      let types: string[] | undefined;
      let category_name: string | undefined;

      if (request.google_place_id) {
        console.log('[saveRecommendation] fetching Place Details for', request.google_place_id, {
          usingKey: Boolean(process.env.PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY)
        });
        try {
          const details = await getPlaceDetails(request.google_place_id);
          if (details) {
            console.log('[saveRecommendation] Place Details received keys', Object.keys(details || {}));
            const normalized = normalizeFromPlaceDetails(details, { name, address });
            if (normalized) {
              name = normalized.name || name;
              address = normalized.address || address;
              if (typeof normalized.lat === 'number' && typeof normalized.lng === 'number') {
                lat = normalized.lat;
                lng = normalized.lng;
              }
              city_name = normalized.city_name;
              city_slug = normalized.city_slug;
              admin1_name = normalized.admin1_name;
              country_code = normalized.country_code;
              primary_type = normalized.primary_type;
              types = normalized.types;
              category_name = normalized.category_name;
              console.log('[saveRecommendation] derived admin/type', { city_name, city_slug, admin1_name, country_code, primary_type, category_name });
            }
          }
        } catch (e) {
          // Non-fatal; fall back to client-provided fields
          console.warn('Place details fetch failed:', (e as Error).message);
        }
      }

      const toUpsert = {
        name: name || 'Unknown',
        address,
        lat,
        lng,
        google_place_id: request.google_place_id,
        category_name,
        city_name,
        city_slug,
        admin1_name,
        country_code,
        primary_type,
        types,
        metadata: request.metadata,
      } as const;
      console.log('[saveRecommendation] upsertPlace payload (sanitized)', { ...toUpsert, metadata: undefined });
      placeId = await upsertPlace({ ...toUpsert });
    } else if (request.content_type === 'service' && request.service_name) {
      // Process service data with deduplication
      if (options.enableServiceDeduplication) {
        const serviceResult = await upsertService({
          name: request.service_name,
          service_type: request.service_type,
          phone_number: request.service_phone,
          email: request.service_email,
          address: request.service_address,
        });
        serviceId = (serviceResult as any).serviceId;
        serviceDeduplication = serviceResult;
      } else {
        // Simple service creation without deduplication
        serviceId = await this.createSimpleService(request);
      }
    }

    return { placeId, serviceId, serviceDeduplication };
  }

  /**
   * Prepare recommendation data for database insertion
   */
  private prepareRecommendationData(
    request: SaveRecommendationRequest,
    userId: string,
    placeId?: number,
    serviceId?: number
  ): RecommendationData {
    const title = request.title || request.place_name || request.service_name;
    const finalContentType = this.determineContentType(request);

    return {
      user_id: userId,
      content_type: finalContentType,
      place_id: placeId,
      service_id: serviceId,
      title,
      description: request.description,
      content_data: request.content_data || {},
      rating: request.rating,
      visibility: request.visibility || 'friends',
      labels: request.labels || [],
      metadata: request.metadata || {},
      question_id: request.question_id,
      auto_generate_embedding: true,
    };
  }

  /**
   * Insert recommendation with optimizations
   */
  private async insertRecommendationWithOptimizations(
    data: RecommendationData,
    options: RecommendationServiceOptions
  ): Promise<number> {
    // Disable auto-embedding generation during insert for better performance
    const dataWithoutEmbedding = { ...data, auto_generate_embedding: false };
    
    const recommendationId = await insertRecommendation(dataWithoutEmbedding);
    
    // Queue embedding generation separately if enabled
    if (options.enableEmbeddingGeneration) {
      this.queueEmbeddingGeneration(recommendationId, data);
    }
    
    return recommendationId;
  }

  /**
   * Process async operations that don't need to block the response
   */
  private async processAsyncOperations(
    data: RecommendationData,
    recommendationId: number,
    options: RecommendationServiceOptions
  ): Promise<void> {
    const promises: Promise<any>[] = [];

    // Process mentions if enabled
    if (options.enableMentionProcessing && data.description) {
      promises.push(this.processMentions(recommendationId, data.description, data.user_id));
    }

    // Process question notifications if enabled
    if (options.enableQuestionNotifications && data.question_id) {
      promises.push(this.processQuestionNotifications(recommendationId, data.question_id, data.user_id));
    }

    // Execute all async operations in parallel
    if (promises.length > 0) {
      try {
        await Promise.allSettled(promises);
      } catch (error) {
        // Log but don't throw - these are non-critical operations
        console.warn('Some async operations failed:', error);
      }
    }
  }

  /**
   * Process mentions in recommendation description
   */
  private async processMentions(_recommendationId: number, _description: string, _userId: string): Promise<void> {
    // Mentions processing is currently disabled in this service layer; handled elsewhere if needed.
    return;
  }

  /**
   * Process question-related notifications
   */
  private async processQuestionNotifications(
    recommendationId: number,
    questionId: number,
    userId: string
  ): Promise<void> {
    try {
      await onRecommendationCreated(recommendationId, questionId);
      await createQuestionAnswerNotification(questionId, userId, recommendationId);
    } catch (error) {
      console.warn('Failed to process question notifications:', error);
    }
  }

  /**
   * Queue embedding generation for async processing
   */
  private queueEmbeddingGeneration(recommendationId: number, data: RecommendationData): void {
    try {
      embeddingQueue.enqueue('recommendation', recommendationId, data, 'normal');
    } catch (error) {
      console.warn('Failed to queue embedding generation:', error);
    }
  }

  /**
   * Create a simple service without deduplication
   */
  private async createSimpleService(request: SaveRecommendationRequest): Promise<number> {
    // This would be implemented if needed
    throw new Error('Simple service creation not implemented');
  }

  /**
   * Determine the final content type
   */
  private determineContentType(request: SaveRecommendationRequest): 'place' | 'service' | 'unclear' {
    // Filter out deprecated types (tip, contact) and only accept valid types
    if (request.content_type && ['place', 'service', 'unclear'].includes(request.content_type)) {
      return request.content_type as 'place' | 'service' | 'unclear';
    }
    
    // Auto-detect based on available data
    if (request.place_name || request.google_place_id) return 'place';
    if (request.service_name) return 'service';
    
    return 'unclear';
  }
}

// Export singleton instance
export const recommendationService = new RecommendationService();



