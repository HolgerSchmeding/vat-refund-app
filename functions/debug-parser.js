// Quick debug test for parseCurrency function

function parseCurrency(value) {
  console.log('parseCurrency called with:', JSON.stringify(value), 'type:', typeof value);
  if (!value || typeof value !== 'string') return NaN;
  
  // Remove multiple currency symbols and extra spaces
  let cleaned = value.replace(/[€$£¥₹\s]+/g, "").trim();
  
  // Handle negative signs
  const isNegative = cleaned.includes('-');
  cleaned = cleaned.replace(/[-]/g, "");
  
  // Detect format based on patterns
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleaned)) {
    // European format: 1.234.567,89 (dot as thousands, comma as decimal)
    cleaned = cleaned.replace(/\./g, "").replace(/,/, ".");
  } else if (/^\d+,\d{2}$/.test(cleaned)) {
    // European format without thousands: 123,45
    cleaned = cleaned.replace(/,/, ".");
  } else if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(cleaned)) {
    // American format: 1,234,567.89 (comma as thousands, dot as decimal)
    cleaned = cleaned.replace(/,/g, "");
  } else if (/^\d+\.\d{2}$/.test(cleaned)) {
    // American format without thousands: 123.45 (already correct)
    // No change needed
  } else if (/^\d+$/.test(cleaned)) {
    // Plain integer
    // No change needed
  } else {
    // Fallback: remove all commas, keep dots
    cleaned = cleaned.replace(/,/g, "");
  }
  
  const n = parseFloat(cleaned);
  const result = isNaN(n) ? NaN : (isNegative ? -n : n);
  console.log('Result:', result);
  return result;
}

console.log('=== Testing empty string ===');
const emptyResult = parseCurrency('');
console.log('Final result for empty string:', emptyResult);
console.log('Is NaN?', Number.isNaN(emptyResult));

console.log('\n=== Testing invalid ===');
const invalidResult = parseCurrency('invalid-amount');
console.log('Final result for invalid:', invalidResult);
console.log('Is NaN?', Number.isNaN(invalidResult));

console.log('\n=== Testing €abc.def ===');
const abcResult = parseCurrency('€abc.def');
console.log('Final result for €abc.def:', abcResult);
console.log('Is NaN?', Number.isNaN(abcResult));
