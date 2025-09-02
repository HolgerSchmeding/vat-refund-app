/**
 * Input validation schemas for submission endpoints
 * Uses Zod for type-safe validation with detailed error messages
 */

import { z } from "zod";

/**
 * Schema for submission request validation
 */
export const submissionSchema = z.object({
  submissionPeriod: z.string()
    .regex(/^\d{4}-Q[1-4]$/, {
      message: "Invalid period format. Expected YYYY-Q[1-4]."
    }),
  countryCode: z.enum(["DE", "FR", "AT"], {
    message: "Country code must be one of: DE, FR, AT"
  }),
  tenantId: z.string().min(1, "TenantId must not be empty").optional()
});

/**
 * Inferred TypeScript type from schema
 */
export type SubmissionInput = z.infer<typeof submissionSchema>;

/**
 * Validate submission input data with detailed error reporting
 * @param data Raw input data to validate
 * @returns Validated and typed submission data
 * @throws Error with descriptive message if validation fails
 */
export function validateSubmissionInput(data: any): SubmissionInput {
  const parsed = submissionSchema.safeParse(data);
  
  if (!parsed.success) {
    const errors = parsed.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join("; ");
    
    throw new Error(`Invalid submission input: ${errors}`);
  }
  
  return parsed.data;
}

/**
 * Additional business logic validation for submission periods
 * @param period The submission period to validate (YYYY-Q[1-4])
 * @returns true if valid, throws error if invalid
 */
export function validateSubmissionPeriod(period: string): boolean {
  const match = period.match(/^(20\d{2})-Q([1-4])$/);
  if (!match) {
    throw new Error("Invalid period format");
  }
  
  const year = parseInt(match[1]);
  const currentYear = new Date().getFullYear();
  
  // Don't allow future periods beyond current year + 1
  if (year > currentYear + 1) {
    throw new Error(`Period ${period} is too far in the future`);
  }
  
  // Don't allow periods older than 5 years
  if (year < currentYear - 5) {
    throw new Error(`Period ${period} is too old (max 5 years back)`);
  }
  
  return true;
}

/**
 * Validate tenant ID format and permissions
 * @param tenantId The tenant ID to validate
 * @param userTenantId The authenticated user's tenant ID
 * @returns true if valid, throws error if invalid
 */
export function validateTenantAccess(tenantId: string | undefined, userTenantId: string): boolean {
  // If no tenantId provided, use user's tenant
  if (!tenantId) {
    return true;
  }
  
  // Users can only access their own tenant data
  if (tenantId !== userTenantId) {
    throw new Error("Access denied: Cannot access other tenant's data");
  }
  
  return true;
}
