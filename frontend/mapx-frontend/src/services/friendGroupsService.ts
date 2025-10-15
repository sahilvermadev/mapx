import { apiClient } from './apiClient';

export interface FriendGroup {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  created_by: string;
  visibility: 'private' | 'members';
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_member?: boolean;
  role?: 'admin' | 'member';
}

export interface FriendGroupMember {
  id: number;
  group_id: number;
  user_id: string;
  added_by: string;
  role: 'admin' | 'member';
  joined_at: string;
  display_name?: string;
  profile_picture_url?: string;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  icon?: string;
  visibility: 'private' | 'members';
  memberIds: string[];
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
  icon?: string;
  visibility?: 'private' | 'members';
}

export interface GroupDetails {
  group: FriendGroup;
  members: FriendGroupMember[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class FriendGroupsApi {
  private baseUrl = '/friend-groups';

  /**
   * Create a new friend group
   */
  async createGroup(groupData: CreateGroupData, currentUserId: string): Promise<ApiResponse<FriendGroup>> {
    try {
      const response = await apiClient.post<FriendGroup>(`${this.baseUrl}?currentUserId=${currentUserId}`, groupData);
      return response;
    } catch (error) {
      console.error('Error creating friend group:', error);
      throw error;
    }
  }

  /**
   * Get all friend groups for a user
   */
  async getUserGroups(currentUserId: string): Promise<ApiResponse<FriendGroup[]>> {
    try {
      const response = await apiClient.get<FriendGroup[]>(`${this.baseUrl}?currentUserId=${currentUserId}`);
      return response;
    } catch (error) {
      console.error('Error getting friend groups:', error);
      throw error;
    }
  }

  /**
   * Get friend group details with members
   */
  async getGroupDetails(groupId: number, currentUserId: string): Promise<ApiResponse<GroupDetails>> {
    try {
      const response = await apiClient.get<GroupDetails>(`${this.baseUrl}/${groupId}?currentUserId=${currentUserId}`);
      return response;
    } catch (error) {
      console.error('Error getting group details:', error);
      throw error;
    }
  }

  /**
   * Update a friend group
   */
  async updateGroup(groupId: number, updateData: UpdateGroupData, currentUserId: string): Promise<ApiResponse<FriendGroup>> {
    try {
      const response = await apiClient.put<FriendGroup>(`${this.baseUrl}/${groupId}?currentUserId=${currentUserId}`, updateData);
      return response;
    } catch (error) {
      console.error('Error updating friend group:', error);
      throw error;
    }
  }

  /**
   * Delete a friend group
   */
  async deleteGroup(groupId: number, currentUserId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete<void>(`${this.baseUrl}/${groupId}?currentUserId=${currentUserId}`);
      return response;
    } catch (error) {
      console.error('Error deleting friend group:', error);
      throw error;
    }
  }

  /**
   * Add members to a group
   */
  async addGroupMembers(groupId: number, memberIds: string[], currentUserId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.post<void>(`${this.baseUrl}/${groupId}/members?currentUserId=${currentUserId}`, {
        memberIds
      });
      return response;
    } catch (error) {
      console.error('Error adding group members:', error);
      throw error;
    }
  }

  /**
   * Remove member from group
   */
  async removeGroupMember(groupId: number, memberId: string, currentUserId: string): Promise<ApiResponse<void>> {
    try {
      const response = await apiClient.delete<void>(`${this.baseUrl}/${groupId}/members/${memberId}?currentUserId=${currentUserId}`);
      return response;
    } catch (error) {
      console.error('Error removing group member:', error);
      throw error;
    }
  }
}

export const friendGroupsApi = new FriendGroupsApi();
