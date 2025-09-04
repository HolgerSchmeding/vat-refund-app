/**
 * Notification API Endpoints
 * RESTful API for managing user notifications
 */

import {onRequest} from "firebase-functions/v2/https";
import {Request, Response} from "express";
import {authenticateUser} from "../middleware/auth";
import {notificationService} from "../services/NotificationService";
import {createLogger} from "../utils/logger";

const structuredLogger = createLogger("NotificationAPI");

/**
 * Get notifications for authenticated user
 */
export const getNotifications = onRequest(
  {
    cors: true,
    region: "europe-west1",
  },
  async (req: Request, res: Response) => {
    const timing = structuredLogger.startFunction({
      method: req.method,
      url: req.url,
    });

    try {
      // Authenticate user
      const authResult = await authenticateUser(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error,
        });
        structuredLogger.endFunction(timing.startTime, {status: 401});
        return;
      }

      const {uid: userId} = authResult.user!;
      const limit = parseInt(req.query.limit as string) || 10;

      structuredLogger.info("Getting notifications for user", {
        userId,
        limit,
      });

      // Get recent notifications
      const notifications = await notificationService.getRecentNotifications(userId, limit);

      // Get unread count
      const unreadCount = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: {
          notifications,
          unreadCount,
          total: notifications.length,
        },
      });

      structuredLogger.info("✅ Notifications retrieved successfully", {
        userId,
        count: notifications.length,
        unreadCount,
      });

      structuredLogger.endFunction(timing.startTime, {status: 200});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to get notifications",
        error instanceof Error ? error : new Error(errorMessage));

      res.status(500).json({
        success: false,
        error: "Internal server error",
      });

      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));
    }
  }
);

/**
 * Mark notification as read
 */
export const markNotificationAsRead = onRequest(
  {
    cors: true,
    region: "europe-west1",
  },
  async (req: Request, res: Response) => {
    const timing = structuredLogger.startFunction({
      method: req.method,
      url: req.url,
    });

    try {
      // Only allow POST requests
      if (req.method !== "POST") {
        res.status(405).json({
          success: false,
          error: "Method not allowed",
        });
        structuredLogger.endFunction(timing.startTime, {status: 405});
        return;
      }

      // Authenticate user
      const authResult = await authenticateUser(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error,
        });
        structuredLogger.endFunction(timing.startTime, {status: 401});
        return;
      }

      const {uid: userId} = authResult.user!;
      const {notificationId} = req.body;

      if (!notificationId) {
        res.status(400).json({
          success: false,
          error: "notificationId is required",
        });
        structuredLogger.endFunction(timing.startTime, {status: 400});
        return;
      }

      structuredLogger.info("Marking notification as read", {
        userId,
        notificationId,
      });

      // Mark notification as read
      await notificationService.markAsRead(notificationId, userId);

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
      });

      structuredLogger.info("✅ Notification marked as read", {
        userId,
        notificationId,
      });

      structuredLogger.endFunction(timing.startTime, {status: 200});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to mark notification as read",
        error instanceof Error ? error : new Error(errorMessage));

      res.status(500).json({
        success: false,
        error: "Internal server error",
      });

      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));
    }
  }
);

/**
 * Get unread notifications count
 */
export const getUnreadCount = onRequest(
  {
    cors: true,
    region: "europe-west1",
  },
  async (req: Request, res: Response) => {
    const timing = structuredLogger.startFunction({
      method: req.method,
      url: req.url,
    });

    try {
      // Authenticate user
      const authResult = await authenticateUser(req);
      if (!authResult.success) {
        res.status(401).json({
          success: false,
          error: authResult.error,
        });
        structuredLogger.endFunction(timing.startTime, {status: 401});
        return;
      }

      const {uid: userId} = authResult.user!;

      // Get unread count
      const unreadCount = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: {
          unreadCount,
        },
      });

      structuredLogger.info("✅ Unread count retrieved", {
        userId,
        unreadCount,
      });

      structuredLogger.endFunction(timing.startTime, {status: 200});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      structuredLogger.error("❌ Failed to get unread count",
        error instanceof Error ? error : new Error(errorMessage));

      res.status(500).json({
        success: false,
        error: "Internal server error",
      });

      structuredLogger.failFunction(timing.startTime, error instanceof Error ? error : new Error(errorMessage));
    }
  }
);
