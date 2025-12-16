# Service Categories Test Plan

This document outlines the test cases that should be implemented for the dynamic category management system.

## Prerequisites

A test framework needs to be set up (Jest, Vitest, or Mocha) with:
- Database connection mocking or test database
- Express request/response mocking
- Redis mocking for rate limiter tests

## Test Cases

### 1. Category Creation (`createCategory`)

**Test Cases:**
- ✅ Creates category with valid name and user ID
- ✅ Sets `is_user_created = true` and `created_by_user_id` correctly
- ✅ Generates unique slug from name
- ✅ Assigns ID >= 1000 for user-created categories
- ✅ Throws error if category name already exists (case-insensitive)
- ✅ Throws error if name is empty or whitespace-only
- ✅ Race condition: Two concurrent requests get different IDs (use SELECT FOR UPDATE)
- ✅ Transaction rollback on error

### 2. Category Update (`updateCategory`)

**Test Cases:**
- ✅ Updates category name successfully
- ✅ Updates sort_order successfully
- ✅ Updates both name and sort_order
- ✅ Throws error if category not found
- ✅ Throws error if no fields to update
- ✅ Invalidates cache after update

### 3. Category Deletion (`deleteCategory`)

**Test Cases:**
- ✅ Deletes category successfully
- ✅ Throws error if category is in use by services (`service_to_category`)
- ✅ Throws error if category is referenced in recommendations
- ✅ Throws error if category not found
- ✅ Invalidates cache after deletion

### 4. Category Promotion (`promoteUserCategory`)

**Test Cases:**
- ✅ Promotes user category to system category
- ✅ Sets `is_user_created = false` and `created_by_user_id = NULL`
- ✅ Throws error if category not found
- ✅ Throws error if category is already a system category
- ✅ Invalidates cache after promotion

### 5. Authorization Checks (Route Level)

**Test Cases:**
- ✅ User can create their own category
- ✅ User can update their own user-created category
- ✅ User can delete their own user-created category
- ✅ User CANNOT update system categories
- ✅ User CANNOT delete system categories
- ✅ User CANNOT update other users' categories
- ✅ Admin can update any category
- ✅ Admin can delete any category
- ✅ Admin can promote user categories
- ✅ Unauthenticated user cannot create/update/delete categories

### 6. Rate Limiting

**Test Cases:**
- ✅ Allows 5 category creations per hour per user
- ✅ Blocks 6th creation within same hour
- ✅ Resets limit after 1 hour
- ✅ Rate limit is per-user (not per-IP when authenticated)
- ✅ Rate limit falls back to IP when user not authenticated

### 7. Sync Script (`sync-categories.js`)

**Test Cases:**
- ✅ Updates existing system categories with new data
- ✅ Inserts new system categories
- ✅ Skips user-created categories (preserves them)
- ✅ Skips categories with no changes
- ✅ Handles ID conflicts with user-created categories (>= 1000)
- ✅ Transaction rollback on fatal error
- ✅ Continues processing other categories if one fails
- ✅ Combines queries efficiently (single SELECT instead of two)

### 8. Database Functions

**Test Cases:**
- ✅ `getUserCreatedCategories()` returns only user-created categories
- ✅ `getUserCreatedCategories()` includes creator email and name
- ✅ `getUserCreatedCategories()` handles NULL `created_by_user_id` gracefully
- ✅ Index on `created_by_user_id` improves query performance

## Integration Tests

1. **Full Category Lifecycle:**
   - User creates category → Admin reviews → Admin promotes → Sync script preserves it

2. **Concurrent Category Creation:**
   - Multiple users create categories simultaneously → No ID conflicts

3. **Sync Script with User Categories:**
   - Database has user-created categories → Run sync → User categories preserved → System categories updated

## Performance Tests

1. **Category Creation Under Load:**
   - 100 concurrent category creation requests → All succeed with unique IDs

2. **Sync Script Performance:**
   - Sync 163 categories → Completes in reasonable time (< 5 seconds)

3. **Query Performance:**
   - `getUserCreatedCategories()` with index → Fast query (< 100ms)

## Edge Cases

1. User account deleted but created categories exist → `created_by_user_id` set to NULL
2. Category name with special characters → Slug generation handles correctly
3. Very long category names (> 255 chars) → Validation rejects
4. Empty category list in sync script → Handles gracefully
5. Database connection failure during sync → Transaction rollback

