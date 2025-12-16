/**
 * Generate a URL-friendly slug from a category name
 * Converts to lowercase, replaces spaces/special chars with hyphens,
 * removes duplicate hyphens, and ensures uniqueness
 */
export function generateSlug(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error('Category name cannot be empty');
  }

  // Convert to lowercase
  let slug = name.toLowerCase().trim();

  // Replace spaces and special characters with hyphens
  slug = slug.replace(/[^\w\s-]/g, ''); // Remove special chars except word chars, spaces, hyphens
  slug = slug.replace(/[\s_]+/g, '-'); // Replace spaces and underscores with hyphens
  slug = slug.replace(/-+/g, '-'); // Replace multiple hyphens with single hyphen
  slug = slug.replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Ensure slug is not empty
  if (slug.length === 0) {
    slug = 'category';
  }

  // Limit length to 100 characters (matching VARCHAR(100) constraint)
  if (slug.length > 100) {
    slug = slug.substring(0, 100);
    // Remove trailing hyphen if truncated
    slug = slug.replace(/-+$/, '');
  }

  return slug;
}

/**
 * Generate a unique slug by appending a number if the slug already exists
 * This function should be called with a database check
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await checkExists(slug)) {
    const suffix = `-${counter}`;
    const maxBaseLength = 100 - suffix.length;
    slug = baseSlug.substring(0, maxBaseLength) + suffix;
    counter++;
  }

  return slug;
}




