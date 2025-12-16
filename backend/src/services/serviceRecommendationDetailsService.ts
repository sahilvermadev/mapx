import {
  createServiceRecommendationDetails,
  updateServiceRecommendationDetails,
  getServiceRecommendationDetailsByRecommendationId,
  calculateServiceAggregates,
} from '../db/serviceRecommendationDetails';
import { updateServiceAggregates, recalculateServiceAggregates } from '../db/services';
import { addServiceTags } from '../db/serviceTags';
import type { ServiceRecommendationDetailsInput } from '../db/serviceRecommendationDetails';

/**
 * Service for managing service recommendation details
 */
export class ServiceRecommendationDetailsService {
  /**
   * Create or update service recommendation details
   */
  async upsertRecommendationDetails(
    recommendationId: number,
    serviceId: number,
    data: Partial<ServiceRecommendationDetailsInput>
  ): Promise<void> {
    // Check if details already exist
    const existing = await getServiceRecommendationDetailsByRecommendationId(recommendationId);

    if (existing) {
      // Update existing details
      await updateServiceRecommendationDetails(recommendationId, {
        ...data,
        recommendation_id: recommendationId,
        service_id: serviceId,
      });
    } else {
      // Create new details
      // Ensure experience_summary is provided (required field)
      if (!data.experience_summary) {
        throw new Error('experience_summary is required for service recommendation details');
      }

      await createServiceRecommendationDetails({
        recommendation_id: recommendationId,
        service_id: serviceId,
        experience_summary: data.experience_summary,
        rating: data.rating,
        price_range: data.price_range,
        verbatim_quote: data.verbatim_quote,
        context_tags: data.context_tags || [],
      });
    }

    // Add tags if provided
    if (data.context_tags && data.context_tags.length > 0) {
      await addServiceTags(serviceId, data.context_tags, recommendationId);
    }

    // Recalculate and update service aggregates
    await this.updateServiceAggregates(serviceId);
  }

  /**
   * Update service aggregates after recommendation details change
   */
  async updateServiceAggregates(serviceId: number): Promise<void> {
    // Calculate aggregates from recommendation details
    const aggregates = await calculateServiceAggregates(serviceId);

    // Update cached aggregates on service
    await updateServiceAggregates(serviceId, aggregates);

    // Also update primary category if needed (handled separately by category service)
  }

  /**
   * Get recommendation details
   */
  async getRecommendationDetails(recommendationId: number) {
    return await getServiceRecommendationDetailsByRecommendationId(recommendationId);
  }

  /**
   * Extract experience summary from description if not provided
   */
  extractExperienceSummary(description: string, verbatimQuote?: string): string {
    // Use verbatim quote if available, otherwise use description
    if (verbatimQuote && verbatimQuote.trim().length > 0) {
      return verbatimQuote.trim();
    }
    
    // Use description as experience summary
    // In a production system, you might want to use LLM to extract a summary
    return description.trim() || 'No experience summary provided';
  }
}

// Export singleton instance
export const serviceRecommendationDetailsService = new ServiceRecommendationDetailsService();


