/**
 * Structured logging utility with correlation ID support
 * Provides centralized, consistent logging across all Cloud Functions
 */

import * as logger from "firebase-functions/logger";
import {v4 as uuidv4} from "uuid";

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error"
}

/**
 * Standard log context interface
 */
export interface LogContext {
  correlationId: string;
  functionName: string;
  userId?: string;
  documentId?: string;
  filePath?: string;
  tenantId?: string;
  status?: string;
  duration?: number;
  [key: string]: any; // Allow additional custom fields
}

/**
 * Structured log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Central structured logger class
 */
export class StructuredLogger {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = {...context};
  }

  /**
   * Create a new logger instance with correlation ID
   */
  static create(functionName: string, additionalContext: Partial<LogContext> = {}): StructuredLogger {
    const correlationId = uuidv4();
    const context: LogContext = {
      correlationId,
      functionName,
      ...additionalContext,
    };

    return new StructuredLogger(context);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    const childContext = {
      ...this.context,
      ...additionalContext,
    };
    return new StructuredLogger(childContext);
  }

  /**
   * Update context for this logger instance
   */
  updateContext(additionalContext: Partial<LogContext>): void {
    this.context = {
      ...this.context,
      ...additionalContext,
    };
  }

  /**
   * Get the correlation ID for this logger
   */
  getCorrelationId(): string {
    return this.context.correlationId;
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(level: LogLevel, message: string, error?: Error): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {...this.context},
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  /**
   * Log at debug level
   */
  debug(message: string, additionalContext?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message);
    if (additionalContext) {
      entry.context = {...entry.context, ...additionalContext};
    }
    logger.debug(entry);
  }

  /**
   * Log at info level
   */
  info(message: string, additionalContext?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message);
    if (additionalContext) {
      entry.context = {...entry.context, ...additionalContext};
    }
    logger.info(entry);
  }

  /**
   * Log at warn level
   */
  warn(message: string, additionalContext?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message);
    if (additionalContext) {
      entry.context = {...entry.context, ...additionalContext};
    }
    logger.warn(entry);
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error, additionalContext?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, error);
    if (additionalContext) {
      entry.context = {...entry.context, ...additionalContext};
    }
    logger.error(entry);
  }

  /**
   * Log function start with timing
   */
  startFunction(additionalContext?: Record<string, any>): { startTime: number } {
    const startTime = Date.now();
    this.info("🚀 Function started", {
      status: "started",
      startTime,
      ...additionalContext,
    });
    return {startTime};
  }

  /**
   * Log function completion with duration
   */
  endFunction(startTime: number, additionalContext?: Record<string, any>): void {
    const endTime = Date.now();
    const duration = endTime - startTime;

    this.info("✅ Function completed", {
      status: "completed",
      endTime,
      duration,
      ...additionalContext,
    });
  }

  /**
   * Log function failure with duration
   */
  failFunction(startTime: number, error: Error, additionalContext?: Record<string, any>): void {
    const endTime = Date.now();
    const duration = endTime - startTime;

    this.error("❌ Function failed", error, {
      status: "failed",
      endTime,
      duration,
      ...additionalContext,
    });
  }

  /**
   * Log processing step
   */
  step(stepName: string, additionalContext?: Record<string, any>): void {
    this.info(`📋 ${stepName}`, {
      step: stepName,
      ...additionalContext,
    });
  }

  /**
   * Log external service call
   */
  serviceCall(serviceName: string, operation: string, additionalContext?: Record<string, any>): void {
    this.info(`🌐 External service call: ${serviceName}.${operation}`, {
      service: serviceName,
      operation,
      ...additionalContext,
    });
  }

  /**
   * Log data operation (create, update, delete)
   */
  dataOperation(operation: string, collection: string, additionalContext?: Record<string, any>): void {
    this.info(`💾 Data ${operation}: ${collection}`, {
      dataOperation: operation,
      collection,
      ...additionalContext,
    });
  }
}

/**
 * Convenience functions for common logging patterns
 */
export class LogHelpers {
  /**
   * Extract user ID from file path
   */
  static extractUserIdFromPath(filePath: string): string | undefined {
    const match = filePath.match(/uploads\/([^\/]+)\//);
    return match ? match[1] : undefined;
  }

  /**
   * Extract file name from path
   */
  static extractFileName(filePath: string): string {
    return filePath.split("/").pop() || filePath;
  }

  /**
   * Create context from Firebase event
   */
  static createStorageContext(filePath: string, bucket: string): Partial<LogContext> {
    return {
      filePath,
      fileName: LogHelpers.extractFileName(filePath),
      bucket,
      userId: LogHelpers.extractUserIdFromPath(filePath),
    };
  }

  /**
   * Create context from Firestore event
   */
  static createFirestoreContext(documentPath: string, documentId?: string): Partial<LogContext> {
    return {
      documentPath,
      documentId,
      collection: documentPath.split("/")[0],
    };
  }

  /**
   * Sanitize sensitive data for logging
   */
  static sanitizeForLogging(data: any): any {
    const sanitized = {...data};

    // Remove or mask sensitive fields
    const sensitiveFields = ["password", "apiKey", "token", "secret", "key"];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "***REDACTED***";
      }
    }

    return sanitized;
  }
}

/**
 * Global logger factory for backward compatibility
 */
export function createLogger(functionName: string, context?: Partial<LogContext>): StructuredLogger {
  return StructuredLogger.create(functionName, context);
}
