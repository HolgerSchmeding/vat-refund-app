import {Response, NextFunction, Request} from "express";
import {getAuth} from "firebase-admin/auth";
import {AuthenticatedRequest} from "../types/AuthenticatedRequest";

/**
 * Authentication result interface
 */
export interface AuthResult {
  success: boolean;
  user?: {
    uid: string;
    email?: string;
    role?: string;
    tenantId?: string;
  };
  error?: string;
}

/**
 * Authenticate user from request headers
 */
export async function authenticateUser(req: Request): Promise<AuthResult> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        success: false,
        error: "No valid authorization header provided",
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decodedToken = await getAuth().verifyIdToken(token);

      return {
        success: true,
        user: {
          uid: decodedToken.uid,
          email: decodedToken.email,
          role: decodedToken.role || "user",
          tenantId: decodedToken.tenantId,
        },
      };
    } catch (authError) {
      return {
        success: false,
        error: "Invalid or expired token",
      };
    }
  } catch (error) {
    return {
      success: false,
      error: "Internal authentication error",
    };
  }
}

/**
 * Authentication middleware for Firebase
 * P2-Priority: Secure request authentication
 */

export async function authenticationMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({error: "No valid authorization header provided"});
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decodedToken = await getAuth().verifyIdToken(token);

      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: decodedToken.role || "user", // Custom claim
        tenantId: decodedToken.tenantId, // Custom claim
      };

      next();
    } catch (authError) {
      console.error("Token verification failed:", authError);
      res.status(401).json({error: "Invalid or expired token"});
      return;
    }
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({error: "Internal authentication error"});
    return;
  }
}

/**
 * Admin role middleware
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({error: "Admin access required"});
    return;
  }
  next();
}

/**
 * Tenant isolation middleware
 */
export function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const tenantId = req.headers["x-tenant-id"] as string;

  if (!tenantId) {
    res.status(400).json({error: "Tenant ID required in headers"});
    return;
  }

  // Optionally validate user has access to this tenant
  if (req.user?.tenantId && req.user.tenantId !== tenantId) {
    res.status(403).json({error: "Access denied to this tenant"});
    return;
  }

  next();
}
