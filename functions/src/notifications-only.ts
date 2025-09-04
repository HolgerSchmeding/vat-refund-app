/**
 * Notification-only exports for deployment
 * This file exports only the notification functions to avoid storage dependencies
 */

// Export the P3-Priority Real-Time Notification functions
export {sendNotificationOnStatusChange} from "./triggers/sendNotificationOnStatusChange";
export {getNotifications, markNotificationAsRead, getUnreadCount} from "./api/notifications";
