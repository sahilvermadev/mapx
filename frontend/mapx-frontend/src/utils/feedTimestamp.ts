/**
 * Utility functions for tracking last viewed feed timestamp
 */

const LAST_VIEWED_FEED_KEY = 'lastViewedFeedTimestamp';

/**
 * Get the last viewed feed timestamp from localStorage
 * @returns ISO timestamp string or null if not set
 */
export function getLastViewedFeedTimestamp(): string | null {
  try {
    return localStorage.getItem(LAST_VIEWED_FEED_KEY);
  } catch (error) {
    console.error('Error reading last viewed feed timestamp:', error);
    return null;
  }
}

/**
 * Set the last viewed feed timestamp in localStorage
 * @param timestamp ISO timestamp string (defaults to current time)
 */
export function setLastViewedFeedTimestamp(timestamp?: string): void {
  try {
    const value = timestamp || new Date().toISOString();
    localStorage.setItem(LAST_VIEWED_FEED_KEY, value);
  } catch (error) {
    console.error('Error saving last viewed feed timestamp:', error);
  }
}

/**
 * Clear the last viewed feed timestamp
 */
export function clearLastViewedFeedTimestamp(): void {
  try {
    localStorage.removeItem(LAST_VIEWED_FEED_KEY);
  } catch (error) {
    console.error('Error clearing last viewed feed timestamp:', error);
  }
}

/**
 * Count posts that are newer than the last viewed timestamp
 * @param posts Array of posts with created_at timestamps
 * @param lastViewedTimestamp ISO timestamp string to compare against
 * @returns Number of new posts
 */
export function countNewPosts(
  posts: Array<{ created_at: string }>,
  lastViewedTimestamp: string | null
): number {
  if (!lastViewedTimestamp) {
    // If no last viewed timestamp, consider all posts as "new" (first visit)
    // But we'll return 0 to avoid overwhelming first-time users
    return 0;
  }

  const lastViewed = new Date(lastViewedTimestamp);
  return posts.filter(post => {
    if (!post.created_at) return false;
    const postDate = new Date(post.created_at);
    return postDate > lastViewed;
  }).length;
}

/**
 * Get the first new post index (the first post created after lastViewedTimestamp)
 * @param posts Array of posts with created_at timestamps
 * @param lastViewedTimestamp ISO timestamp string to compare against
 * @returns Index of first new post, or -1 if none
 */
export function getFirstNewPostIndex(
  posts: Array<{ created_at: string }>,
  lastViewedTimestamp: string | null
): number {
  if (!lastViewedTimestamp) return -1;

  const lastViewed = new Date(lastViewedTimestamp);
  return posts.findIndex(post => {
    if (!post.created_at) return false;
    const postDate = new Date(post.created_at);
    return postDate > lastViewed;
  });
}

