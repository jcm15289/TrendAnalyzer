#!/usr/bin/env ts-node
/**
 * Test script to verify peak summaries generation
 */

const testKeyword = 'Curtis Sliwa';
const apiUrl = 'http://localhost:9002';

async function testSummariesGeneration() {
  console.log('=== Testing Peak Summaries Generation ===');
  console.log('Keyword:', testKeyword);
  console.log('');

  // Step 1: Fetch trend data
  console.log('Step 1: Fetching trend data...');
  const trendsResponse = await fetch(`${apiUrl}/api/trends/redis?keywords=${encodeURIComponent(testKeyword)}`);
  const trendsData = await trendsResponse.json();
  
  if (!trendsData.success || !trendsData.data) {
    console.error('❌ Failed to fetch trends data:', trendsData);
    return;
  }
  
  console.log('✅ Trends data fetched:', {
    keywords: trendsData.keywords,
    timelinePoints: trendsData.data.timelineData?.length || 0,
  });
  
  // Check if timeline has proper date fields
  const samplePoint = trendsData.data.timelineData?.[0];
  console.log('Sample timeline point:', {
    time: samplePoint?.time,
    formattedTime: samplePoint?.formattedTime,
    formattedAxisTime: samplePoint?.formattedAxisTime,
    value: samplePoint?.value,
  });
  
  // Step 2: Generate explanation (with regenerate=true to force fresh generation)
  console.log('\nStep 2: Generating explanation...');
  const explainResponse = await fetch(`${apiUrl}/api/explain-trend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      keywords: [testKeyword],
      trendData: trendsData.data,
      regenerate: true, // Force regeneration to test new code
    }),
  });
  
  const explainResult = await explainResponse.json();
  
  if (!explainResult.success) {
    console.error('❌ Failed to generate explanation:', explainResult);
    return;
  }
  
  console.log('✅ Explanation generated:', {
    cached: explainResult.cached,
    explanationLength: explainResult.explanation?.length || 0,
    peakSummariesCount: explainResult.peakSummariesCount,
    hasPeakSummaries: explainResult.peakSummaries?.length > 0,
  });
  
  if (explainResult.peakSummaries && explainResult.peakSummaries.length > 0) {
    console.log('\n✅ Peak Summaries Generated:');
    explainResult.peakSummaries.forEach((peak: any, idx: number) => {
      console.log(`  ${idx + 1}. ${peak.date}: "${peak.summary}" (value: ${peak.value})`);
    });
  } else {
    console.log('\n❌ No peak summaries generated');
  }
  
  // Step 3: Fetch peak summaries from cache
  console.log('\nStep 3: Fetching peak summaries from cache...');
  const summariesResponse = await fetch(`${apiUrl}/api/peak-summaries?keywords=${encodeURIComponent(testKeyword)}`);
  const summariesResult = await summariesResponse.json();
  
  console.log('Peak summaries cache result:', {
    success: summariesResult.success,
    peakCount: summariesResult.peakSummaries?.length || 0,
  });
  
  if (summariesResult.peakSummaries && summariesResult.peakSummaries.length > 0) {
    console.log('\n✅ Peak Summaries from Cache:');
    summariesResult.peakSummaries.forEach((peak: any, idx: number) => {
      console.log(`  ${idx + 1}. ${peak.date}: "${peak.summary}" (value: ${peak.value})`);
    });
  } else {
    console.log('\n❌ No peak summaries in cache');
  }
  
  console.log('\n=== Test Complete ===');
}

testSummariesGeneration().catch(console.error);



