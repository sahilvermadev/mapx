import {
  getAllCategories,
  getCategoryBySlug,
  linkServiceToCategory,
  getPrimaryCategoryForService,
  getCategoriesForService,
} from '../db/serviceCategories';
import { extractServiceType } from '../utils/nameSimilarity';

/**
 * Service for managing service categories
 */
export class ServiceCategoryService {
  /**
   * Auto-detect category from service type or name
   */
  async autoDetectCategory(serviceType?: string, serviceName?: string, businessName?: string): Promise<number | undefined> {
    // First try to match by service_type
    if (serviceType) {
      const category = await getCategoryBySlug(serviceType);
      if (category) {
        return category.id;
      }
    }

    // Try to extract service type from name/business name
    const extractedType = extractServiceType(serviceName || '', businessName || '');
    if (extractedType) {
      const category = await getCategoryBySlug(extractedType);
      if (category) {
        return category.id;
      }
    }

    return undefined;
  }

  /**
   * Link service to category with auto-detection fallback
   */
  async linkServiceToCategoryAuto(
    serviceId: number,
    categoryId?: number,
    serviceType?: string,
    serviceName?: string,
    businessName?: string,
    addedByUser: boolean = false,
    confidence: number = 1.0
  ): Promise<number | undefined> {
    let finalCategoryId: number | undefined = categoryId;

    // Auto-detect if no category provided
    if (!finalCategoryId) {
      const detectedId: number | undefined = await this.autoDetectCategory(serviceType, serviceName, businessName);
      finalCategoryId = detectedId;
      if (finalCategoryId) {
        // Lower confidence for auto-detected categories
        confidence = Math.min(confidence, 0.8);
        addedByUser = false;
      }
    }

    if (!finalCategoryId) {
      return undefined;
    }

    await linkServiceToCategory(serviceId, finalCategoryId, addedByUser, confidence);
    return finalCategoryId;
  }

  /**
   * Get all available categories
   */
  async getAllCategories() {
    return await getAllCategories();
  }

  /**
   * Get categories for a service
   */
  async getServiceCategories(serviceId: number) {
    return await getCategoriesForService(serviceId);
  }

  /**
   * Get primary category for a service
   */
  async getPrimaryCategory(serviceId: number) {
    return await getPrimaryCategoryForService(serviceId);
  }
}

// Export singleton instance
export const serviceCategoryService = new ServiceCategoryService();








