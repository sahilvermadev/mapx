import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Plus, UserPlus, UserCheck, UserX, Users2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { socialApi, type User } from '@/services/socialService';
import { useAuth } from '@/auth';
import GroupCreator from '@/components/GroupCreator';
import GroupList from '@/components/GroupList';

const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated, isChecking } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
  const [activeFriendsTab, setActiveFriendsTab] = useState<'following' | 'followers' | 'search'>('following');

  useEffect(() => {
    // Only redirect if auth check is complete and user is not authenticated
    if (!isChecking && !isAuthenticated) {
      navigate('/');
      return;
    }
  }, [isChecking, isAuthenticated, navigate]);

  useEffect(() => {
    if (!currentUser) return;
    loadFollowers();
    loadFollowing();
    if (searchQuery.trim()) {
      searchUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    
    if (searchQuery.trim()) {
      // Automatically switch to search tab when user starts searching
      setActiveFriendsTab('search');
      
      // Debounce the search to avoid too many API calls
      const timeoutId = setTimeout(() => {
        searchUsers();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    } else {
      setUsers([]);
    }
  }, [searchQuery, currentUser]);

  // Show loading while authentication is being checked
  if (isChecking) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-96" />
            </div>

            {/* Navigation Pills Skeleton */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>

            {/* Search and Content Skeleton */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-9 flex-1" />
                <div className="flex space-x-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>

              {/* Sub-navigation Skeleton */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>

              {/* User Cards Skeleton */}
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                        <div className="flex gap-4">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  const loadFollowers = async () => {
    setFollowersLoading(true);
    try {
      const response = await socialApi.getFollowers(currentUser.id, currentUser.id, 50, 0);
      if (response.success && response.data) {
        setFollowers(Array.isArray(response.data) ? response.data : response.data.users || []);
      } else {
        setFollowers([]);
      }
    } catch (error) {
      console.error('Failed to load followers:', error);
      setFollowers([]);
    } finally {
      setFollowersLoading(false);
    }
  };

  const loadFollowing = async () => {
    setFollowingLoading(true);
    try {
      const response = await socialApi.getFollowing(currentUser.id, currentUser.id, 50, 0);
      if (response.success && response.data) {
        setFollowing(Array.isArray(response.data) ? response.data : response.data.users || []);
      } else {
        setFollowing([]);
      }
    } catch (error) {
      console.error('Failed to load following:', error);
      setFollowing([]);
    } finally {
      setFollowingLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await socialApi.searchUsers(searchQuery, currentUser.id);
      if (response.success && response.data) {
        setUsers(response.data);
        console.log('Search results:', response.data);
      } else {
        setUsers([]);
        console.log('No search results found');
      }
    } catch (error) {
      console.error('Failed to search users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const follow = async (userId: string) => {
    try {
      await socialApi.followUser(userId, currentUser.id);
      // Update the user's following status in all lists
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: true } : user
      ));
      setFollowing(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: true } : user
      ));
      setFollowers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: true } : user
      ));
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  const unfollow = async (userId: string) => {
    try {
      await socialApi.unfollowUser(userId, currentUser.id);
      // Update the user's following status in all lists
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: false } : user
      ));
      setFollowing(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: false } : user
      ));
      setFollowers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: false } : user
      ));
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);


  const renderUserCard = (user: User) => (
    <Card key={user.id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow" onClick={() => navigate(`/profile/${user.id}`)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 bg-gray-200">
            <AvatarImage src={user.profile_picture_url} alt={user.display_name} />
            <AvatarFallback className="bg-gray-200 text-gray-600 font-medium">
              {getInitials(user.display_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{user.display_name}</h3>
              {user.is_following && (
                <span className="text-sm text-gray-600">Following</span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate mb-2">
              {user.email}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{user.followers_count || 0} followers</span>
              <span>{user.following_count || 0} following</span>
            </div>
          </div>
          <Button
            variant={user.is_following ? 'outline' : 'default'}
            size="sm"
            className={user.is_following ? 'border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'bg-yellow-600 hover:bg-yellow-700 text-white'}
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click when clicking button
              user.is_following ? unfollow(user.id) : follow(user.id);
            }}
          >
            {user.is_following ? (
              <>
                <UserX className="h-4 w-4 mr-1" />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-1" />
                Follow
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (!currentUser) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-96" />
            </div>

            {/* Navigation Pills Skeleton */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>

            {/* Search and Content Skeleton */}
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-9 flex-1" />
                <div className="flex space-x-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>

              {/* Sub-navigation Skeleton */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>

              {/* User Cards Skeleton */}
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                        <div className="flex gap-4">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background">
      {/* Content Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Friends</h1>
            <p className="text-gray-600">Search for people to follow, view followers, or manage groups.</p>
          </div>

          {/* Main Navigation Pills */}
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
            <Button
              variant={activeTab === 'friends' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('friends')}
              className={`flex items-center space-x-2 ${
                activeTab === 'friends' 
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                  : 'hover:bg-gray-200'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Friends</span>
            </Button>
            <Button
              variant={activeTab === 'groups' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('groups')}
              className={`flex items-center space-x-2 ${
                activeTab === 'groups' 
                  ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                  : 'hover:bg-gray-200'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Groups</span>
            </Button>
          </div>

          {/* Friends Tab Content */}
          {activeTab === 'friends' && (
            <div className="space-y-6">
              {/* Search bar with counts */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name or email"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
                
                {/* Counts next to search bar */}
                <div className="flex space-x-4 text-sm text-gray-600 whitespace-nowrap">
                  <span>Following {following.length}</span>
                  <span>Followers {followers.length}</span>
                </div>
              </div>

              {/* Full-width sub-navigation */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full">
                <Button
                  variant={activeFriendsTab === 'following' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFriendsTab('following')}
                  className={`flex-1 ${
                    activeFriendsTab === 'following' 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm' 
                      : 'hover:bg-gray-200'
                  }`}
                >
                  Following
                </Button>
                <Button
                  variant={activeFriendsTab === 'followers' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFriendsTab('followers')}
                  className={`flex-1 ${
                    activeFriendsTab === 'followers' 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm' 
                      : 'hover:bg-gray-200'
                  }`}
                >
                  Followers
                </Button>
                <Button
                  variant={activeFriendsTab === 'search' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFriendsTab('search')}
                  className={`flex-1 ${
                    activeFriendsTab === 'search' 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-sm' 
                      : 'hover:bg-gray-200'
                  }`}
                >
                  Search
                </Button>
              </div>

              {/* Content based on active tab */}
              {activeFriendsTab === 'following' && (
                <div className="space-y-4">
                  {followingLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                              <div className="flex gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : following.length === 0 ? (
                    <div className="text-center py-12">
                      <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">Not Following Anyone</h3>
                      <p className="text-gray-600 max-w-sm mx-auto">
                        Start following people to see their recommendations and discover new places.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {following.map(renderUserCard)}
                    </div>
                  )}
                </div>
              )}

              {activeFriendsTab === 'followers' && (
                <div className="space-y-4">
                  {followersLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                              <div className="flex gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : followers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">No Followers Yet</h3>
                      <p className="text-gray-600 max-w-sm mx-auto">
                        When people follow you, they'll appear here. Share your recommendations to get followers!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {followers.map(renderUserCard)}
                    </div>
                  )}
                </div>
              )}

              {activeFriendsTab === 'search' && (
                <div className="space-y-4">
                  {!searchQuery.trim() ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">Search for People</h3>
                      <p className="text-gray-600 max-w-sm mx-auto">
                        Use the search box above to find people by name or email address.
                      </p>
                    </div>
                  ) : loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                              <div className="flex gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-16" />
                              </div>
                            </div>
                            <Skeleton className="h-8 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">No Results Found</h3>
                      <p className="text-gray-600">
                        No users found matching "{searchQuery}". Try a different search term.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {users.map(renderUserCard)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Groups Tab Content */}
          {activeTab === 'groups' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <UserPlus className="h-6 w-6" />
                    Friend Groups
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Create and manage groups to share recommendations with specific friends
                  </p>
                </div>
                <Button
                  onClick={() => setShowGroupCreator(true)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </div>
              
              <GroupList
                currentUserId={currentUser.id}
                showActions={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Group Creator Modal */}
      <GroupCreator
        isOpen={showGroupCreator}
        onClose={() => setShowGroupCreator(false)}
        onGroupCreated={() => {
          // Refresh groups list if needed
          setShowGroupCreator(false);
        }}
        currentUserId={currentUser.id}
      />
    </div>
  );
};

export default React.memo(FriendsPage); 