#!/usr/bin/env ts-node
/**
 * Test state-of-world with multiple keywords
 */

const apiUrl = 'http://localhost:9002';

async function testMultiKeywords() {
  console.log('=== Testing State of World with Multiple Keywords ===\n');

  // Get actual keywords
  const keywordsResponse = await fetch(`${apiUrl}/api/keywords/read`);
  const keywordsData = await keywordsResponse.json();
  
  if (!keywordsData.success || !keywordsData.keywordSets || keywordsData.keywordSets.length === 0) {
    console.error('❌ No keywords found');
    return;
  }
  
  // Test with first 5 keywords
  const testKeywords = keywordsData.keywordSets.slice(0, 5);
  console.log(`Testing with ${testKeywords.length} keyword sets:`);
  testKeywords.forEach((ks: string[], idx: number) => {
    console.log(`  ${idx + 1}. ${ks.join(', ')}`);
  });
  
  // Build growth metrics (fake >50% growth for all)
  const growthMetrics: Record<string, number> = {};
  testKeywords.forEach((ks: string[]) => {
    const key = JSON.stringify([...ks].slice().sort());
    growthMetrics[key] = 60; // Fake growth > 50
  });
  
  console.log('\nCalling state-of-world API...');
  const stateResponse = await fetch(`${apiUrl}/api/state-of-world`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keywordSets: testKeywords,
      growthMetrics,
    }),
  });
  
  const stateResult = await stateResponse.json();
  console.log('\nResult:');
  console.log(`  Success: ${stateResult.success}`);
  console.log(`  Count: ${stateResult.count}`);
  console.log(`  Has superconclusion: ${!!stateResult.superconclusion}`);
  
  if (stateResult.keywordsAnalyzed) {
    console.log(`\nKeywords analyzed (${stateResult.keywordsAnalyzed.length}):`);
    stateResult.keywordsAnalyzed.forEach((item: any, idx: number) => {
      console.log(`  ${idx + 1}. ${item.keywords.join(', ')} (${item.growth}%)`);
    });
  }
  
  if (stateResult.superconclusion) {
    console.log('\n✅ SUCCESS! Superconclusion generated');
    console.log('\nSuperconclusion preview:');
    console.log(stateResult.superconclusion.substring(0, 300) + '...');
  } else {
    console.log('\n❌ FAILED:', stateResult.message || stateResult.error);
  }
}

testMultiKeywords().catch(console.error);


