"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const friendGroups_1 = require("../db/friendGroups");
const router = express_1.default.Router();
// Note: Authentication is now handled by the JWT middleware in index.ts
/**
 * POST /api/friend-groups
 * Create a new friend group
 */
router.post('/', async (req, res) => {
    try {
        const { name, description, icon, visibility, memberIds } = req.body;
        const userId = req.user.id;
        if (!name || !Array.isArray(memberIds)) {
            return res.status(400).json({
                success: false,
                message: 'Name and memberIds are required'
            });
        }
        const groupData = {
            name,
            description,
            icon,
            visibility: visibility || 'private',
            memberIds
        };
        const group = await (0, friendGroups_1.createFriendGroup)(groupData, userId);
        res.json({
            success: true,
            data: group
        });
    }
    catch (error) {
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
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const groups = await (0, friendGroups_1.getUserFriendGroups)(userId);
        res.json({
            success: true,
            data: groups
        });
    }
    catch (error) {
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
router.get('/:id', async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;
        if (isNaN(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID'
            });
        }
        const result = await (0, friendGroups_1.getFriendGroupDetails)(groupId, userId);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
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
router.put('/:id', async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;
        const { name, description, icon, visibility } = req.body;
        if (isNaN(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID'
            });
        }
        const updateData = {
            name,
            description,
            icon,
            visibility
        };
        const group = await (0, friendGroups_1.updateFriendGroup)(groupId, updateData, userId);
        res.json({
            success: true,
            data: group
        });
    }
    catch (error) {
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
router.delete('/:id', async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;
        if (isNaN(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID'
            });
        }
        const success = await (0, friendGroups_1.deleteFriendGroup)(groupId, userId);
        if (success) {
            res.json({
                success: true,
                message: 'Group deleted successfully'
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
    }
    catch (error) {
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
router.post('/:id/members', async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const userId = req.user.id;
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
        await (0, friendGroups_1.addGroupMembers)(groupId, memberIds, userId);
        res.json({
            success: true,
            message: 'Members added successfully'
        });
    }
    catch (error) {
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
router.delete('/:id/members/:memberId', async (req, res) => {
    try {
        const groupId = parseInt(req.params.id);
        const memberId = req.params.memberId;
        const userId = req.user.id;
        if (isNaN(groupId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid group ID'
            });
        }
        const success = await (0, friendGroups_1.removeGroupMember)(groupId, memberId, userId);
        if (success) {
            res.json({
                success: true,
                message: 'Member removed successfully'
            });
        }
        else {
            res.status(404).json({
                success: false,
                message: 'Member not found in group'
            });
        }
    }
    catch (error) {
        console.error('Error removing group member:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'Failed to remove member'
        });
    }
});
exports.default = router;
