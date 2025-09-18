import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Header from '@/components/Header';
import FeedPost from '@/components/FeedPost';
import { feedApi } from '@/services/feed';
import { socialApi, type User, type FeedPost as FeedPostType } from '@/services/social';
import { apiClient } from '@/services/api';

// Types
// type FeedType = 'all' | 'friends' | 'category';

// Constants
const FEED_LIMIT = 20;
const FEED_OFFSET = 0;
const SUGGESTED_USERS_LIMIT = 5;

// Helper functions
const getInitials = (name: string): string => 
  name.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const getProxiedImageUrl = (url?: string): string => {
  if (!url) return '';
  return url.includes('googleusercontent.com')
    ? `http://localhost:5000/auth/profile-picture?url=${encodeURIComponent(url)}`
    : url;
};

// Component
const SocialFeedPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);

  // Effects
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
  }, [navigate]);

  useEffect(() => {
    if (!currentUser) return;
    loadFeed();
    loadSuggestedUsers();
  }, [currentUser, selectedCategory]);

  // Event handlers
  const loadFeed = async () => {
    console.log('=== LOADING SOCIAL FEED ===');
    console.log('SocialFeedPage - currentUser:', currentUser);
    console.log('SocialFeedPage - currentUser.id:', currentUser.id);
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('SocialFeedPage - Calling feedApi.getFeed with:', { userId: currentUser.id, limit: FEED_LIMIT, offset: FEED_OFFSET });
      let response = await feedApi.getFeed(currentUser.id, FEED_LIMIT, FEED_OFFSET);
      console.log('SocialFeedPage - Feed API response:', response);
      console.log('SocialFeedPage - Feed posts count:', response.data?.length || 0);
      
      if (response.success && response.data) {
        setPosts(response.data);
      } else {
        setError(response.error || 'Failed to load feed');
        setPosts([]);
      }
    } catch (e) {
      console.error('SocialFeedPage - Feed loading error:', e);
      setError('Failed to load feed');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedUsers = async () => {
    try {
      const res = await socialApi.getSuggestedUsers(currentUser.id, SUGGESTED_USERS_LIMIT);
      if (res.success && res.data) {
        setSuggestedUsers(res.data);
      }
    } catch (e) {
      console.error('Failed to load suggested users:', e);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      await socialApi.followUser(userId, currentUser.id);
      loadSuggestedUsers();
      loadFeed();
    } catch (e) {
      console.error('Failed to follow user:', e);
    }
  };

  const handleLogout = async () => {
    try {
      // Call backend logout endpoint to properly clear server-side session
      await fetch('http://localhost:5000/auth/logout', {
        method: 'GET',
        credentials: 'include',
      });
    } catch (error) {
      console.warn('Backend logout failed, continuing with client-side logout:', error);
    }
    
    // Clear client-side authentication state
    localStorage.removeItem('authToken');
    
    // Force a page reload to ensure clean state
    window.location.href = '/';
  };

  const handleNavigateToDiscover = () => {
    navigate('/discover');
  };


  const handleRecommendationPosted = () => {
    // Refresh the feed to show new content
    loadFeed();
  };

  // Debug current user
  useEffect(() => {
    if (currentUser) {
      console.log('SocialFeedPage - currentUser:', currentUser);
      console.log('SocialFeedPage - currentUser.id:', currentUser.id);
    }
  }, [currentUser]);

  // Render components
  const renderLoadingState = () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <p>Loading user...</p>
      </div>
    </div>
  );


  const renderFeedContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mb-4" />
          <p>Loading posts...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadFeed} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      );
    }

    if (posts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
          <p className="text-muted-foreground mb-4 text-center">
            Follow some users to see their recommendations in your feed!
          </p>
          <Button onClick={handleNavigateToDiscover}>
            <Plus className="h-4 w-4 mr-2" />
            Discover Users
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {posts.map((post) => (
          <FeedPost
            key={post.annotation_id}
            post={post}
            currentUserId={currentUser.id}
            onPostUpdate={loadFeed}
          />
        ))}
      </div>
    );
  };

  const renderSuggestedUser = (user: User) => (
    <div key={user.id} className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={getProxiedImageUrl(user.profile_picture_url)} alt={user.display_name} />
        <AvatarFallback>
          {getInitials(user.display_name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{user.display_name}</div>
        <div className="text-xs text-muted-foreground">
          {user.followers_count || 0} followers
        </div>
      </div>
      
      <Button
        variant={user.is_following ? 'outline' : 'default'}
        size="sm"
        onClick={() => handleFollow(user.id)}
        disabled={user.is_following}
      >
        {user.is_following ? 'Following' : 'Follow'}
      </Button>
    </div>
  );

  const renderSuggestedUsersCard = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Suggested Users
        </CardTitle>
        <CardDescription>
          People you might want to follow
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {suggestedUsers.length > 0 ? (
          suggestedUsers.map(renderSuggestedUser)
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No suggestions available
          </p>
        )}
      </CardContent>
      
      <CardContent className="pt-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full" 
          onClick={handleNavigateToDiscover}
        >
          View All Users
        </Button>
      </CardContent>
    </Card>
  );


  // Early return for loading state
  if (!currentUser) {
    return renderLoadingState();
  }

  // Main render
  return (
    <div className="min-h-screen bg-background">
      <Header 
        currentUserId={currentUser?.id}
        showMapButton={true}
        showProfileButton={true}
        showDiscoverButton={true}
        showLogoutButton={true}
        showShareButton={true}
        title="RECCE"
        variant="dark"
        mapButtonText="Explore Places"
        mapButtonLink="/"
        onLogout={handleLogout}
        onRecommendationPosted={handleRecommendationPosted}
        profilePictureUrl={currentUser?.profilePictureUrl}
        displayName={currentUser?.displayName}
      />

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            {renderFeedContent()}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {suggestedUsers.length > 0 && renderSuggestedUsersCard()}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};

export default SocialFeedPage;
