// Debug für die keyword matching Logik mit word boundaries

const OFFICE_SUPPLIES_KEYWORDS = ["office", "supplies", "stationery", "paper", "pen", "computer"];

function containsKeywords(description, keywords) {
  const desc = description.toLowerCase();
  console.log('Checking description:', desc);
  
  for (const keyword of keywords) {
    let match;
    if (keyword.includes(' ')) {
      // Multi-word phrases: use direct string matching
      match = desc.includes(keyword);
    } else {
      // Single words: use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      match = regex.test(desc);
    }
    console.log(`  "${keyword}" -> ${match}`);
    if (match) return true;
  }
  return false;
}

console.log('=== Testing OFFICE_SUPPLIES match ===');
const result = containsKeywords("General business expense", OFFICE_SUPPLIES_KEYWORDS);
console.log('Final result:', result);
