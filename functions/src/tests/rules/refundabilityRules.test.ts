import { describe, it, expect } from 'vitest';
import { 
  checkRefundability, 
  applyRefundabilityRules,
  getAvailableEUSubCodes,
  isValidEUSubCode,
  EU_SUB_CODES
} from '../../rules/refundabilityRules';

/**
 * Unit Tests for Refundability Rules Module
 * 
 * Tests the EU VAT refund eligibility business logic including
 * sub-code assignment and refundability checking for various expense types.
 */
describe('Refundability Rules Module', () => {

  describe('checkRefundability function', () => {
    
    describe('Refundable expenses', () => {
      describe('Hotel and accommodation', () => {
        it('should identify hotel expenses as refundable', () => {
          const testCases = [
            'Hotel accommodation - 2 nights',
            'HOTEL BOOKING FOR BUSINESS TRIP',
            'Luxury hotel suite rental',
            'motel stay overnight',
            'Guesthouse accommodation'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.HOTEL_ACCOMMODATION);
            expect(result.reason).toContain('accommodation');
          });
        });
      });

      describe('Restaurant and meals', () => {
        it('should identify meal expenses as refundable', () => {
          const testCases = [
            'Business lunch with client',
            'Restaurant bill for team meeting', 
            'Food catering for conference',
            'Dinner expense during business travel',
            'Client meal at fine dining restaurant'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.RESTAURANT_SERVICES);
            expect(result.reason).toContain('meals');
          });
        });

        it('should categorize hotel breakfast as accommodation', () => {
          const result = checkRefundability('Breakfast at hotel restaurant');
          expect(result.isRefundable).toBe(true);
          expect(result.euSubCode).toBe(EU_SUB_CODES.HOTEL_ACCOMMODATION);
          expect(result.reason).toContain('accommodation');
        });
      });

      describe('Transportation expenses', () => {
        it('should identify transportation as refundable', () => {
          const testCases = [
            'Taxi to airport',
            'Uber ride to client meeting',
            'Bus ticket for business travel',
            'Train ticket intercity',
            'Flight booking for conference',
            'Airline ticket business class'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.TRANSPORTATION);
            expect(result.reason).toContain('transportation');
          });
        });
      });

      describe('Fuel and vehicle expenses', () => {
        it('should identify fuel expenses as refundable', () => {
          const testCases = [
            'Fuel for company car',
            'Petrol station receipt',
            'Diesel for business trip',
            'Gas station payment',
            'Gasoline for rental car'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.BUSINESS_FUEL);
            expect(result.reason).toContain('fuel');
          });
        });
      });

      describe('Training and conferences', () => {
        it('should identify training expenses as refundable', () => {
          const testCases = [
            'Conference registration fee',
            'Training course enrollment',
            'Professional seminar attendance',
            'Workshop materials and fees',
            'Educational course payment',
            'Professional development training'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.BUSINESS_TRAINING);
            expect(result.reason).toContain('training');
          });
        });
      });

      describe('Office supplies', () => {
        it('should identify office supplies as refundable', () => {
          const testCases = [
            'Office supplies purchase',
            'Stationery for department',
            'Paper and pens for office',
            'Computer peripherals',
            'Office furniture and supplies'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.OFFICE_SUPPLIES);
            expect(result.reason).toContain('supplies');
          });
        });
      });

      describe('Professional services', () => {
        it('should identify professional services as refundable', () => {
          const testCases = [
            'Consulting services contract',
            'Legal advice and representation',
            'Accounting and bookkeeping services',
            'Professional advisory services',
            'Expert consultation fees'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.PROFESSIONAL_SERVICES);
            expect(result.reason).toContain('Professional services');
          });
        });
      });

      describe('General business expenses', () => {
        it('should default unknown business expenses to refundable', () => {
          const testCases = [
            'General business expense',
            'Miscellaneous office cost',
            'Business operational expense',
            'Company service payment',
            'Corporate subscription fee'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(true);
            expect(result.euSubCode).toBe(EU_SUB_CODES.GENERAL_BUSINESS_SERVICES);
            expect(result.reason).toContain('General business expense');
          });
        });
      });
    });

    describe('Non-refundable expenses', () => {
      describe('Alcohol and alcoholic beverages', () => {
        it('should identify alcohol expenses as non-refundable', () => {
          const testCases = [
            'Wine bottle purchase',
            'Beer for office party',
            'Spirits and alcohol',
            'Champagne celebration',
            'Whiskey bottle gift',
            'Vodka and rum selection',
            'ALCOHOL MINIBAR CHARGES',
            'alcoholic beverages for event'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(false);
            expect(result.euSubCode).toBeNull();
            expect(result.reason).toContain('Alcohol products are not eligible');
          });
        });
      });

      describe('Entertainment and gifts', () => {
        it('should identify entertainment expenses as non-refundable', () => {
          const testCases = [
            'Entertainment expenses',
            'Gift for client',
            'Personal shopping',
            'Amusement park tickets',
            'Leisure activities',
            'ENTERTAINMENT AND GIFTS',
            'personal items purchase'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(false);
            expect(result.euSubCode).toBeNull();
            expect(result.reason).toContain('Entertainment and gifts are not eligible');
          });
        });
      });

      describe('Prohibited items', () => {
        it('should identify prohibited items as non-refundable', () => {
          const testCases = [
            'Tobacco products',
            'Cigarettes purchase',
            'Gambling expenses',
            'Casino spending',
            'TOBACCO AND CIGARETTES'
          ];

          testCases.forEach(description => {
            const result = checkRefundability(description);
            expect(result.isRefundable).toBe(false);
            expect(result.euSubCode).toBeNull();
            expect(result.reason).toContain('Prohibited items');
          });
        });
      });
    });

    describe('Case sensitivity and keyword matching', () => {
      it('should handle case-insensitive keyword matching', () => {
        const testCases = [
          { description: 'HOTEL ACCOMMODATION', expected: true },
          { description: 'hotel accommodation', expected: true },
          { description: 'Hotel Accommodation', expected: true },
          { description: 'HoTeL aCcOmMoDaTiOn', expected: true },
          { description: 'ALCOHOL PURCHASE', expected: false },
          { description: 'alcohol purchase', expected: false },
          { description: 'Alcohol Purchase', expected: false }
        ];

        testCases.forEach(({ description, expected }) => {
          const result = checkRefundability(description);
          expect(result.isRefundable).toBe(expected);
        });
      });

      it('should match partial keywords within descriptions', () => {
        const testCases = [
          'The hotel was excellent for our business trip',
          'Had a wonderful meal at the restaurant',
          'Fuel costs for the company vehicle',
          'Conference attendance was very beneficial'
        ];

        testCases.forEach(description => {
          const result = checkRefundability(description);
          expect(result.isRefundable).toBe(true);
        });
      });
    });

    describe('Edge cases', () => {
      it('should handle empty descriptions', () => {
        const result = checkRefundability('');
        expect(result.isRefundable).toBe(true);
        expect(result.euSubCode).toBe(EU_SUB_CODES.GENERAL_BUSINESS_SERVICES);
      });

      it('should handle whitespace-only descriptions', () => {
        const result = checkRefundability('   ');
        expect(result.isRefundable).toBe(true);
        expect(result.euSubCode).toBe(EU_SUB_CODES.GENERAL_BUSINESS_SERVICES);
      });

      it('should handle special characters and numbers', () => {
        const testCases = [
          'Hotel*** booking #12345',
          'Restaurant $$$$ expense 2025',
          'Fuel@Station!!! receipt',
          'Conference-2025 & Workshop+++'
        ];

        testCases.forEach(description => {
          const result = checkRefundability(description);
          expect(result.isRefundable).toBe(true);
          expect(result.euSubCode).not.toBeNull();
        });
      });
    });

    describe('Conflicting keywords priority', () => {
      it('should prioritize non-refundable keywords over refundable ones', () => {
        const testCases = [
          'Hotel restaurant alcohol service',
          'Business meal with wine',
          'Conference gift for speakers',
          'Transportation to casino'
        ];

        testCases.forEach(description => {
          const result = checkRefundability(description);
          expect(result.isRefundable).toBe(false);
        });
      });
    });
  });

  describe('applyRefundabilityRules function', () => {
    it('should apply rules and calculate refundable VAT for refundable items', () => {
      const lineItem = {
        description: 'Hotel accommodation for business trip',
        vatAmount: 84.00,
        netAmount: 400.00
      };

      const result = applyRefundabilityRules(lineItem);

      expect(result.isRefundable).toBe(true);
      expect(result.refundableVatAmount).toBe(84.00);
      expect(result.euSubCode).toBe(EU_SUB_CODES.HOTEL_ACCOMMODATION);
      expect(result.validationNotes).toContain('accommodation');
    });

    it('should set refundable VAT to 0 for non-refundable items', () => {
      const lineItem = {
        description: 'Wine bottle for office party',
        vatAmount: 21.00,
        netAmount: 100.00
      };

      const result = applyRefundabilityRules(lineItem);

      expect(result.isRefundable).toBe(false);
      expect(result.refundableVatAmount).toBe(0);
      expect(result.euSubCode).toBeNull();
      expect(result.validationNotes).toContain('not eligible');
    });

    it('should handle zero VAT amounts', () => {
      const lineItem = {
        description: 'Business consulting service',
        vatAmount: 0,
        netAmount: 1000.00
      };

      const result = applyRefundabilityRules(lineItem);

      expect(result.isRefundable).toBe(true);
      expect(result.refundableVatAmount).toBe(0);
      expect(result.euSubCode).toBe(EU_SUB_CODES.PROFESSIONAL_SERVICES);
    });

    it('should handle negative VAT amounts', () => {
      const lineItem = {
        description: 'Hotel refund adjustment',
        vatAmount: -42.00,
        netAmount: -200.00
      };

      const result = applyRefundabilityRules(lineItem);

      expect(result.isRefundable).toBe(true);
      expect(result.refundableVatAmount).toBe(-42.00);
      expect(result.euSubCode).toBe(EU_SUB_CODES.HOTEL_ACCOMMODATION);
    });
  });

  describe('EU Sub-codes management', () => {
    describe('getAvailableEUSubCodes function', () => {
      it('should return all available EU sub-codes', () => {
        const codes = getAvailableEUSubCodes();
        
        expect(codes).toHaveProperty('HOTEL_ACCOMMODATION', '55.10.10');
        expect(codes).toHaveProperty('RESTAURANT_SERVICES', '56.10.11');
        expect(codes).toHaveProperty('BUSINESS_FUEL', '47.30.20');
        expect(codes).toHaveProperty('BUSINESS_TRAINING', '85.59.12');
        expect(codes).toHaveProperty('GENERAL_BUSINESS_SERVICES', '77.11.00');
        expect(codes).toHaveProperty('CONFERENCE_SERVICES', '82.30.00');
        expect(codes).toHaveProperty('TRANSPORTATION', '49.39.00');
        expect(codes).toHaveProperty('OFFICE_SUPPLIES', '47.76.20');
        expect(codes).toHaveProperty('PROFESSIONAL_SERVICES', '69.20.30');
      });

      it('should return a copy (not reference) of EU sub-codes', () => {
        const codes1 = getAvailableEUSubCodes();
        const codes2 = getAvailableEUSubCodes();
        
        codes1.TEST = 'modified';
        expect(codes2).not.toHaveProperty('TEST');
      });
    });

    describe('isValidEUSubCode function', () => {
      it('should validate correct EU sub-codes', () => {
        const validCodes = [
          '55.10.10', // HOTEL_ACCOMMODATION
          '56.10.11', // RESTAURANT_SERVICES
          '47.30.20', // BUSINESS_FUEL
          '85.59.12', // BUSINESS_TRAINING
          '77.11.00', // GENERAL_BUSINESS_SERVICES
          '82.30.00', // CONFERENCE_SERVICES
          '49.39.00', // TRANSPORTATION
          '47.76.20', // OFFICE_SUPPLIES
          '69.20.30'  // PROFESSIONAL_SERVICES
        ];

        validCodes.forEach(code => {
          expect(isValidEUSubCode(code)).toBe(true);
        });
      });

      it('should reject invalid EU sub-codes', () => {
        const invalidCodes = [
          '00.00.00',
          '99.99.99',
          'invalid-code',
          '',
          '55.10.11', // Close but not exact
          '55.10', // Incomplete
          '55.10.10.00' // Too long
        ];

        invalidCodes.forEach(code => {
          expect(isValidEUSubCode(code)).toBe(false);
        });
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex real-world invoice line items', () => {
      const realWorldLineItems = [
        {
          description: 'Hotel Grand Europa, Deluxe Business Suite, 3 nights @ €500/night incl. breakfast',
          vatAmount: 315.00,
          netAmount: 1500.00,
          expectedRefundable: true,
          expectedEuSubCode: EU_SUB_CODES.HOTEL_ACCOMMODATION
        },
        {
          description: 'Client dinner at Michelin-starred restaurant - wine pairing included',
          vatAmount: 52.50,
          netAmount: 250.00,
          expectedRefundable: false, // Contains wine/alcohol
          expectedEuSubCode: null
        },
        {
          description: 'Taxi transfers: Airport ↔ Hotel ↔ Conference Center (3 trips)',
          vatAmount: 21.00,
          netAmount: 100.00,
          expectedRefundable: true,
          expectedEuSubCode: EU_SUB_CODES.TRANSPORTATION
        },
        {
          description: 'Business consulting services: Digital transformation strategy (40 hours)',
          vatAmount: 840.00,
          netAmount: 4000.00,
          expectedRefundable: true,
          expectedEuSubCode: EU_SUB_CODES.PROFESSIONAL_SERVICES
        },
        {
          description: 'Office supplies: Laptops, monitors, ergonomic chairs for new team',
          vatAmount: 420.00,
          netAmount: 2000.00,
          expectedRefundable: true,
          expectedEuSubCode: EU_SUB_CODES.OFFICE_SUPPLIES
        }
      ];

      realWorldLineItems.forEach(item => {
        const result = applyRefundabilityRules(item);
        
        expect(result.isRefundable).toBe(item.expectedRefundable);
        expect(result.euSubCode).toBe(item.expectedEuSubCode);
        
        if (item.expectedRefundable) {
          expect(result.refundableVatAmount).toBe(item.vatAmount);
        } else {
          expect(result.refundableVatAmount).toBe(0);
        }
      });
    });
  });
});
