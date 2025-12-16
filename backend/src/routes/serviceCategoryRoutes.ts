import express from 'express';
import { serviceCategoryService } from '../services/serviceCategoryService';
import { 
  getContextTagsForCategory, 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  promoteUserCategory, 
  getUserCreatedCategories,
  getCategoryById
} from '../db/serviceCategories';
import { getUserIdFromRequest, authenticateJWT, requireAdmin, isAdmin } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Rate limiter for category creation: 5 categories per hour per user
const categoryCreationRateLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour window
  5, // 5 requests per hour
  (req) => {
    const userId = getUserIdFromRequest(req);
    return userId ? `category:user:${userId}` : `category:ip:${req.ip || 'unknown'}`;
  }
);

/**
 * GET /api/service-categories
 * Get all service categories
 */
router.get('/', async (req, res) => {
  try {
    const categories = await serviceCategoryService.getAllCategories();
    
    res.json({
      success: true,
      data: categories,
      message: 'Service categories retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/service-categories/:categoryId/context-tags
 * Get context tags for a specific category
 */
router.get('/:categoryId/context-tags', async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const contextTags = await getContextTagsForCategory(categoryId);
    
    res.json({
      success: true,
      data: contextTags,
      message: 'Context tags retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching context tags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch context tags',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/service-categories/service/:serviceId
 * Get categories for a specific service
 */
router.get('/service/:serviceId', async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);
    
    if (isNaN(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid service ID is required'
      });
    }

    const categories = await serviceCategoryService.getServiceCategories(serviceId);
    
    res.json({
      success: true,
      data: categories,
      message: 'Service categories retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching service categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/service-categories
 * Create a new user-created category
 * Rate limited: 5 categories per hour per user
 */
router.post('/', categoryCreationRateLimiter, async (req, res) => {
  try {
    const { name } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required and must be a non-empty string'
      });
    }

    // Validate name length
    if (name.trim().length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Category name must be 255 characters or less'
      });
    }

    // Get user ID from request (convert null to undefined for createCategory)
    const userId = getUserIdFromRequest(req);
    
    // Create the category
    const category = await createCategory(name.trim(), userId ?? undefined);
    
    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Error creating category:', error);
    
    // Handle duplicate name error
    if (error instanceof Error && error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create category',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/service-categories/user-created
 * Get all user-created categories (admin only)
 */
router.get('/user-created', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const categories = await getUserCreatedCategories();
    
    res.json({
      success: true,
      data: categories,
      message: 'User-created categories retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching user-created categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user-created categories',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/service-categories/:categoryId
 * Update a category (admin can update any, users can update their own)
 */
router.put('/:categoryId', authenticateJWT, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const { name, sort_order } = req.body;
    const userId = getUserIdFromRequest(req);
    const userEmail = (req.user as any)?.email;
    const userIsAdmin = userEmail ? isAdmin(userEmail) : false;

    // Get the category to check ownership
    const category = await getCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Authorization check: users can only update their own categories, admins can update any
    if (!userIsAdmin) {
      if (!category.is_user_created || category.created_by_user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only update categories you created'
        });
      }
    }

    // For system categories, only admins can update
    if (!category.is_user_created && !userIsAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update system categories'
      });
    }

    // Validate updates
    const updates: { name?: string; sort_order?: number } = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Category name must be a non-empty string'
        });
      }
      if (name.trim().length > 255) {
        return res.status(400).json({
          success: false,
          message: 'Category name must be 255 characters or less'
        });
      }
      updates.name = name.trim();
    }

    if (sort_order !== undefined) {
      if (typeof sort_order !== 'number' || sort_order < 0) {
        return res.status(400).json({
          success: false,
          message: 'Sort order must be a non-negative number'
        });
      }
      updates.sort_order = sort_order;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    const updatedCategory = await updateCategory(categoryId, updates);
    
    res.json({
      success: true,
      data: updatedCategory,
      message: 'Category updated successfully'
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/service-categories/:categoryId
 * Delete a category (admin can delete any, users can delete their own)
 */
router.delete('/:categoryId', authenticateJWT, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const userId = getUserIdFromRequest(req);
    const userEmail = (req.user as any)?.email;
    const userIsAdmin = userEmail ? isAdmin(userEmail) : false;

    // Get the category to check ownership
    const category = await getCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Authorization check: users can only delete their own categories, admins can delete any
    if (!userIsAdmin) {
      if (!category.is_user_created || category.created_by_user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete categories you created'
        });
      }
    }

    // For system categories, only admins can delete
    if (!category.is_user_created && !userIsAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete system categories'
      });
    }

    await deleteCategory(categoryId);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    
    // Handle specific errors
    if (error instanceof Error && error.message.includes('Cannot delete category')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete category',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/service-categories/:categoryId/promote
 * Promote a user-created category to a system category (admin only)
 */
router.post('/:categoryId/promote', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId);
    
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    const promotedCategory = await promoteUserCategory(categoryId);
    
    res.json({
      success: true,
      data: promotedCategory,
      message: 'Category promoted to system category successfully'
    });
  } catch (error) {
    console.error('Error promoting category:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to promote category',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;





