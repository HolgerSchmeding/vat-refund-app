import {Request} from "express";

/**
 * Extended Express Request type with Firebase authentication
 * P2-Priority: Type safety for authenticated requests
 */

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role?: "admin" | "user" | "readonly";
  tenantId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Type guard to check if request is authenticated
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return !!(req as AuthenticatedRequest).user?.uid;
}

/**
 * Type guard to check if user has admin role
 */
export function isAdminRequest(req: AuthenticatedRequest): boolean {
  return req.user?.role === "admin";
}

/**
 * Type guard to check if user has required role
 */
export function hasRole(req: AuthenticatedRequest, role: string): boolean {
  return req.user?.role === role;
}

/**
 * Extract tenant ID from request headers or user
 */
export function getTenantId(req: AuthenticatedRequest): string | null {
  return (req.headers["x-tenant-id"] as string) || req.user?.tenantId || null;
}
