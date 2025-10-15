import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { notificationsApi, type Notification } from '@/services/notificationsService';

interface NotificationsBellProps {
  currentUserId?: string;
  variant?: 'default' | 'dark';
}

const NotificationsBell: React.FC<NotificationsBellProps> = ({ currentUserId, variant = 'default' }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const buttonClasses = useMemo(() => (variant === 'dark' ? 'text-white hover:bg-white/10 hover:text-white' : ''), [variant]);

  const loadUnreadCount = async () => {
    if (!currentUserId) return;
    try {
      const res = await notificationsApi.getUnreadCount(currentUserId);
      if (res.success) {
        setUnreadCount(res.data?.count || 0);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const loadNotifications = async () => {
    if (!currentUserId) return;
    try {
      const res = await notificationsApi.getNotifications(currentUserId, 20, 0);
      if (res.success) {
        setNotifications(res.data || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const id = window.setInterval(loadUnreadCount, 30000);
    return () => window.clearInterval(id);
  }, [currentUserId]);

  const handleOpenChange = async (open: boolean) => {
    if (open) {
      // Load both notifications and refresh unread count when opening
      await Promise.all([loadNotifications(), loadUnreadCount()]);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentUserId || isMarkingAllRead) return;
    
    console.log('Marking all notifications as read for user:', currentUserId);
    
    setIsMarkingAllRead(true);
    try {
      const res = await notificationsApi.markAllAsRead(currentUserId);
      console.log('Mark all read response:', res);
      if (res.success) {
        setUnreadCount(0);
        // Optimistically mark all as read
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
        // Refresh the actual count to ensure accuracy
        await loadUnreadCount();
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!currentUserId) return;
    
    console.log('Marking notification as read:', notification.id, 'for user:', currentUserId);
    
    // Mark as read
    try {
      const res = await notificationsApi.markAsRead(notification.id, currentUserId);
      console.log('Mark as read response:', res);
      if (res.success) {
        setNotifications(prev => prev.map(n => (n.id === notification.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)));
        // Refresh the actual count to ensure accuracy
        await loadUnreadCount();
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
    
    // Navigate to post if it's a mention notification for a post
    if (notification.type === 'mention' && notification.data?.content_id && notification.data?.content_type === 'post') {
      navigate(`/post/${notification.data.content_id}`);
    }
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={`relative ${buttonClasses}`} aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 rounded-full bg-red-500 text-white text-[10px] leading-5 text-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Notifications</span>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleMarkAllRead} 
            disabled={isMarkingAllRead || unreadCount === 0}
            className="h-7 px-2 text-xs"
          >
            {isMarkingAllRead ? 'Marking...' : 'Mark all read'}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-auto">
          {notifications.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem key={n.id} className={`flex items-start gap-2 py-2 cursor-pointer ${n.is_read ? '' : 'bg-accent/30'}`} onClick={() => handleNotificationClick(n)}>
                <div className="mt-1">
                  <span className="text-base">🔔</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-snug text-foreground truncate">{n.message}</div>
                  {n.data?.content_preview && (
                    <div className="text-xs text-muted-foreground truncate">{n.data.content_preview}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsBell;



