"use strict";
/**
 * Centralized recommendation service for handling all recommendation operations
 * This service optimizes the recommendation posting flow and provides a clean API
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendationService = exports.RecommendationService = void 0;
const recommendations_1 = require("../db/recommendations");
const places_1 = require("../db/places");
const placesClient_1 = require("./placesClient");
const serviceDeduplication_1 = require("../services/serviceDeduplication");
const embeddingQueue_1 = require("./embeddingQueue");
const questionCounters_1 = require("../db/questionCounters");
const notifications_1 = require("../db/notifications");
const errorHandling_1 = require("../utils/errorHandling");
/**
 * Main service class for recommendation operations
 */
class RecommendationService {
    defaultOptions = {
        enableEmbeddingGeneration: true,
        enableMentionProcessing: true,
        enableQuestionNotifications: true,
        enableServiceDeduplication: true,
    };
    /**
     * Save a recommendation with optimized flow
     */
    async saveRecommendation(request, userId, options = {}) {
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
        }
        catch (error) {
            const appError = (0, errorHandling_1.handleError)(error, {
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
    async processLocationData(request, userId, options) {
        console.log('[saveRecommendation] processLocationData: summary', {
            content_type: request.content_type,
            place_name: request.place_name,
            google_place_id: request.google_place_id,
            has_lat_lng: Boolean(request.place_lat && request.place_lng),
        });
        let placeId;
        let serviceId;
        let serviceDeduplication;
        if (request.content_type === 'place' && (request.place_name || request.google_place_id)) {
            // Enrich using Google Place Details when place_id is available
            let name = request.place_name;
            let address = request.place_address;
            let lat = request.place_lat;
            let lng = request.place_lng;
            let city_name;
            let city_slug;
            let admin1_name;
            let country_code;
            let primary_type;
            let types;
            let category_name;
            if (request.google_place_id) {
                try {
                    const enriched = await (0, placesClient_1.enrichPlaceFromGoogle)(request.google_place_id, {
                        name,
                        address,
                        lat,
                        lng,
                    });
                    if (enriched) {
                        name = enriched.name || name;
                        address = enriched.address || address;
                        lat = enriched.lat || lat;
                        lng = enriched.lng || lng;
                        city_name = enriched.city_name;
                        city_slug = enriched.city_slug;
                        admin1_name = enriched.admin1_name;
                        country_code = enriched.country_code;
                        primary_type = enriched.primary_type;
                        types = enriched.types;
                        category_name = primary_type;
                    }
                }
                catch (e) {
                    console.warn('Place details fetch failed:', e.message);
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
            };
            console.log('[saveRecommendation] upsertPlace payload (sanitized)', { ...toUpsert, metadata: undefined });
            placeId = await (0, places_1.upsertPlace)({ ...toUpsert });
        }
        else if (request.content_type === 'service' && request.service_name) {
            // Process service data with deduplication
            if (options.enableServiceDeduplication) {
                const serviceResult = await (0, serviceDeduplication_1.upsertService)({
                    name: request.service_name,
                    service_type: request.service_type,
                    phone_number: request.service_phone,
                    email: request.service_email,
                    address: request.service_address,
                });
                serviceId = serviceResult.serviceId;
                serviceDeduplication = serviceResult;
            }
            else {
                // Simple service creation without deduplication
                serviceId = await this.createSimpleService(request);
            }
        }
        return { placeId, serviceId, serviceDeduplication };
    }
    /**
     * Prepare recommendation data for database insertion
     */
    prepareRecommendationData(request, userId, placeId, serviceId) {
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
    async insertRecommendationWithOptimizations(data, options) {
        // Disable auto-embedding generation during insert for better performance
        const dataWithoutEmbedding = { ...data, auto_generate_embedding: false };
        const recommendationId = await (0, recommendations_1.insertRecommendation)(dataWithoutEmbedding);
        // Queue embedding generation separately if enabled
        if (options.enableEmbeddingGeneration) {
            this.queueEmbeddingGeneration(recommendationId, data);
        }
        return recommendationId;
    }
    /**
     * Process async operations that don't need to block the response
     */
    async processAsyncOperations(data, recommendationId, options) {
        const promises = [];
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
            }
            catch (error) {
                // Log but don't throw - these are non-critical operations
                console.warn('Some async operations failed:', error);
            }
        }
    }
    /**
     * Process mentions in recommendation description
     */
    async processMentions(_recommendationId, _description, _userId) {
        // Mentions processing is currently disabled in this service layer; handled elsewhere if needed.
        return;
    }
    /**
     * Process question-related notifications
     */
    async processQuestionNotifications(recommendationId, questionId, userId) {
        try {
            await (0, questionCounters_1.onRecommendationCreated)(recommendationId, questionId);
            await (0, notifications_1.createQuestionAnswerNotification)(questionId, userId, recommendationId);
        }
        catch (error) {
            console.warn('Failed to process question notifications:', error);
        }
    }
    /**
     * Queue embedding generation for async processing
     */
    queueEmbeddingGeneration(recommendationId, data) {
        try {
            embeddingQueue_1.embeddingQueue.enqueue('recommendation', recommendationId, data, 'normal');
        }
        catch (error) {
            console.warn('Failed to queue embedding generation:', error);
        }
    }
    /**
     * Create a simple service without deduplication
     */
    async createSimpleService(request) {
        // This would be implemented if needed
        throw new Error('Simple service creation not implemented');
    }
    /**
     * Determine the final content type
     */
    determineContentType(request) {
        if (request.content_type && ['place', 'service', 'tip', 'contact', 'unclear'].includes(request.content_type)) {
            return request.content_type;
        }
        // Auto-detect based on available data
        if (request.place_name || request.google_place_id)
            return 'place';
        if (request.service_name)
            return 'service';
        return 'unclear';
    }
}
exports.RecommendationService = RecommendationService;
// Export singleton instance
exports.recommendationService = new RecommendationService();
