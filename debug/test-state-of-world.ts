#!/usr/bin/env ts-node
/**
 * Test script to debug state-of-world API
 */

const apiUrl = 'http://localhost:9002';

async function testStateOfWorld() {
  console.log('=== Testing State of World API ===\n');

  // Step 1: Get actual keywords from the app
  console.log('Step 1: Fetching keywords from API...');
  const keywordsResponse = await fetch(`${apiUrl}/api/keywords/read`);
  const keywordsData = await keywordsResponse.json();
  
  if (!keywordsData.success || !keywordsData.keywordSets || keywordsData.keywordSets.length === 0) {
    console.error('❌ No keywords found');
    return;
  }
  
  console.log(`✅ Found ${keywordsData.keywordSets.length} keyword sets`);
  console.log('Sample keywords:', keywordsData.keywordSets.slice(0, 3));
  
  // Step 2: Test with a single keyword that likely has a conclusion
  const testKeywords = keywordsData.keywordSets[0];
  console.log(`\nStep 2: Testing with keywords: ${testKeywords.join(', ')}`);
  
  // Step 3: Check if explanation exists for this keyword
  console.log('\nStep 3: Checking if explanation exists...');
  const explainResponse = await fetch(`${apiUrl}/api/explain-trend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keywords: testKeywords,
      trendData: { timelineData: [] }, // Empty, just checking cache
      regenerate: false,
    }),
  });
  
  const explainResult = await explainResponse.json();
  console.log('Explain API response:', {
    success: explainResult.success,
    cached: explainResult.cached,
    hasExplanation: !!explainResult.explanation,
    explanationLength: explainResult.explanation?.length || 0,
  });
  
  if (explainResult.explanation) {
    console.log('\n✅ Explanation found!');
    console.log('Preview:', explainResult.explanation.substring(0, 200));
    
    // Step 4: Test state-of-world with this keyword
    console.log('\nStep 4: Testing state-of-world API...');
    const key = JSON.stringify([...testKeywords].slice().sort());
    const growthMetrics = { [key]: 60 }; // Fake growth > 50
    
    const stateResponse = await fetch(`${apiUrl}/api/state-of-world`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywordSets: [testKeywords],
        growthMetrics,
      }),
    });
    
    const stateResult = await stateResponse.json();
    console.log('\nState-of-World API response:');
    console.log(JSON.stringify(stateResult, null, 2));
    
    if (stateResult.success && stateResult.superconclusion) {
      console.log('\n✅ SUCCESS! Superconclusion generated');
      console.log('Preview:', stateResult.superconclusion.substring(0, 200));
    } else {
      console.log('\n❌ FAILED:', stateResult.message || stateResult.error);
    }
  } else {
    console.log('\n⚠️ No explanation found for test keyword. Try clicking "Explain" on this keyword first.');
  }
}

testStateOfWorld().catch(console.error);


