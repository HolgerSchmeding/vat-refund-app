/**
 * Real-Time Notification Cloud Function
 * Triggers when document status changes and sends appropriate notifications
 */

import {onDocumentUpdated} from "firebase-functions/v2/firestore";
import {createLogger} from "../utils/logger";
import {notificationService} from "../services/NotificationService";
import {DocumentStatus} from "../types/DocumentStatus";

const structuredLogger = createLogger("sendNotificationOnStatusChange");

/**
 * Cloud Function that triggers on document updates
 * Listens for status changes and sends appropriate notifications
 */
export const sendNotificationOnStatusChange = onDocumentUpdated(
  {
    document: "documents/{documentId}",
    region: "europe-west1",
  },
  async (event) => {
    const timing = structuredLogger.startFunction({
      documentId: event.params.documentId,
      eventType: "document.updated",
    });

    try {
      const beforeData = event.data?.before?.data();
      const afterData = event.data?.after?.data();
      const documentId = event.params.documentId;

      // Ensure we have valid data
      if (!beforeData || !afterData) {
        structuredLogger.warn("No valid data found in document update event", {
          documentId,
          hasBefore: !!beforeData,
          hasAfter: !!afterData,
        });
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      // Check if status actually changed
      const oldStatus = beforeData.status as DocumentStatus;
      const newStatus = afterData.status as DocumentStatus;

      if (oldStatus === newStatus) {
        structuredLogger.debug("Status unchanged, no notification needed", {
          documentId,
          status: newStatus,
        });
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      // Get user ID for the notification
      const userId = afterData.userId || afterData.uid;
      if (!userId) {
        structuredLogger.warn("No userId found in document", {
          documentId,
          oldStatus,
          newStatus,
        });
        structuredLogger.endFunction(timing.startTime);
        return;
      }

      // Extract invoice number or document identifier
      const invoiceNumber = afterData.invoiceNumber ||
                           afterData.metadata?.invoiceNumber ||
                           afterData.extractedData?.invoiceNumber ||
                           documentId;

      structuredLogger.info("Processing status change notification", {
        documentId,
        userId,
        oldStatus,
        newStatus,
        invoiceNumber,
      });

      // Create status change notification
      const notificationId = await notificationService.createStatusChangeNotification(
        userId,
        documentId,
        invoiceNumber,
        newStatus,
        oldStatus
      );

      if (notificationId) {
        structuredLogger.info("✅ Status change notification sent successfully", {
          documentId,
          userId,
          notificationId,
          statusChange: `${oldStatus} → ${newStatus}`,
        });
      } else {
        structuredLogger.debug("No notification template found for status change", {
          documentId,
          statusChange: `${oldStatus} → ${newStatus}`,
        });
      }

      structuredLogger.endFunction(timing.startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to process status change notification",
        error instanceof Error ? error : new Error(errorMessage), {
          documentId: event.params.documentId,
          error: errorMessage,
        });
      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));

      // Don't throw - we don't want to fail the document update
      // Just log the error and continue
    }
  }
);
