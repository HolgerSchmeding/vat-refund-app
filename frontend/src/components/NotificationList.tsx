import React, { useRef, useEffect } from 'react';
import { X, Clock, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { type Notification } from '../hooks/useNotifications';
import './NotificationList.css';

interface NotificationListProps {
  notifications: Notification[];
  onClose: () => void;
  onNotificationRead: (notificationId: string) => void;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onClose,
  onNotificationRead
}) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Mark notification as read when user interacts with it
  const markAsRead = async (notification: Notification) => {
    if (notification.isRead) return;

    try {
      // Direct Firestore update - simpler and more reliable for testing
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      
      await updateDoc(doc(db, 'notifications', notification.id), {
        isRead: true,
        readAt: serverTimestamp()
      });
      
      onNotificationRead(notification.id);
      console.log('✅ Notification marked as read:', notification.id);
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'status_change':
        return <CheckCircle size={16} className="icon-status-change" />;
      case 'warning':
        return <AlertTriangle size={16} className="icon-warning" />;
      case 'success':
        return <CheckCircle size={16} className="icon-success" />;
      case 'info':
      default:
        return <Info size={16} className="icon-info" />;
    }
  };

  const formatTimestamp = (timestamp: Timestamp | null): string => {
    if (!timestamp) {
      return 'Gerade eben';
    }

    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffInMinutes < 1) return 'Gerade eben';
      if (diffInMinutes < 60) return `vor ${diffInMinutes} Min`;
      
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `vor ${diffInHours} Std`;
      
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `vor ${diffInDays} Tag${diffInDays > 1 ? 'en' : ''}`;
      
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit'
      });
    } catch (error) {
      console.warn('❌ Error formatting timestamp:', error);
      return 'Unbekannt';
    }
  };

  const getStatusDisplayName = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      'uploaded': 'Hochgeladen',
      'processing': 'In Bearbeitung',
      'processed': 'Verarbeitet',
      'validated': 'Validiert',
      'approved': 'Genehmigt',
      'rejected': 'Abgelehnt',
      'submitted': 'Eingereicht',
      'completed': 'Abgeschlossen'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="notification-list-overlay">
      <div className="notification-list" ref={listRef}>
        <div className="notification-header">
          <h3>Benachrichtigungen</h3>
          <button 
            className="close-button" 
            onClick={onClose}
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="notification-content">
          {notifications.length === 0 ? (
            <div className="no-notifications">
              <Info size={24} />
              <p>Keine Benachrichtigungen vorhanden</p>
            </div>
          ) : (
            <div className="notification-items">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.isRead ? 'unread' : 'read'}`}
                  onClick={() => markAsRead(notification)}
                >
                  <div className="notification-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="notification-content-text">
                    <h4 className="notification-title">
                      {notification.title}
                    </h4>
                    <p className="notification-message">
                      {notification.message}
                    </p>
                    
                    {notification.data?.oldStatus && notification.data?.newStatus && (
                      <div className="status-change">
                        <span className="status-from">
                          {getStatusDisplayName(notification.data.oldStatus)}
                        </span>
                        <span className="status-arrow">→</span>
                        <span className="status-to">
                          {getStatusDisplayName(notification.data.newStatus)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="notification-meta">
                    <div className="notification-time">
                      <Clock size={12} />
                      {formatTimestamp(notification.createdAt)}
                    </div>
                    {!notification.isRead && (
                      <div className="unread-indicator" title="Ungelesen" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="notification-footer">
            <p className="notification-count">
              {notifications.length} Benachrichtigung{notifications.length !== 1 ? 'en' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
