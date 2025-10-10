// Utility functions for user display names

export interface UserDisplayInfo {
  displayName: string;
  username?: string;
  email?: string;
  profilePictureUrl?: string;
}

// Get the best display name for a user (prefer username, fallback to display_name)
export const getUserDisplayName = (user: UserDisplayInfo): string => {
  return user.username || user.displayName || user.email || 'Unknown User';
};

// Get user initials for avatar fallback
export const getUserInitials = (user: UserDisplayInfo): string => {
  const name = getUserDisplayName(user);
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// Format user display with username if available
export const formatUserDisplay = (user: UserDisplayInfo): { name: string; subtitle?: string } => {
  if (user.username && user.displayName && user.username !== user.displayName) {
    return {
      name: user.displayName,
      subtitle: `@${user.username}`
    };
  }
  
  return {
    name: getUserDisplayName(user)
  };
};
