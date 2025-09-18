import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { socialApi, type User } from '@/services/social';
import { apiClient } from '@/services/api';

const UserDiscoveryPage: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = apiClient.getCurrentUser();
    if (!user) {
      // Add a small delay to ensure auth state is properly cleared
      setTimeout(() => {
        navigate('/');
      }, 100);
      return;
    }
    setCurrentUser(user);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    searchUsers();
  }, [currentUser, searchQuery]);

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
      } else {
        setUsers([]);
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
      // Update the user's following status in the list
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: true } : user
      ));
    } catch (error) {
      console.error('Failed to follow user:', error);
    }
  };

  const unfollow = async (userId: string) => {
    try {
      await socialApi.unfollowUser(userId, currentUser.id);
      // Update the user's following status in the list
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, is_following: false } : user
      ));
    } catch (error) {
      console.error('Failed to unfollow user:', error);
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p>Loading user...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/feed')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Discover People
            </h1>
          </div>
        </div>
      </header>

      {/* Search Section */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Users
              </CardTitle>
              <CardDescription>
                Find people to follow and discover their recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={searchUsers} disabled={loading || !searchQuery.trim()}>
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {searchQuery.trim() && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                {loading ? 'Searching...' : `Found ${users.length} users`}
              </h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : users.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No users found matching "{searchQuery}"
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {users.map((user) => (
                    <Card key={user.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={user.profile_picture_url} alt={user.display_name} />
                            <AvatarFallback>
                              {getInitials(user.display_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{user.display_name}</h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {user.email}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{user.followers_count || 0} followers</span>
                              <span>{user.following_count || 0} following</span>
                            </div>
                          </div>
                          <Button
                            variant={user.is_following ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => user.is_following ? unfollow(user.id) : follow(user.id)}
                          >
                            {user.is_following ? 'Following' : 'Follow'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!searchQuery.trim() && (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Start Discovering</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Search for users by their name or email to find people to follow and discover their recommendations.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDiscoveryPage; 