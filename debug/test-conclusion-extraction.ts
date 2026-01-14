#!/usr/bin/env ts-node
/**
 * Test conclusion extraction from explanation
 */

const apiUrl = 'http://localhost:9002';

async function testConclusionExtraction() {
  console.log('=== Testing Conclusion Extraction ===\n');

  // Get explanation for a keyword
  const testKeywords = ['Extremism'];
  
  const explainResponse = await fetch(`${apiUrl}/api/explain-trend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keywords: testKeywords,
      trendData: { timelineData: [] },
      regenerate: false,
    }),
  });
  
  const explainResult = await explainResponse.json();
  
  if (!explainResult.explanation) {
    console.error('❌ No explanation found');
    return;
  }
  
  const explanation = explainResult.explanation;
  console.log('Explanation length:', explanation.length);
  console.log('\n=== Full Explanation ===');
  console.log(explanation);
  console.log('\n=== Looking for Conclusion ===');
  
  // Test the extraction patterns
  const patterns = [
    /(?:^|\n)\s*4\.\s+(?:A\s+short\s+)?[Cc]onclusion[:\s]*\n/i,
    /##+\s+[Cc]onclusion\s*\n/i,
    /(?:^|\n)\s*[Cc]onclusion[:\s]*\n/i,
  ];
  
  patterns.forEach((pattern, idx) => {
    const match = explanation.match(pattern);
    if (match) {
      console.log(`\n✅ Pattern ${idx + 1} matched at index:`, match.index);
      console.log('Matched text:', match[0]);
      console.log('Text after match:', explanation.substring(match.index! + match[0].length, match.index! + match[0].length + 200));
    } else {
      console.log(`❌ Pattern ${idx + 1} did not match`);
    }
  });
  
  // Check for conclusion-like text
  const conclusionMentions = explanation.match(/[Cc]onclusion/gi);
  if (conclusionMentions) {
    console.log(`\nFound ${conclusionMentions.length} mentions of "conclusion"`);
    conclusionMentions.forEach((_, idx) => {
      const regex = new RegExp(`.{0,100}[Cc]onclusion.{0,100}`, 'gi');
      const matches = explanation.match(regex);
      if (matches && matches[idx]) {
        console.log(`\nContext ${idx + 1}:`, matches[idx]);
      }
    });
  }
}

testConclusionExtraction().catch(console.error);


