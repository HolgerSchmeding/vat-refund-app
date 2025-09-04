/**
 * Refundability Rules Module
 * Contains EU VAT refund eligibility business logic
 */

import * as logger from "firebase-functions/logger";

/**
 * Interface for refundability check result
 */
export interface RefundabilityResult {
  isRefundable: boolean;
  euSubCode: string | null;
  reason: string;
}

/**
 * EU Sub-codes for different business expense categories
 * Based on EU VAT Directive and common business expense classifications
 */
export const EU_SUB_CODES = {
  HOTEL_ACCOMMODATION: "55.10.10",
  RESTAURANT_SERVICES: "56.10.11",
  BUSINESS_FUEL: "47.30.20",
  BUSINESS_TRAINING: "85.59.12",
  GENERAL_BUSINESS_SERVICES: "77.11.00",
  CONFERENCE_SERVICES: "82.30.00",
  TRANSPORTATION: "49.39.00",
  OFFICE_SUPPLIES: "47.76.20",
  PROFESSIONAL_SERVICES: "69.20.30",
} as const;

/**
 * Categories of non-refundable items according to EU VAT regulations
 */
const NON_REFUNDABLE_KEYWORDS = {
  ALCOHOL: ["alcohol", "wine", "beer", "spirits", "champagne", "whiskey", "vodka", "rum", "alcoholic", "beverages", "minibar"],
  ENTERTAINMENT: ["entertainment", "gift", "personal", "amusement", "leisure"],
  PROHIBITED: ["tobacco", "cigarettes", "gambling", "casino"],
} as const;

/**
 * Categories of refundable business expenses with their EU sub-codes
 * Order matters - more specific categories should come first
 */
const REFUNDABLE_CATEGORIES = {
  TRANSPORTATION: {
    keywords: ["taxi", "uber", "bus ticket", "train ticket", "flight booking", "airline ticket", "transfers", "transfer"],
    euSubCode: EU_SUB_CODES.TRANSPORTATION,
    reason: "Business transportation is refundable",
  },
  ACCOMMODATION: {
    keywords: ["hotel", "accommodation", "lodging", "motel", "guesthouse"],
    euSubCode: EU_SUB_CODES.HOTEL_ACCOMMODATION,
    reason: "Business accommodation is refundable",
  },
  FUEL: {
    keywords: ["fuel", "petrol", "gas", "diesel", "gasoline"],
    euSubCode: EU_SUB_CODES.BUSINESS_FUEL,
    reason: "Business fuel is refundable",
  },
  MEALS: {
    keywords: ["meal", "restaurant", "food", "dining", "catering", "lunch", "dinner", "breakfast", "client meal", "business lunch", "business dinner"],
    euSubCode: EU_SUB_CODES.RESTAURANT_SERVICES,
    reason: "Business meals are refundable",
  },
  TRAINING: {
    keywords: ["training", "training course", "seminar", "workshop", "course enrollment", "education", "conference registration", "conference fee", "course", "educational"],
    euSubCode: EU_SUB_CODES.BUSINESS_TRAINING,
    reason: "Business training and conferences are refundable",
  },
  PROFESSIONAL_SERVICES: {
    keywords: ["consulting", "legal", "accounting", "professional", "advisory", "consulting services", "legal advice", "accounting services", "professional advisory", "expert consultation"],
    euSubCode: EU_SUB_CODES.PROFESSIONAL_SERVICES,
    reason: "Professional services are refundable",
  },
  OFFICE_SUPPLIES: {
    keywords: ["office supplies", "supplies", "stationery", "paper", "pen", "computer"],
    euSubCode: EU_SUB_CODES.OFFICE_SUPPLIES,
    reason: "Office supplies are refundable",
  },
} as const;

/**
 * Check if a description contains any keywords from a given array
 * Uses word boundaries to avoid partial matches (e.g., "pen" shouldn't match "expense")
 */
function containsKeywords(description: string, keywords: readonly string[]): boolean {
  const desc = description.toLowerCase();
  return keywords.some((keyword) => {
    // Use word boundaries for single words, string contains for phrases
    if (keyword.includes(" ")) {
      // Multi-word phrases: use direct string matching
      return desc.includes(keyword);
    } else {
      // Single words: use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      return regex.test(desc);
    }
  });
}

/**
 * Check if a line item description is refundable based on EU VAT rules
 */
export function checkRefundability(description: string): RefundabilityResult {
  logger.info("Checking refundability for item", {description});

  const desc = description.toLowerCase();

  // First check for non-refundable items
  if (containsKeywords(desc, NON_REFUNDABLE_KEYWORDS.ALCOHOL)) {
    return {
      isRefundable: false,
      euSubCode: null,
      reason: "Alcohol products are not eligible for VAT refund under EU regulations",
    };
  }

  if (containsKeywords(desc, NON_REFUNDABLE_KEYWORDS.ENTERTAINMENT)) {
    return {
      isRefundable: false,
      euSubCode: null,
      reason: "Entertainment and gifts are not eligible for VAT refund under EU regulations",
    };
  }

  if (containsKeywords(desc, NON_REFUNDABLE_KEYWORDS.PROHIBITED)) {
    return {
      isRefundable: false,
      euSubCode: null,
      reason: "Prohibited items (tobacco, gambling) are not eligible for VAT refund",
    };
  }

  // Check for specific refundable categories
  for (const [categoryName, category] of Object.entries(REFUNDABLE_CATEGORIES)) {
    if (containsKeywords(desc, category.keywords)) {
      logger.info("Item categorized as refundable", {
        description,
        category: categoryName,
        euSubCode: category.euSubCode,
      });

      return {
        isRefundable: true,
        euSubCode: category.euSubCode,
        reason: category.reason,
      };
    }
  }

  // Default: assume general business expense is refundable
  logger.info("Item categorized as general business expense", {description});

  return {
    isRefundable: true,
    euSubCode: EU_SUB_CODES.GENERAL_BUSINESS_SERVICES,
    reason: "General business expense - refundable under EU VAT regulations",
  };
}

/**
 * Apply refundability rules to a line item and calculate refundable VAT amount
 */
export function applyRefundabilityRules(lineItem: {
  description: string;
  vatAmount: number;
  netAmount: number;
}): {
  isRefundable: boolean;
  refundableVatAmount: number | null;
  euSubCode: string | null;
  validationNotes: string | null;
} {
  const refundabilityCheck = checkRefundability(lineItem.description);

  const result = {
    isRefundable: refundabilityCheck.isRefundable,
    refundableVatAmount: refundabilityCheck.isRefundable ? lineItem.vatAmount : 0,
    euSubCode: refundabilityCheck.euSubCode,
    validationNotes: refundabilityCheck.reason,
  };

  logger.info("Applied refundability rules", {
    description: lineItem.description,
    vatAmount: lineItem.vatAmount,
    result,
  });

  return result;
}

/**
 * Get all available EU sub-codes for reference
 */
export function getAvailableEUSubCodes(): Record<string, string> {
  return {...EU_SUB_CODES};
}

/**
 * Validate if an EU sub-code is valid
 */
export function isValidEUSubCode(code: string): boolean {
  return Object.values(EU_SUB_CODES).includes(code as any);
}
