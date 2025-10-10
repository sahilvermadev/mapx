"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkGroupNameExists = checkGroupNameExists;
exports.createFriendGroup = createFriendGroup;
exports.getUserFriendGroups = getUserFriendGroups;
exports.getFriendGroupDetails = getFriendGroupDetails;
exports.updateFriendGroup = updateFriendGroup;
exports.deleteFriendGroup = deleteFriendGroup;
exports.addGroupMembers = addGroupMembers;
exports.removeGroupMember = removeGroupMember;
exports.getGroupMemberIds = getGroupMemberIds;
const db_1 = __importDefault(require("../db"));
/**
 * Check if a group name already exists for a user
 */
async function checkGroupNameExists(name, creatorId) {
    try {
        const result = await db_1.default.query(`SELECT 1 FROM friend_groups WHERE name = $1 AND created_by = $2`, [name, creatorId]);
        return result.rows.length > 0;
    }
    catch (error) {
        console.error('Error checking group name existence:', error);
        throw error;
    }
}
/**
 * Create a new friend group
 */
async function createFriendGroup(groupData, creatorId) {
    const client = await db_1.default.connect();
    try {
        await client.query('BEGIN');
        // Check if group name already exists for this user
        const nameExists = await checkGroupNameExists(groupData.name, creatorId);
        if (nameExists) {
            throw new Error('A group with this name already exists. Please choose a different name.');
        }
        // Create the group
        const groupResult = await client.query(`INSERT INTO friend_groups (name, description, icon, created_by, visibility)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [groupData.name, groupData.description, groupData.icon, creatorId, groupData.visibility]);
        const group = groupResult.rows[0];
        // Add creator as admin member
        await client.query(`INSERT INTO friend_group_members (group_id, user_id, added_by, role)
       VALUES ($1, $2, $3, 'admin')`, [group.id, creatorId, creatorId]);
        // Add other members
        for (const memberId of groupData.memberIds) {
            if (memberId !== creatorId) {
                await client.query(`INSERT INTO friend_group_members (group_id, user_id, added_by, role)
           VALUES ($1, $2, $3, 'member')`, [group.id, memberId, creatorId]);
            }
        }
        await client.query('COMMIT');
        return group;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Get all groups for a user (groups they created or are member of)
 */
async function getUserFriendGroups(userId) {
    try {
        const result = await db_1.default.query(`SELECT 
        fg.*,
        COUNT(fgm.user_id) as member_count,
        CASE WHEN fgm.user_id IS NOT NULL THEN true ELSE false END as is_member,
        fgm.role
      FROM friend_groups fg
      LEFT JOIN friend_group_members fgm ON fg.id = fgm.group_id AND fgm.user_id = $1
      WHERE fg.created_by = $1 OR fgm.user_id = $1
      GROUP BY fg.id, fg.name, fg.description, fg.icon, fg.created_by, fg.visibility, fg.created_at, fg.updated_at, fgm.user_id, fgm.role
      ORDER BY fg.created_at DESC`, [userId]);
        return result.rows;
    }
    catch (error) {
        console.error('Error getting user friend groups:', error);
        throw error;
    }
}
/**
 * Get group details with members
 */
async function getFriendGroupDetails(groupId, userId) {
    try {
        // Get group info
        const groupResult = await db_1.default.query(`SELECT 
        fg.*,
        COUNT(fgm.user_id) as member_count,
        CASE WHEN fgm.user_id IS NOT NULL THEN true ELSE false END as is_member,
        fgm.role
      FROM friend_groups fg
      LEFT JOIN friend_group_members fgm ON fg.id = fgm.group_id AND fgm.user_id = $2
      WHERE fg.id = $1
      GROUP BY fg.id, fg.name, fg.description, fg.icon, fg.created_by, fg.visibility, fg.created_at, fg.updated_at, fgm.user_id, fgm.role`, [groupId, userId]);
        if (groupResult.rows.length === 0) {
            throw new Error('Group not found');
        }
        // Get members
        const membersResult = await db_1.default.query(`SELECT 
        fgm.*,
        u.display_name,
        u.profile_picture_url
      FROM friend_group_members fgm
      JOIN users u ON fgm.user_id = u.id
      WHERE fgm.group_id = $1
      ORDER BY fgm.joined_at ASC`, [groupId]);
        return {
            group: groupResult.rows[0],
            members: membersResult.rows
        };
    }
    catch (error) {
        console.error('Error getting friend group details:', error);
        throw error;
    }
}
/**
 * Update a friend group
 */
async function updateFriendGroup(groupId, updateData, userId) {
    try {
        // Check if user is admin of the group
        const checkResult = await db_1.default.query(`SELECT 1 FROM friend_group_members 
       WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`, [groupId, userId]);
        if (checkResult.rows.length === 0) {
            throw new Error('Unauthorized: Only group admins can update groups');
        }
        // If updating name, check for duplicates
        if (updateData.name !== undefined) {
            const nameExists = await checkGroupNameExists(updateData.name, userId);
            if (nameExists) {
                // Check if it's the same group (allow keeping the same name)
                const currentGroupResult = await db_1.default.query(`SELECT name FROM friend_groups WHERE id = $1`, [groupId]);
                if (currentGroupResult.rows.length === 0) {
                    throw new Error('Group not found');
                }
                const currentName = currentGroupResult.rows[0].name;
                if (updateData.name !== currentName) {
                    throw new Error('A group with this name already exists. Please choose a different name.');
                }
            }
        }
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        if (updateData.name !== undefined) {
            updateFields.push(`name = $${paramCount++}`);
            values.push(updateData.name);
        }
        if (updateData.description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            values.push(updateData.description);
        }
        if (updateData.icon !== undefined) {
            updateFields.push(`icon = $${paramCount++}`);
            values.push(updateData.icon);
        }
        if (updateData.visibility !== undefined) {
            updateFields.push(`visibility = $${paramCount++}`);
            values.push(updateData.visibility);
        }
        if (updateFields.length === 0) {
            throw new Error('No fields to update');
        }
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(groupId);
        const result = await db_1.default.query(`UPDATE friend_groups 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`, [...values]);
        return result.rows[0];
    }
    catch (error) {
        console.error('Error updating friend group:', error);
        throw error;
    }
}
/**
 * Delete a friend group
 */
async function deleteFriendGroup(groupId, userId) {
    try {
        // Check if user is admin of the group
        const checkResult = await db_1.default.query(`SELECT 1 FROM friend_group_members 
       WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`, [groupId, userId]);
        if (checkResult.rows.length === 0) {
            throw new Error('Unauthorized: Only group admins can delete groups');
        }
        const result = await db_1.default.query(`DELETE FROM friend_groups WHERE id = $1`, [groupId]);
        return (result.rowCount ?? 0) > 0;
    }
    catch (error) {
        console.error('Error deleting friend group:', error);
        throw error;
    }
}
/**
 * Add members to a group
 */
async function addGroupMembers(groupId, memberIds, addedBy) {
    try {
        // Check if user is admin of the group
        const checkResult = await db_1.default.query(`SELECT 1 FROM friend_group_members 
       WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`, [groupId, addedBy]);
        if (checkResult.rows.length === 0) {
            throw new Error('Unauthorized: Only group admins can add members');
        }
        for (const memberId of memberIds) {
            await db_1.default.query(`INSERT INTO friend_group_members (group_id, user_id, added_by, role)
         VALUES ($1, $2, $3, 'member')
         ON CONFLICT (group_id, user_id) DO NOTHING`, [groupId, memberId, addedBy]);
        }
    }
    catch (error) {
        console.error('Error adding group members:', error);
        throw error;
    }
}
/**
 * Remove member from group
 */
async function removeGroupMember(groupId, memberId, removedBy) {
    try {
        // Check if user is admin of the group or removing themselves
        const checkResult = await db_1.default.query(`SELECT role FROM friend_group_members 
       WHERE group_id = $1 AND user_id = $2`, [groupId, removedBy]);
        if (checkResult.rows.length === 0) {
            throw new Error('Unauthorized: User is not a member of this group');
        }
        const userRole = checkResult.rows[0].role;
        const isRemovingSelf = memberId === removedBy;
        if (userRole !== 'admin' && !isRemovingSelf) {
            throw new Error('Unauthorized: Only admins can remove other members');
        }
        const result = await db_1.default.query(`DELETE FROM friend_group_members 
       WHERE group_id = $1 AND user_id = $2`, [groupId, memberId]);
        return (result.rowCount ?? 0) > 0;
    }
    catch (error) {
        console.error('Error removing group member:', error);
        throw error;
    }
}
/**
 * Get group members for filtering recommendations
 */
async function getGroupMemberIds(groupIds) {
    if (groupIds.length === 0)
        return [];
    try {
        const result = await db_1.default.query(`SELECT DISTINCT user_id 
       FROM friend_group_members 
       WHERE group_id = ANY($1)`, [groupIds]);
        return result.rows.map(row => row.user_id);
    }
    catch (error) {
        console.error('Error getting group member IDs:', error);
        throw error;
    }
}
