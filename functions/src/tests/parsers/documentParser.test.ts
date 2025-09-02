import { describe, it, expect, beforeEach } from 'vitest';
import { 
  parseCurrency, 
  parseLineItem, 
  parseDocumentAIEntities,
  type DocumentAIResponse
} from '../../parsers/documentParser';

/**
 * Unit Tests for Document Parser Module
 * 
 * Tests the core parsing functionality for Document AI responses
 * and currency parsing logic used throughout the VAT refund system.
 */
describe('Document Parser Module', () => {

  describe('parseCurrency function', () => {
    describe('European format parsing (comma as decimal separator)', () => {
      it('should parse European format with thousands separator', () => {
        expect(parseCurrency('€1.234,56')).toBe(1234.56);
        expect(parseCurrency('1.234,56 €')).toBe(1234.56);
        expect(parseCurrency('€2.500,00')).toBe(2500.00);
      });

      it('should parse European format without thousands separator', () => {
        expect(parseCurrency('€123,45')).toBe(123.45);
        expect(parseCurrency('123,45 €')).toBe(123.45);
        expect(parseCurrency('€0,50')).toBe(0.50);
      });

      it('should parse large European amounts', () => {
        expect(parseCurrency('€10.123.456,78')).toBe(10123456.78);
        expect(parseCurrency('999.999,99 €')).toBe(999999.99);
      });
    });

    describe('American format parsing (dot as decimal separator)', () => {
      it('should parse American format with thousands separator', () => {
        expect(parseCurrency('$1,234.56')).toBe(1234.56);
        expect(parseCurrency('$2,500.00')).toBe(2500.00);
        expect(parseCurrency('£3,750.25')).toBe(3750.25);
      });

      it('should parse American format without thousands separator', () => {
        expect(parseCurrency('$123.45')).toBe(123.45);
        expect(parseCurrency('$0.50')).toBe(0.50);
        expect(parseCurrency('123.45')).toBe(123.45);
      });

      it('should parse large American amounts', () => {
        expect(parseCurrency('$1,000,000.00')).toBe(1000000.00);
        expect(parseCurrency('$999,999.99')).toBe(999999.99);
      });
    });

    describe('Neutral format parsing (no currency symbol)', () => {
      it('should parse plain numbers', () => {
        expect(parseCurrency('1234.56')).toBe(1234.56);
        expect(parseCurrency('123.45')).toBe(123.45);
        expect(parseCurrency('0.50')).toBe(0.50);
      });

      it('should parse numbers with spaces', () => {
        expect(parseCurrency('1 234.56')).toBe(1234.56);
        expect(parseCurrency(' 123.45 ')).toBe(123.45);
      });
    });

    describe('Edge cases and error handling', () => {
      it('should handle empty or invalid inputs', () => {
        expect(parseCurrency('')).toBeNaN();
        expect(parseCurrency('   ')).toBeNaN();
        expect(parseCurrency('abc')).toBeNaN();
        expect(parseCurrency('€abc')).toBeNaN();
      });

      it('should handle zero values', () => {
        expect(parseCurrency('€0,00')).toBe(0);
        expect(parseCurrency('$0.00')).toBe(0);
        expect(parseCurrency('0')).toBe(0);
      });

      it('should handle negative values', () => {
        expect(parseCurrency('-€123,45')).toBe(-123.45);
        expect(parseCurrency('€-123,45')).toBe(-123.45);
        expect(parseCurrency('-$123.45')).toBe(-123.45);
      });

      it('should handle malformed currency strings', () => {
        expect(parseCurrency('€€123,45')).toBe(123.45);
        expect(parseCurrency('123,45€€')).toBe(123.45);
        expect(parseCurrency('$ $ 123.45')).toBe(123.45);
      });
    });

    describe('Multiple currency symbols', () => {
      it('should handle different currency symbols', () => {
        expect(parseCurrency('£1,234.56')).toBe(1234.56);
        expect(parseCurrency('¥1234')).toBe(1234);
        expect(parseCurrency('₹1,234.56')).toBe(1234.56);
      });
    });
  });

  describe('parseLineItem function', () => {
    it('should extract basic line item information', () => {
      const text = 'Hotel accommodation - 2 nights @ €400.00 + 21% VAT';
      const result = parseLineItem(text);
      
      expect(result.description).toBe(text);
      expect(result).toHaveProperty('netAmount');
      expect(result).toHaveProperty('vatRate');
      expect(result).toHaveProperty('vatAmount');
      expect(result).toHaveProperty('totalAmount');
      expect(typeof result.netAmount).toBe('number');
      expect(typeof result.vatRate).toBe('number');
      expect(typeof result.vatAmount).toBe('number');
      expect(typeof result.totalAmount).toBe('number');
    });

    it('should handle line items with multiple amounts', () => {
      const text = 'Business meals - €150.00 + €31.50 VAT = €181.50 total';
      const result = parseLineItem(text);
      
      expect(result.description).toBe(text);
      expect(result).toMatchObject({
        description: expect.any(String),
        netAmount: expect.any(Number),
        vatRate: expect.any(Number),
        vatAmount: expect.any(Number),
        totalAmount: expect.any(Number)
      });
    });

    it('should handle line items without clear amounts', () => {
      const text = 'Miscellaneous business expense';
      const result = parseLineItem(text);
      
      expect(result.description).toBe(text);
      expect(result.netAmount).toBe(0);
      expect(result.vatRate).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });

  describe('parseDocumentAIEntities function', () => {
    let mockDocumentAIResponse: DocumentAIResponse;

    beforeEach(() => {
      // Create comprehensive mock Document AI response
      mockDocumentAIResponse = {
        entities: [
          {
            type: 'invoice_id',
            mentionText: 'INV-2025-001'
          },
          {
            type: 'invoice_date',
            mentionText: '2025-08-11'
          },
          {
            type: 'supplier_name',
            mentionText: 'Test Hotel & Conference Center Ltd'
          },
          {
            type: 'total_amount',
            mentionText: '€1,210.00'
          },
          {
            type: 'net_amount',
            mentionText: '€1,000.00'
          },
          {
            type: 'vat_amount',
            mentionText: '€210.00'
          },
          {
            type: 'currency',
            mentionText: 'EUR'
          },
          {
            type: 'line_item',
            mentionText: 'Hotel accommodation - 2 nights @ €400.00 + 21% VAT'
          },
          {
            type: 'line_item',
            mentionText: 'Business meals - €150.00 + 21% VAT'
          },
          {
            type: 'line_item',
            mentionText: 'Conference room rental - €350.00 + 21% VAT'
          },
          {
            type: 'line_item',
            mentionText: 'Alcohol - Wine bottle - €50.00 + 21% VAT'
          },
          {
            type: 'custom_field',
            mentionText: 'Special instruction: Handle with care'
          }
        ]
      };
    });

    it('should extract basic document information correctly', () => {
      const result = parseDocumentAIEntities(mockDocumentAIResponse, 'test-invoice.pdf');
      
      expect(result.invoiceId).toBe('INV-2025-001');
      expect(result.invoiceDate).toBe('2025-08-11');
      expect(result.supplierName).toBe('Test Hotel & Conference Center Ltd');
      expect(result.currency).toBe('EUR');
    });

    it('should parse monetary amounts correctly', () => {
      const result = parseDocumentAIEntities(mockDocumentAIResponse, 'test-invoice.pdf');
      
      expect(result.totalAmount).toBe(1210.00);
      expect(result.netAmount).toBe(1000.00);
      expect(result.vatAmount).toBe(210.00);
    });

    it('should extract and structure line items', () => {
      const result = parseDocumentAIEntities(mockDocumentAIResponse, 'test-invoice.pdf');
      
      expect(result.lineItems).toHaveLength(4);
      
      // Check first line item structure
      const firstLineItem = result.lineItems[0];
      expect(firstLineItem.originalText).toBe('Hotel accommodation - 2 nights @ €400.00 + 21% VAT');
      expect(firstLineItem.description).toBe('Hotel accommodation - 2 nights @ €400.00 + 21% VAT');
      expect(typeof firstLineItem.netAmount).toBe('number');
      expect(typeof firstLineItem.vatRate).toBe('number');
      expect(typeof firstLineItem.vatAmount).toBe('number');
      expect(typeof firstLineItem.totalAmount).toBe('number');
      
      // Check that refundability fields are initialized
      expect(firstLineItem.isRefundable).toBeNull();
      expect(firstLineItem.refundableVatAmount).toBeNull();
      expect(firstLineItem.euSubCode).toBeNull();
      expect(firstLineItem.validationNotes).toBeNull();
    });

    it('should handle unknown entity types in otherFields', () => {
      const result = parseDocumentAIEntities(mockDocumentAIResponse, 'test-invoice.pdf');
      
      expect(result.otherFields).toBeDefined();
      expect(result.otherFields?.custom_field).toBe('Special instruction: Handle with care');
    });

    it('should handle empty or minimal Document AI response', () => {
      const minimalResponse: DocumentAIResponse = {
        entities: [
          {
            type: 'invoice_id',
            mentionText: 'SIMPLE-001'
          }
        ]
      };

      const result = parseDocumentAIEntities(minimalResponse, 'simple-invoice.pdf');
      
      expect(result.invoiceId).toBe('SIMPLE-001');
      expect(result.lineItems).toHaveLength(0);
      expect(result.totalAmount).toBeUndefined();
      expect(result.netAmount).toBeUndefined();
      expect(result.vatAmount).toBeUndefined();
    });

    it('should handle Document AI response with no entities', () => {
      const emptyResponse: DocumentAIResponse = {
        entities: []
      };

      const result = parseDocumentAIEntities(emptyResponse, 'empty-invoice.pdf');
      
      expect(result.lineItems).toHaveLength(0);
      expect(result.invoiceId).toBeUndefined();
      expect(result.supplierName).toBeUndefined();
      expect(result.totalAmount).toBeUndefined();
    });

    it('should handle malformed amount entities gracefully', () => {
      const malformedResponse: DocumentAIResponse = {
        entities: [
          {
            type: 'total_amount',
            mentionText: 'invalid-amount'
          },
          {
            type: 'net_amount',
            mentionText: '€abc.def'
          },
          {
            type: 'vat_amount',
            mentionText: ''
          }
        ]
      };

      const result = parseDocumentAIEntities(malformedResponse, 'malformed-invoice.pdf');
      
      // Should handle NaN values gracefully
      expect(result.totalAmount).toBeNaN();
      expect(result.netAmount).toBeNaN();
      expect(result.vatAmount).toBeNaN();
    });

    it('should preserve all line items regardless of content', () => {
      const mixedLineItemsResponse: DocumentAIResponse = {
        entities: [
          {
            type: 'line_item',
            mentionText: 'Valid hotel expense'
          },
          {
            type: 'line_item',
            mentionText: 'Alcohol purchase - not refundable'
          },
          {
            type: 'line_item',
            mentionText: 'Empty line item: '
          },
          {
            type: 'line_item',
            mentionText: '€€€ Malformed item €€€'
          }
        ]
      };

      const result = parseDocumentAIEntities(mixedLineItemsResponse, 'mixed-items-invoice.pdf');
      
      expect(result.lineItems).toHaveLength(4);
      expect(result.lineItems[0].originalText).toBe('Valid hotel expense');
      expect(result.lineItems[1].originalText).toBe('Alcohol purchase - not refundable');
      expect(result.lineItems[2].originalText).toBe('Empty line item: ');
      expect(result.lineItems[3].originalText).toBe('€€€ Malformed item €€€');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle real-world Document AI response structure', () => {
      const realWorldResponse: DocumentAIResponse = {
        entities: [
          { type: 'invoice_id', mentionText: 'HT-2025-0892' },
          { type: 'invoice_date', mentionText: '2025-09-01' },
          { type: 'supplier_name', mentionText: 'Grand Hotel Europa' },
          { type: 'supplier_address', mentionText: 'Bahnhofstrasse 1, 1010 Wien, Austria' },
          { type: 'total_amount', mentionText: '€2.420,00' },
          { type: 'net_amount', mentionText: '€2.000,00' },
          { type: 'vat_amount', mentionText: '€420,00' },
          { type: 'vat_rate', mentionText: '21%' },
          { type: 'currency', mentionText: 'EUR' },
          { type: 'payment_method', mentionText: 'Corporate Credit Card' },
          { type: 'line_item', mentionText: 'Deluxe Einzelzimmer, 3 Nächte à €500,00' },
          { type: 'line_item', mentionText: 'Frühstück, 3x à €25,00' },
          { type: 'line_item', mentionText: 'Businesscenter Nutzung' },
          { type: 'line_item', mentionText: 'Minibar - Alkohol €95,00' },
          { type: 'line_item', mentionText: 'Konferenzraum 4 Stunden à €150,00' }
        ]
      };

      const result = parseDocumentAIEntities(realWorldResponse, 'grand-hotel-europa.pdf');
      
      // Verify correct parsing
      expect(result.invoiceId).toBe('HT-2025-0892');
      expect(result.invoiceDate).toBe('2025-09-01');
      expect(result.supplierName).toBe('Grand Hotel Europa');
      expect(result.totalAmount).toBe(2420.00);
      expect(result.netAmount).toBe(2000.00);
      expect(result.vatAmount).toBe(420.00);
      expect(result.currency).toBe('EUR');
      
      // Verify line items extraction
      expect(result.lineItems).toHaveLength(5);
      expect(result.lineItems[0].originalText).toContain('Deluxe Einzelzimmer');
      expect(result.lineItems[3].originalText).toContain('Minibar - Alkohol');
      
      // Verify other fields capture
      expect(result.otherFields?.supplier_address).toBe('Bahnhofstrasse 1, 1010 Wien, Austria');
      expect(result.otherFields?.payment_method).toBe('Corporate Credit Card');
      expect(result.otherFields?.vat_rate).toBe('21%');
    });
  });
});
