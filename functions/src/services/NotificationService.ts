/**
 * Notification Service
 * Handles creation, storage, and management of real-time notifications
 */

import {getAdminFirestore} from "../config/clients";
import {createLogger} from "../utils/logger";
import {
  Notification,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  NOTIFICATION_TEMPLATES,
  renderNotificationTemplate,
} from "../types/Notification";
import {DocumentStatus} from "../types/DocumentStatus";

const structuredLogger = createLogger("NotificationService");

export class NotificationService {
  private firestore = getAdminFirestore();

  /**
   * Create and store a notification for a user
   */
  async createNotification(
    userId: string,
    documentId: string,
    type: NotificationType,
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    metadata?: any
  ): Promise<string> {
    const timing = structuredLogger.startFunction({
      userId,
      documentId,
      type,
      priority,
    });

    try {
      const notification: Omit<Notification, "id"> = {
        userId,
        documentId,
        type,
        title,
        message,
        status: NotificationStatus.UNREAD,
        priority,
        createdAt: new Date() as any,
        metadata,
      };

      const docRef = await this.firestore
        .collection("notifications")
        .add(notification);

      structuredLogger.info("✅ Notification created successfully", {
        notificationId: docRef.id,
        userId,
        type,
      });

      structuredLogger.endFunction(timing.startTime);
      return docRef.id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to create notification", error instanceof Error ? error : new Error(errorMessage), {
        userId,
        documentId,
        type,
      });
      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  /**
   * Create notification from status change using predefined templates
   */
  async createStatusChangeNotification(
    userId: string,
    documentId: string,
    invoiceNumber: string,
    newStatus: DocumentStatus,
    previousStatus?: DocumentStatus
  ): Promise<string | null> {
    const timing = structuredLogger.startFunction({
      userId,
      documentId,
      invoiceNumber,
      newStatus,
      previousStatus,
    });

    try {
      // Check if we have a template for this status
      const template = NOTIFICATION_TEMPLATES[newStatus];
      if (!template) {
        structuredLogger.info("No notification template found for status", {
          status: newStatus,
        });
        structuredLogger.endFunction(timing.startTime);
        return null;
      }

      // Render the template with variables
      const variables = {
        invoiceNumber: invoiceNumber || documentId,
        newStatus,
        previousStatus: previousStatus || "unknown",
      };

      const title = renderNotificationTemplate(template.titleTemplate, variables);
      const message = renderNotificationTemplate(template.messageTemplate, variables);

      // Create metadata with status change information
      const metadata = {
        previousStatus,
        newStatus,
        actionRequired: template.actionRequired,
        actionUrl: template.actionRequired ? `/documents/${documentId}` : undefined,
      };

      const notificationId = await this.createNotification(
        userId,
        documentId,
        template.type,
        title,
        message,
        template.priority,
        metadata
      );

      structuredLogger.info("✅ Status change notification created", {
        notificationId,
        status: newStatus,
        template: template.type,
      });

      structuredLogger.endFunction(timing.startTime);
      return notificationId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to create status change notification", error instanceof Error ? error : new Error(errorMessage), {
        userId,
        documentId,
        newStatus,
      });
      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const timing = structuredLogger.startFunction({
      notificationId,
      userId,
    });

    try {
      await this.firestore
        .collection("notifications")
        .doc(notificationId)
        .update({
          status: NotificationStatus.READ,
          readAt: new Date(),
        });

      structuredLogger.info("✅ Notification marked as read", {
        notificationId,
        userId,
      });

      structuredLogger.endFunction(timing.startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to mark notification as read", error instanceof Error ? error : new Error(errorMessage), {
        notificationId,
        userId,
      });
      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  /**
   * Get unread notifications count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const snapshot = await this.firestore
        .collection("notifications")
        .where("userId", "==", userId)
        .where("status", "==", NotificationStatus.UNREAD)
        .count()
        .get();

      return snapshot.data().count;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to get unread count", error instanceof Error ? error : new Error(errorMessage), {
        userId,
      });
      return 0;
    }
  }

  /**
   * Get recent notifications for a user
   */
  async getRecentNotifications(
    userId: string,
    limit = 10
  ): Promise<Notification[]> {
    try {
      const snapshot = await this.firestore
        .collection("notifications")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Notification));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to get recent notifications", error instanceof Error ? error : new Error(errorMessage), {
        userId,
      });
      return [];
    }
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  async cleanupOldNotifications(): Promise<number> {
    const timing = structuredLogger.startFunction({});

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const snapshot = await this.firestore
        .collection("notifications")
        .where("createdAt", "<", thirtyDaysAgo)
        .get();

      const batch = this.firestore.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      structuredLogger.info("✅ Old notifications cleaned up", {
        deletedCount: snapshot.docs.length,
      });

      structuredLogger.endFunction(timing.startTime);
      return snapshot.docs.length;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to cleanup old notifications", error instanceof Error ? error : new Error(errorMessage));
      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));
      return 0;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
