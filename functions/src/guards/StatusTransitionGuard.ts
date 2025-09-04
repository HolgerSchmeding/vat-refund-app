import {DocumentStatus, DocumentStatusUtils} from "../types/DocumentStatus";

/**
 * Advanced status transition validation with business logic
 * P2-Priority: Status Transition Guards
 */

export interface TransitionContext {
  userId: string;
  tenantId: string;
  documentId: string;
  timestamp: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface TransitionValidationResult {
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
  requiredFields?: string[];
}

/**
 * Advanced status transition guard with business logic validation
 */
export class StatusTransitionGuard {
  /**
   * Validate a status transition with comprehensive business logic
   */
  static validateTransition(
    from: DocumentStatus,
    to: DocumentStatus,
    context: TransitionContext
  ): TransitionValidationResult {
    // First check basic transition validity
    if (!DocumentStatusUtils.isValidTransition(from, to)) {
      return {
        isValid: false,
        errorMessage: `Invalid transition from ${from} to ${to}. This transition is not allowed.`,
      };
    }

    // Apply specific business logic guards
    const businessValidation = this.validateBusinessLogic(from, to, context);
    if (!businessValidation.isValid) {
      return businessValidation;
    }

    // Apply temporal constraints
    const temporalValidation = this.validateTemporalConstraints(from, to, context);
    if (!temporalValidation.isValid) {
      return temporalValidation;
    }

    // Apply permission constraints
    const permissionValidation = this.validatePermissions(from, to, context);
    if (!permissionValidation.isValid) {
      return permissionValidation;
    }

    // Combine all warnings from different validation steps
    const allWarnings = [
      ...(businessValidation.warnings || []),
      ...(temporalValidation.warnings || []),
      ...(permissionValidation.warnings || []),
    ];

    return {
      isValid: true,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    };
  }

  /**
   * Business logic validation for specific transitions
   */
  private static validateBusinessLogic(
    from: DocumentStatus,
    to: DocumentStatus,
    context: TransitionContext
  ): TransitionValidationResult {
    const warnings: string[] = [];
    const requiredFields: string[] = [];

    // Validation for moving to PROCESSING
    if (to === DocumentStatus.PROCESSING) {
      if (from === DocumentStatus.UPLOADED) {
        // Ensure document is properly uploaded
        if (!context.metadata?.fileSize || context.metadata.fileSize === 0) {
          return {
            isValid: false,
            errorMessage: "Cannot process document: file appears to be empty or corrupted",
          };
        }
      }
    }

    // Validation for moving to VALIDATING
    if (to === DocumentStatus.VALIDATING) {
      if (!context.metadata?.extractedData) {
        return {
          isValid: false,
          errorMessage: "Cannot validate document: no extracted data available",
        };
      }
    }

    // Validation for moving to READY_FOR_SUBMISSION
    if (to === DocumentStatus.READY_FOR_SUBMISSION) {
      const required = ["vatNumber", "invoiceDate", "totalAmount"];
      const missing = required.filter((field) => !context.metadata?.[field]);

      if (missing.length > 0) {
        return {
          isValid: false,
          errorMessage: "Cannot proceed to submission: missing required data",
          requiredFields: missing,
        };
      }

      // Warn about potential issues
      if (context.metadata?.totalAmount < 25) {
        warnings.push("Total amount is below minimum refund threshold (€25)");
      }
    }

    // Validation for moving to SUBMITTING
    if (to === DocumentStatus.SUBMITTING) {
      if (!context.metadata?.validatedBy) {
        return {
          isValid: false,
          errorMessage: "Document must be validated by a user before submission",
        };
      }

      // Check submission window (e.g., business hours)
      const hour = context.timestamp.getHours();
      if (hour < 8 || hour > 18) {
        warnings.push("Submitting outside business hours - processing may be delayed");
      }
    }

    // Validation for error recovery transitions
    if (DocumentStatusUtils.isErrorStatus(from)) {
      if (!context.reason) {
        return {
          isValid: false,
          errorMessage: "Error recovery requires a reason for the transition",
        };
      }
    }

    // Validation for rejection
    if (to === DocumentStatus.REJECTED) {
      if (!context.reason) {
        return {
          isValid: false,
          errorMessage: "Rejection requires a detailed reason",
        };
      }
    }

    // Validation for address correction
    if (to === DocumentStatus.ADDRESS_CORRECTION_REQUESTED) {
      if (!context.metadata?.correctionDetails) {
        return {
          isValid: false,
          errorMessage: "Address correction requires correction details",
        };
      }
    }

    return {
      isValid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      requiredFields: requiredFields.length > 0 ? requiredFields : undefined,
    };
  }

  /**
   * Temporal constraint validation
   */
  private static validateTemporalConstraints(
    from: DocumentStatus,
    to: DocumentStatus,
    context: TransitionContext
  ): TransitionValidationResult {
    const now = context.timestamp;

    // Prevent rapid state changes (debouncing)
    if (context.metadata?.lastTransition) {
      const lastTransition = new Date(context.metadata.lastTransition);
      const timeDiff = now.getTime() - lastTransition.getTime();

      // Prevent transitions within 1 second (except for error states)
      if (timeDiff < 1000 && !DocumentStatusUtils.isErrorStatus(to)) {
        return {
          isValid: false,
          errorMessage: "Transition rejected: too frequent status changes detected",
        };
      }
    }

    // Weekend/holiday restrictions for submissions
    if (to === DocumentStatus.SUBMITTING) {
      const dayOfWeek = now.getDay();

      // Restrict submissions on weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
          isValid: false,
          errorMessage: "Submissions are not processed on weekends",
        };
      }
    }

    // Maximum processing time constraints
    if (from === DocumentStatus.PROCESSING && context.metadata?.processingStarted) {
      const processingStart = new Date(context.metadata.processingStarted);
      const processingTime = now.getTime() - processingStart.getTime();

      // If processing takes more than 10 minutes, require manual intervention
      if (processingTime > 10 * 60 * 1000 && to !== DocumentStatus.PROCESSING_ERROR) {
        return {
          isValid: false,
          errorMessage: "Processing timeout exceeded - manual intervention required",
        };
      }
    }

    return {isValid: true};
  }

  /**
   * Permission-based validation
   */
  private static validatePermissions(
    from: DocumentStatus,
    to: DocumentStatus,
    context: TransitionContext
  ): TransitionValidationResult {
    // Admin-only transitions
    const adminOnlyTransitions = [
      DocumentStatus.SYSTEM_ERROR,
      DocumentStatus.APPROVED,
      DocumentStatus.REJECTED,
    ];

    if (adminOnlyTransitions.includes(to)) {
      if (!context.metadata?.userRole || context.metadata.userRole !== "admin") {
        return {
          isValid: false,
          errorMessage: `Transition to ${to} requires administrator privileges`,
        };
      }
    }

    // User role-based restrictions
    if (context.metadata?.userRole === "readonly") {
      return {
        isValid: false,
        errorMessage: "Read-only users cannot modify document status",
      };
    }

    // Tenant isolation check
    if (!context.tenantId) {
      return {
        isValid: false,
        errorMessage: "Tenant ID required for status transitions",
      };
    }

    return {isValid: true};
  }

  /**
   * Get allowed next statuses considering business logic
   */
  static getAllowedNextStatuses(
    current: DocumentStatus,
    context: TransitionContext
  ): DocumentStatus[] {
    const basicTransitions = DocumentStatusUtils.getPossibleNextStatuses(current);

    return basicTransitions.filter((nextStatus) => {
      const validation = this.validateTransition(current, nextStatus, context);
      return validation.isValid;
    });
  }

  /**
   * Pre-validate a transition and return detailed feedback
   */
  static preValidateTransition(
    from: DocumentStatus,
    to: DocumentStatus,
    context: Partial<TransitionContext>
  ): TransitionValidationResult {
    const fullContext: TransitionContext = {
      userId: context.userId || "unknown",
      tenantId: context.tenantId || "unknown",
      documentId: context.documentId || "unknown",
      timestamp: context.timestamp || new Date(),
      reason: context.reason,
      metadata: context.metadata || {},
    };

    return this.validateTransition(from, to, fullContext);
  }
}

/**
 * Transition guard middleware for Firebase functions
 */
export class TransitionGuardMiddleware {
  /**
   * Express middleware for status transition validation
   */
  static validateRequest(req: any, res: any, next: any) {
    const {from, to, documentId} = req.body;
    const {uid: userId} = req.user;
    const tenantId = req.headers["x-tenant-id"];

    if (!from || !to || !documentId) {
      return res.status(400).json({
        error: "Missing required fields: from, to, documentId",
      });
    }

    const context: TransitionContext = {
      userId,
      tenantId,
      documentId,
      timestamp: new Date(),
      reason: req.body.reason,
      metadata: req.body.metadata || {},
    };

    const validation = StatusTransitionGuard.validateTransition(from, to, context);

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errorMessage,
        requiredFields: validation.requiredFields,
      });
    }

    if (validation.warnings) {
      res.locals.warnings = validation.warnings;
    }

    req.transitionContext = context;
    next();
  }
}

/**
 * Status transition event types
 */
export enum TransitionEventType {
  TRANSITION_ATTEMPTED = "transition_attempted",
  TRANSITION_BLOCKED = "transition_blocked",
  TRANSITION_COMPLETED = "transition_completed",
  TRANSITION_WARNING = "transition_warning"
}

/**
 * Transition event for audit logging
 */
export interface TransitionEvent {
  type: TransitionEventType;
  documentId: string;
  from: DocumentStatus;
  to: DocumentStatus;
  userId: string;
  tenantId: string;
  timestamp: Date;
  reason?: string;
  errorMessage?: string;
  warnings?: string[];
  metadata?: Record<string, any>;
}

/**
 * Audit logger for status transitions
 */
export class TransitionAuditLogger {
  static async logTransition(event: TransitionEvent): Promise<void> {
    // In production, this would write to a secure audit log
    console.log(`[AUDIT] ${event.type}: ${event.from} -> ${event.to} for document ${event.documentId} by user ${event.userId}`);

    if (event.errorMessage) {
      console.error(`[AUDIT ERROR] ${event.errorMessage}`);
    }

    if (event.warnings) {
      console.warn(`[AUDIT WARNING] ${event.warnings.join(", ")}`);
    }
  }
}
