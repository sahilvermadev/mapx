import pool from '../db';
import { generateSlug, generateUniqueSlug } from '../utils/slug';
import { invalidateCategoryEmbeddingsCache } from '../services/categoryLookupService';

export interface ServiceCategory {
  id: number;
  slug: string;
  name: string;
  is_user_created?: boolean;
  created_by_user_id?: string | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceToCategory {
  service_id: number;
  category_id: number;
  added_by_user: boolean;
  confidence: number;
  created_at: Date;
}

export interface CategoryContextTag {
  id: number;
  category_id: number;
  tag: string;
  description?: string;
  sort_order: number;
  created_at: Date;
}

/**
 * Get all service categories
 */
export async function getAllCategories(): Promise<ServiceCategory[]> {
  const result = await pool.query(
    'SELECT * FROM service_categories ORDER BY sort_order ASC, name ASC'
  );
  return result.rows;
}

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: number): Promise<ServiceCategory | null> {
  const result = await pool.query(
    'SELECT * FROM service_categories WHERE id = $1',
    [categoryId]
  );
  return result.rows[0] || null;
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string): Promise<ServiceCategory | null> {
  const result = await pool.query(
    'SELECT * FROM service_categories WHERE slug = $1',
    [slug]
  );
  return result.rows[0] || null;
}

/**
 * Get categories for a service
 */
export async function getCategoriesForService(serviceId: number): Promise<ServiceCategory[]> {
  const result = await pool.query(
    `SELECT sc.*, stc.added_by_user, stc.confidence
     FROM service_categories sc
     INNER JOIN service_to_category stc ON sc.id = stc.category_id
     WHERE stc.service_id = $1
     ORDER BY stc.confidence DESC, sc.sort_order ASC`,
    [serviceId]
  );
  return result.rows;
}

/**
 * Link a service to a category
 */
export async function linkServiceToCategory(
  serviceId: number,
  categoryId: number,
  addedByUser: boolean = false,
  confidence: number = 1.0
): Promise<void> {
  await pool.query(
    `INSERT INTO service_to_category (service_id, category_id, added_by_user, confidence)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (service_id, category_id) 
     DO UPDATE SET 
       added_by_user = EXCLUDED.added_by_user,
       confidence = EXCLUDED.confidence`,
    [serviceId, categoryId, addedByUser, confidence]
  );
}

/**
 * Unlink a service from a category
 */
export async function unlinkServiceFromCategory(
  serviceId: number,
  categoryId: number
): Promise<void> {
  await pool.query(
    'DELETE FROM service_to_category WHERE service_id = $1 AND category_id = $2',
    [serviceId, categoryId]
  );
}

/**
 * Get primary category for a service (highest confidence)
 */
export async function getPrimaryCategoryForService(serviceId: number): Promise<ServiceCategory | null> {
  const result = await pool.query(
    `SELECT sc.*
     FROM service_categories sc
     INNER JOIN service_to_category stc ON sc.id = stc.category_id
     WHERE stc.service_id = $1
     ORDER BY stc.confidence DESC, stc.added_by_user DESC, sc.sort_order ASC
     LIMIT 1`,
    [serviceId]
  );
  return result.rows[0] || null;
}

/**
 * Get context tags for a category
 */
export async function getContextTagsForCategory(categoryId: number): Promise<CategoryContextTag[]> {
  const result = await pool.query(
    `SELECT * FROM category_context_tags
     WHERE category_id = $1
     ORDER BY sort_order ASC, tag ASC`,
    [categoryId]
  );
  return result.rows;
}

/**
 * Add context tag to a category
 */
export async function addContextTagToCategory(
  categoryId: number,
  tag: string,
  description?: string,
  sortOrder: number = 0
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO category_context_tags (category_id, tag, description, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [categoryId, tag, description || null, sortOrder]
  );
  return result.rows[0].id;
}

/**
 * Remove context tag from a category
 */
export async function removeContextTagFromCategory(
  categoryId: number,
  tagId: number
): Promise<void> {
  await pool.query(
    'DELETE FROM category_context_tags WHERE id = $1 AND category_id = $2',
    [tagId, categoryId]
  );
}

/**
 * Get all services for a category
 */
export async function getServicesForCategory(
  categoryId: number,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{ service_id: number; confidence: number }>> {
  const result = await pool.query(
    `SELECT service_id, confidence
     FROM service_to_category
     WHERE category_id = $1
     ORDER BY confidence DESC, created_at DESC
     LIMIT $2 OFFSET $3`,
    [categoryId, limit, offset]
  );
  return result.rows;
}

/**
 * Check if a slug already exists
 */
async function slugExists(slug: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM service_categories WHERE slug = $1 LIMIT 1',
    [slug]
  );
  return result.rows.length > 0;
}

/**
 * Create a new user-created category
 * Uses a transaction with row-level locking to prevent race conditions in ID generation
 */
export async function createCategory(
  name: string,
  createdByUserId?: string
): Promise<ServiceCategory> {
  // Validate name
  if (!name || name.trim().length === 0) {
    throw new Error('Category name cannot be empty');
  }

  const trimmedName = name.trim();

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if a category with this name already exists (within transaction)
    const existingByName = await client.query(
      'SELECT * FROM service_categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [trimmedName]
    );

    if (existingByName.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new Error(`A category with the name "${trimmedName}" already exists`);
    }

    // Generate slug from name
    const baseSlug = generateSlug(trimmedName);
    const slug = await generateUniqueSlug(baseSlug, slugExists);

    // Get next available ID with row-level locking to prevent race conditions
    // SELECT FOR UPDATE locks the rows, ensuring only one transaction can get the next ID
    const idResult = await client.query(
      `SELECT COALESCE(MAX(id), 999) + 1 as next_id 
       FROM service_categories 
       WHERE id >= 1000
       FOR UPDATE`
    );
    const id = Math.max(parseInt(idResult.rows[0].next_id, 10), 1000);

    // Get next sort order (also within transaction for consistency)
    const sortOrderResult = await client.query(
      `SELECT COALESCE(MAX(sort_order), 999) + 10 as next_sort_order 
       FROM service_categories 
       WHERE is_user_created = true
       FOR UPDATE`
    );
    const sortOrder = parseInt(sortOrderResult.rows[0].next_sort_order, 10);

    // Insert the new category
    const result = await client.query(
      `INSERT INTO service_categories (id, slug, name, is_user_created, created_by_user_id, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, slug, trimmedName, true, createdByUserId || null, sortOrder]
    );

    await client.query('COMMIT');

    // Invalidate category embeddings cache since we added a new category
    invalidateCategoryEmbeddingsCache();

    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update a category (admin only for system categories, users can update their own)
 */
export async function updateCategory(
  categoryId: number,
  updates: {
    name?: string;
    sort_order?: number;
  }
): Promise<ServiceCategory> {
  const updateFields: string[] = [];
  const updateValues: any[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    updateFields.push(`name = $${paramIndex++}`);
    updateValues.push(updates.name.trim());
  }

  if (updates.sort_order !== undefined) {
    updateFields.push(`sort_order = $${paramIndex++}`);
    updateValues.push(updates.sort_order);
  }

  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }

  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  updateValues.push(categoryId);

  const result = await pool.query(
    `UPDATE service_categories 
     SET ${updateFields.join(', ')}
     WHERE id = $${paramIndex}
     RETURNING *`,
    updateValues
  );

  if (result.rows.length === 0) {
    throw new Error('Category not found');
  }

  // Invalidate category embeddings cache since we updated a category
  invalidateCategoryEmbeddingsCache();

  return result.rows[0];
}

/**
 * Delete a category (with safety checks)
 */
export async function deleteCategory(categoryId: number): Promise<void> {
  // Check if category is in use
  const usageCheck = await pool.query(
    `SELECT COUNT(*) as count FROM service_to_category WHERE category_id = $1`,
    [categoryId]
  );

  const usageCount = parseInt(usageCheck.rows[0].count, 10);
  if (usageCount > 0) {
    throw new Error(`Cannot delete category: it is currently used by ${usageCount} service(s)`);
  }

  // Check if category is referenced in recommendations
  const recCheck = await pool.query(
    `SELECT COUNT(*) as count FROM recommendations WHERE service_category_id = $1`,
    [categoryId]
  );

  const recCount = parseInt(recCheck.rows[0].count, 10);
  if (recCount > 0) {
    throw new Error(`Cannot delete category: it is referenced by ${recCount} recommendation(s)`);
  }

  // Delete the category
  const result = await pool.query(
    'DELETE FROM service_categories WHERE id = $1 RETURNING id',
    [categoryId]
  );

  if (result.rows.length === 0) {
    throw new Error('Category not found');
  }

  // Invalidate category embeddings cache since we deleted a category
  invalidateCategoryEmbeddingsCache();
}

/**
 * Promote a user-created category to a system category
 */
export async function promoteUserCategory(categoryId: number): Promise<ServiceCategory> {
  const result = await pool.query(
    `UPDATE service_categories 
     SET is_user_created = false, created_by_user_id = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND is_user_created = true
     RETURNING *`,
    [categoryId]
  );

  if (result.rows.length === 0) {
    throw new Error('Category not found or is already a system category');
  }

  // Invalidate category embeddings cache since we promoted a category
  invalidateCategoryEmbeddingsCache();

  return result.rows[0];
}

/**
 * Get all user-created categories (for admin review)
 */
export async function getUserCreatedCategories(): Promise<ServiceCategory[]> {
  const result = await pool.query(
    `SELECT sc.*, u.email as creator_email, u.display_name as creator_name
     FROM service_categories sc
     LEFT JOIN users u ON sc.created_by_user_id = u.id
     WHERE sc.is_user_created = true
     ORDER BY sc.created_at DESC`
  );
  return result.rows;
}

