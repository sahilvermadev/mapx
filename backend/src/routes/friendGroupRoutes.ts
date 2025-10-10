import express from 'express';
import {
  createFriendGroup,
  getUserFriendGroups,
  getFriendGroupDetails,
  updateFriendGroup,
  deleteFriendGroup,
  addGroupMembers,
  removeGroupMember,
  type CreateGroupData,
  type UpdateGroupData
} from '../db/friendGroups';

const router = express.Router();

// Temporary authentication middleware (will be replaced with proper auth)
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const userId = req.query.currentUserId as string || req.body.currentUserId;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  (req as any).user = { id: userId };
  next();
};

/**
 * POST /api/friend-groups
 * Create a new friend group
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, icon, visibility, memberIds } = req.body;
    const userId = (req as any).user.id;

    if (!name || !Array.isArray(memberIds)) {
      return res.status(400).json({
        success: false,
        message: 'Name and memberIds are required'
      });
    }

    const groupData: CreateGroupData = {
      name,
      description,
      icon,
      visibility: visibility || 'private',
      memberIds
    };

    const group = await createFriendGroup(groupData, userId);

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Error creating friend group:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create group'
    });
  }
});

/**
 * GET /api/friend-groups
 * Get all friend groups for a user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const groups = await getUserFriendGroups(userId);

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Error getting friend groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get friend groups'
    });
  }
});

/**
 * GET /api/friend-groups/:id
 * Get friend group details with members
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = (req as any).user.id;

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const result = await getFriendGroupDetails(groupId, userId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting friend group details:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get group details'
    });
  }
});

/**
 * PUT /api/friend-groups/:id
 * Update a friend group
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = (req as any).user.id;
    const { name, description, icon, visibility } = req.body;

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const updateData: UpdateGroupData = {
      name,
      description,
      icon,
      visibility
    };

    const group = await updateFriendGroup(groupId, updateData, userId);

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Error updating friend group:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update group'
    });
  }
});

/**
 * DELETE /api/friend-groups/:id
 * Delete a friend group
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = (req as any).user.id;

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const success = await deleteFriendGroup(groupId, userId);

    if (success) {
      res.json({
        success: true,
        message: 'Group deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
  } catch (error) {
    console.error('Error deleting friend group:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete group'
    });
  }
});

/**
 * POST /api/friend-groups/:id/members
 * Add members to a group
 */
router.post('/:id/members', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = (req as any).user.id;
    const { memberIds } = req.body;

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    if (!Array.isArray(memberIds)) {
      return res.status(400).json({
        success: false,
        message: 'memberIds must be an array'
      });
    }

    await addGroupMembers(groupId, memberIds, userId);

    res.json({
      success: true,
      message: 'Members added successfully'
    });
  } catch (error) {
    console.error('Error adding group members:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to add members'
    });
  }
});

/**
 * DELETE /api/friend-groups/:id/members/:memberId
 * Remove member from group
 */
router.delete('/:id/members/:memberId', requireAuth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const memberId = req.params.memberId;
    const userId = (req as any).user.id;

    if (isNaN(groupId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const success = await removeGroupMember(groupId, memberId, userId);

    if (success) {
      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Member not found in group'
      });
    }
  } catch (error) {
    console.error('Error removing group member:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to remove member'
    });
  }
});

export default router;
