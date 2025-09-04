import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationList } from './NotificationList';
import './NotificationBell.css';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, loading } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleNotificationsClose = () => {
    setShowNotifications(false);
  };

  const handleNotificationRead = (notificationId: string) => {
    // The useNotifications hook will handle the real-time updates
    console.log('📧 Notification read:', notificationId);
  };

  if (loading) {
    return (
      <div className="notification-bell loading">
        <Bell size={20} />
      </div>
    );
  }

  return (
    <div className="notification-bell-container">
      <button 
        className={`notification-bell ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={handleBellClick}
        title={`${unreadCount} ungelesene Benachrichtigungen`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <NotificationList
          notifications={notifications}
          onClose={handleNotificationsClose}
          onNotificationRead={handleNotificationRead}
        />
      )}
    </div>
  );
};
