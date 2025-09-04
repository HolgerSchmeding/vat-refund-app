import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  Timestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebaseConfig';
import { useAuth } from './useAuth';

export interface Notification {
  id: string;
  userId: string;
  tenantId?: string;
  title: string;
  message: string;
  type: 'status_change' | 'info' | 'warning' | 'success';
  isRead: boolean;
  documentId?: string;
  data?: any;
  createdAt: Timestamp | null;
  readAt?: Timestamp | null;
}

export const useNotifications = (limitCount: number = 10) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const notificationsRef = collection(db, 'notifications');
      const notificationsQuery = query(
        notificationsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          const notificationsList: Notification[] = [];
          let unreadCounter = 0;

          snapshot.forEach((doc) => {
            const notificationData = { id: doc.id, ...doc.data() } as Notification;
            
            // Add all notifications, even those with null createdAt (they will be updated by server)
            notificationsList.push(notificationData);
            
            if (!notificationData.isRead) {
              unreadCounter++;
            }
          });

          setNotifications(notificationsList);
          setUnreadCount(unreadCounter);
          setLoading(false);
          setError(null);

          console.log('📨 Notifications updated:', {
            total: notificationsList.length,
            unread: unreadCounter,
            userId: user.uid
          });
        },
        (error) => {
          console.error('❌ Error listening to notifications:', error);
          setError(error.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('❌ Error setting up notifications listener:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setLoading(false);
    }
  }, [user?.uid, limitCount]);

  const markAsRead = async (notificationId: string) => {
    try {
      // Use the Cloud Function for consistency
      const markNotificationAsRead = httpsCallable(functions, 'markNotificationAsRead');
      await markNotificationAsRead({ notificationId });
      
      console.log('✅ Notification marked as read via Cloud Function:', notificationId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      
      // Return error for UI handling instead of fallback
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  };

  const getUnreadCount = async (): Promise<number> => {
    try {
      const getUnreadCountFunction = httpsCallable(functions, 'getUnreadCount');
      const result = await getUnreadCountFunction();
      return (result.data as any)?.count || 0;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return unreadCount; // Fallback to local count
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    getUnreadCount
  };
};
