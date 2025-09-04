import {Response} from "express";
import {DocumentStatus} from "../types/DocumentStatus";
import {
  StatusTransitionGuard,
  TransitionContext,
  TransitionAuditLogger,
  TransitionEventType,
} from "../guards/StatusTransitionGuard";
import {getFirestore} from "firebase-admin/firestore";
import {AuthenticatedRequest} from "../types/AuthenticatedRequest";

/**
 * Firebase Cloud Function for secure status transitions
 * P2-Priority: Enforced status transition validation
 */

export interface UpdateStatusRequest {
  documentId: string;
  newStatus: DocumentStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface UpdateStatusResponse {
  success: boolean;
  oldStatus?: DocumentStatus;
  newStatus?: DocumentStatus;
  warnings?: string[];
  error?: string;
}

/**
 * Secure document status update with comprehensive validation
 */
export async function updateDocumentStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {documentId, newStatus, reason, metadata = {}} = req.body as UpdateStatusRequest;
    const userId = req.user?.uid;
    const tenantId = req.headers["x-tenant-id"] as string;

    // Input validation
    if (!documentId || !newStatus) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: documentId, newStatus",
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    if (!tenantId) {
      res.status(400).json({
        success: false,
        error: "Tenant ID required in headers",
      });
      return;
    }

    const db = getFirestore();

    // Get current document
    const docRef = db.collection("tenants").doc(tenantId).collection("documents").doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({
        success: false,
        error: "Document not found",
      });
      return;
    }

    const docData = docSnap.data();
    const currentStatus = docData?.status as DocumentStatus;

    if (!currentStatus) {
      res.status(400).json({
        success: false,
        error: "Document has no current status",
      });
      return;
    }

    // Create transition context
    const context: TransitionContext = {
      userId,
      tenantId,
      documentId,
      timestamp: new Date(),
      reason,
      metadata: {
        ...metadata,
        lastTransition: docData?.lastTransition,
        userRole: req.user?.role || "user",
        processingStarted: docData?.processingStarted,
        extractedData: docData?.extractedData,
        validatedBy: docData?.validatedBy,
        vatNumber: docData?.vatNumber,
        invoiceDate: docData?.invoiceDate,
        totalAmount: docData?.totalAmount,
        fileSize: docData?.fileSize,
      },
    };

    // Validate transition
    const validation = StatusTransitionGuard.validateTransition(
      currentStatus,
      newStatus,
      context
    );

    // Log transition attempt
    await TransitionAuditLogger.logTransition({
      type: TransitionEventType.TRANSITION_ATTEMPTED,
      documentId,
      from: currentStatus,
      to: newStatus,
      userId,
      tenantId,
      timestamp: new Date(),
      reason,
      metadata: context.metadata,
    });

    if (!validation.isValid) {
      // Log blocked transition
      await TransitionAuditLogger.logTransition({
        type: TransitionEventType.TRANSITION_BLOCKED,
        documentId,
        from: currentStatus,
        to: newStatus,
        userId,
        tenantId,
        timestamp: new Date(),
        reason,
        errorMessage: validation.errorMessage,
        metadata: context.metadata,
      });

      res.status(400).json({
        success: false,
        error: validation.errorMessage,
        requiredFields: validation.requiredFields,
      });
      return;
    }

    // Log warnings if any
    if (validation.warnings?.length) {
      await TransitionAuditLogger.logTransition({
        type: TransitionEventType.TRANSITION_WARNING,
        documentId,
        from: currentStatus,
        to: newStatus,
        userId,
        tenantId,
        timestamp: new Date(),
        reason,
        warnings: validation.warnings,
        metadata: context.metadata,
      });
    }

    // Update document status
    const updateData: any = {
      status: newStatus,
      lastTransition: new Date(),
      lastModifiedBy: userId,
      lastModified: new Date(),
    };

    // Add transition-specific metadata
    if (reason) {
      updateData.lastTransitionReason = reason;
    }

    // Special handling for specific statuses
    switch (newStatus) {
    case DocumentStatus.PROCESSING:
      updateData.processingStarted = new Date();
      break;

    case DocumentStatus.VALIDATING:
      updateData.validationStarted = new Date();
      break;

    case DocumentStatus.VALIDATED:
      updateData.validatedBy = userId;
      updateData.validatedAt = new Date();
      break;

    case DocumentStatus.SUBMITTING:
      updateData.submissionStarted = new Date();
      break;

    case DocumentStatus.SUBMITTED:
      updateData.submittedAt = new Date();
      break;

    case DocumentStatus.APPROVED:
    case DocumentStatus.REJECTED:
      updateData.approvalDecision = newStatus;
      updateData.decisionMadeBy = userId;
      updateData.decisionMadeAt = new Date();
      if (reason) {
        updateData.decisionReason = reason;
      }
      break;

    case DocumentStatus.COMPLETED:
      updateData.completedAt = new Date();
      break;
    }

    // Perform atomic update
    await docRef.update(updateData);

    // Log successful transition
    await TransitionAuditLogger.logTransition({
      type: TransitionEventType.TRANSITION_COMPLETED,
      documentId,
      from: currentStatus,
      to: newStatus,
      userId,
      tenantId,
      timestamp: new Date(),
      reason,
      warnings: validation.warnings,
      metadata: context.metadata,
    });

    // Return success response
    const response: UpdateStatusResponse = {
      success: true,
      oldStatus: currentStatus,
      newStatus,
      warnings: validation.warnings,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error updating document status:", error);

    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}

/**
 * Get allowed next statuses for a document
 */
export async function getAllowedTransitions(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {documentId} = req.params;
    const userId = req.user?.uid;
    const tenantId = req.headers["x-tenant-id"] as string;

    if (!documentId || !userId || !tenantId) {
      res.status(400).json({
        error: "Missing required parameters",
      });
      return;
    }

    const db = getFirestore();
    const docRef = db.collection("tenants").doc(tenantId).collection("documents").doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({
        error: "Document not found",
      });
      return;
    }

    const docData = docSnap.data();
    const currentStatus = docData?.status as DocumentStatus;

    const context: TransitionContext = {
      userId,
      tenantId,
      documentId,
      timestamp: new Date(),
      metadata: {
        userRole: req.user?.role || "user",
        extractedData: docData?.extractedData,
        validatedBy: docData?.validatedBy,
        vatNumber: docData?.vatNumber,
        invoiceDate: docData?.invoiceDate,
        totalAmount: docData?.totalAmount,
      },
    };

    const allowedStatuses = StatusTransitionGuard.getAllowedNextStatuses(
      currentStatus,
      context
    );

    res.status(200).json({
      currentStatus,
      allowedTransitions: allowedStatuses,
    });
  } catch (error) {
    console.error("Error getting allowed transitions:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
}

/**
 * Validate a potential transition without executing it
 */
export async function validateTransition(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {documentId, newStatus, reason, metadata = {}} = req.body;
    const userId = req.user?.uid;
    const tenantId = req.headers["x-tenant-id"] as string;

    if (!documentId || !newStatus || !userId || !tenantId) {
      res.status(400).json({
        error: "Missing required parameters",
      });
      return;
    }

    const db = getFirestore();
    const docRef = db.collection("tenants").doc(tenantId).collection("documents").doc(documentId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({
        error: "Document not found",
      });
      return;
    }

    const docData = docSnap.data();
    const currentStatus = docData?.status as DocumentStatus;

    const context: TransitionContext = {
      userId,
      tenantId,
      documentId,
      timestamp: new Date(),
      reason,
      metadata: {
        ...metadata,
        userRole: req.user?.role || "user",
        extractedData: docData?.extractedData,
        validatedBy: docData?.validatedBy,
        vatNumber: docData?.vatNumber,
        invoiceDate: docData?.invoiceDate,
        totalAmount: docData?.totalAmount,
      },
    };

    const validation = StatusTransitionGuard.validateTransition(
      currentStatus,
      newStatus,
      context
    );

    res.status(200).json({
      currentStatus,
      targetStatus: newStatus,
      isValid: validation.isValid,
      errorMessage: validation.errorMessage,
      warnings: validation.warnings,
      requiredFields: validation.requiredFields,
    });
  } catch (error) {
    console.error("Error validating transition:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
}
