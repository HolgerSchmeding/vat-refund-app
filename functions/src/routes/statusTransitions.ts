import {Router} from "express";
import {
  updateDocumentStatus,
  getAllowedTransitions,
  validateTransition,
} from "../api/statusTransitions";
import {authenticationMiddleware} from "../middleware/auth";

/**
 * Status Transition API Routes
 * P2-Priority: Secure API endpoints for status management
 */

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticationMiddleware);

/**
 * @route POST /api/documents/update-status
 * @desc Update document status with validation
 * @access Private
 */
router.post("/update-status", updateDocumentStatus);

/**
 * @route GET /api/documents/:documentId/transitions
 * @desc Get allowed status transitions for a document
 * @access Private
 */
router.get("/:documentId/transitions", getAllowedTransitions);

/**
 * @route POST /api/documents/validate-transition
 * @desc Validate a status transition without executing it
 * @access Private
 */
router.post("/validate-transition", validateTransition);

export {router as statusTransitionRoutes};
