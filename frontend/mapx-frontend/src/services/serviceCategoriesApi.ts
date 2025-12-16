import { apiClient } from './apiClient';

export interface ServiceCategory {
  id: number;
  slug: string;
  name: string;
  is_user_created?: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryContextTag {
  id: number;
  category_id: number;
  tag: string;
  description?: string;
  sort_order: number;
  created_at: string;
}

export const serviceCategoriesApi = {
  /**
   * Get all service categories
   */
  async getAllCategories(): Promise<ServiceCategory[]> {
    const response = await apiClient.get<ServiceCategory[]>('/service-categories');
    
    if (!response.success) {
      const errorMessage = response.error || response.message || 'Failed to fetch service categories';
      throw new Error(errorMessage);
    }
    
    return response.data || [];
  },

  /**
   * Get context tags for a category
   */
  async getContextTags(categoryId: number): Promise<CategoryContextTag[]> {
    const response = await apiClient.get<CategoryContextTag[]>(`/service-categories/${categoryId}/context-tags`);
    
    if (!response.success) {
      const errorMessage = response.error || response.message || 'Failed to fetch context tags';
      throw new Error(errorMessage);
    }
    
    return response.data || [];
  },

  /**
   * Get categories for a service
   */
  async getServiceCategories(serviceId: number): Promise<ServiceCategory[]> {
    const response = await apiClient.get<ServiceCategory[]>(`/service-categories/service/${serviceId}`);
    
    if (!response.success) {
      const errorMessage = response.error || response.message || 'Failed to fetch service categories';
      throw new Error(errorMessage);
    }
    
    return response.data || [];
  },

  /**
   * Create a new user-created category
   */
  async createCategory(name: string): Promise<ServiceCategory> {
    const response = await apiClient.post<{ success: boolean; data: ServiceCategory }>('/service-categories', {
      name,
    });
    const responseData = response.data;
    if (!responseData?.success || !responseData?.data) {
      throw new Error('Failed to create category');
    }
    return responseData.data;
  },
};





