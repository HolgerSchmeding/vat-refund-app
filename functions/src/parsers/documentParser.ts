/**
 * Document Parser Module
 * Handles conversion of Document AI entities into structured internal data format
 */

import * as logger from "firebase-functions/logger";

/**
 * Interface for Document AI entity
 */
export interface DocumentAIEntity {
  type: string;
  mentionText: string;
}

/**
 * Interface for Document AI response
 */
export interface DocumentAIResponse {
  entities: DocumentAIEntity[];
}

/**
 * Interface for parsed line item data
 */
export interface ParsedLineItem {
  description: string;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * Interface for extracted document data
 */
export interface ExtractedDocumentData {
  invoiceId?: string;
  invoiceDate?: string;
  supplierName?: string;
  totalAmount?: number;
  netAmount?: number;
  vatAmount?: number;
  currency?: string;
  lineItems: Array<{
    originalText: string;
    description: string;
    netAmount: number;
    vatRate: number;
    vatAmount: number;
    totalAmount: number;
    isRefundable: boolean | null;
    refundableVatAmount: number | null;
    euSubCode: string | null;
    validationNotes: string | null;
  }>;
  otherFields?: Record<string, string>;
}

/**
 * Parse currency-like string (e.g. "€1,210.00" or "1.210,00 €") into number.
 * Falls back to NaN if parsing fails.
 */
export function parseCurrency(value: string): number {
  if (!value) return NaN;
  
  // Remove currency symbols and spaces
  let cleaned = value.replace(/[€$£\s]/g, "");
  
  // If European format with comma as decimal separator and dot as thousands
  if (/\d+\.\d{3},\d{2}/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(/,/, ".");
  } else {
    // Remove thousands separators (comma) then keep dot as decimal
    cleaned = cleaned.replace(/,/g, "");
  }
  
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
}

/**
 * Parse a line item text to extract structured data
 */
export function parseLineItem(text: string): ParsedLineItem {
  // Basic parsing logic - in production, this would be more sophisticated
  const result: ParsedLineItem = {
    description: text,
    netAmount: 0,
    vatRate: 0,
    vatAmount: 0,
    totalAmount: 0
  };

  // Extract amounts using regex patterns
  const amountPattern = /€(\d+\.?\d*)/g;
  const amounts = [...text.matchAll(amountPattern)].map(match => 
    parseFloat(match[1])
  );

  // Extract VAT rate
  const vatRatePattern = /(\d+)%\s*VAT/i;
  const vatMatch = text.match(vatRatePattern);
  if (vatMatch) {
    result.vatRate = parseInt(vatMatch[1]);
  }

  // Simple heuristic: if we have amounts, assume first is net, calculate VAT
  if (amounts.length > 0) {
    result.netAmount = amounts[0];
    if (result.vatRate > 0) {
      result.vatAmount = result.netAmount * (result.vatRate / 100);
      result.totalAmount = result.netAmount + result.vatAmount;
    }
  }

  // Extract description (everything before the first amount)
  const firstAmountIndex = text.indexOf("€");
  if (firstAmountIndex > 0) {
    result.description = text.substring(0, firstAmountIndex).trim();
  }

  return result;
}

/**
 * Parse Document AI entities into structured internal data format
 */
export function parseDocumentAIEntities(
  document: DocumentAIResponse,
  filePath: string
): ExtractedDocumentData {
  logger.info(
    "Starting to parse Document AI entities.",
    { filePath, entityCount: document.entities.length }
  );

  if (!document || !document.entities) {
    logger.error("Document AI did not return any entities.", { filePath });
    throw new Error("No entities found in Document AI response");
  }

  logger.info(
    "Successfully processed document with Document AI. " +
    `Found ${document.entities.length} entities.`
  );

  // Log all detected entities for debugging
  logger.info("--- Detected Entities ---");
  for (const entity of document.entities) {
    logger.info(`Type: ${entity.type}, Text: ${entity.mentionText}`);
  }
  logger.info("-----------------------");

  // Initialize extracted data structure
  const extractedData: ExtractedDocumentData = {
    lineItems: []
  };

  // Map key fields from entities
  for (const entity of document.entities) {
    const entityType = entity.type;
    const entityText = entity.mentionText;

    if (!entityType || !entityText) continue;

    switch (entityType) {
      case "invoice_id":
        extractedData.invoiceId = entityText;
        break;
        
      case "invoice_date":
        extractedData.invoiceDate = entityText;
        break;
        
      case "total_amount": {
        const parsed = parseCurrency(entityText);
        extractedData.totalAmount = isNaN(parsed) ? undefined : parsed;
        break;
      }
      
      case "currency":
        extractedData.currency = entityText;
        break;
        
      case "supplier_name":
        extractedData.supplierName = entityText;
        break;
        
      case "net_amount": {
        const parsed = parseCurrency(entityText);
        extractedData.netAmount = isNaN(parsed) ? undefined : parsed;
        break;
      }
      
      case "vat_amount": {
        const parsed = parseCurrency(entityText);
        extractedData.vatAmount = isNaN(parsed) ? undefined : parsed;
        break;
      }
      
      case "line_item": {
        // Parse line item text and store as structured data
        const lineItem = parseLineItem(entityText);
        extractedData.lineItems.push({
          originalText: entityText,
          description: lineItem.description,
          netAmount: lineItem.netAmount,
          vatRate: lineItem.vatRate,
          vatAmount: lineItem.vatAmount,
          totalAmount: lineItem.totalAmount,
          // Will be populated by validation function
          isRefundable: null,
          refundableVatAmount: null,
          euSubCode: null,
          validationNotes: null
        });
        break;
      }
      
      default: {
        // Store other entities in a general object
        if (!extractedData.otherFields) {
          extractedData.otherFields = {};
        }
        extractedData.otherFields[entityType] = entityText;
        break;
      }
    }
  }

  logger.info(
    "Successfully parsed Document AI entities.",
    { 
      filePath,
      invoiceId: extractedData.invoiceId,
      supplierName: extractedData.supplierName,
      totalAmount: extractedData.totalAmount,
      lineItemCount: extractedData.lineItems.length
    }
  );

  return extractedData;
}
