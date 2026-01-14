#!/usr/bin/env tsx

async function testBoycottTrumpFlow() {
  console.log('\n🧪 Testing boycotttrump annotation flow...\n');
  
  // Step 1: Check if peak summaries exist
  console.log('1. Checking peak summaries API...');
  try {
    const response = await fetch('http://localhost:9002/api/peak-summaries?keywords=boycotttrump');
    const result = await response.json();
    console.log('API Response:', JSON.stringify(result, null, 2));
    
    if (result.success && result.peakSummaries && result.peakSummaries.length > 0) {
      console.log(`✅ Found ${result.peakSummaries.length} peak summaries`);
      result.peakSummaries.forEach((p: any, idx: number) => {
        console.log(`  ${idx + 1}. Date: ${p.date}, Summary: ${p.summary}`);
      });
    } else {
      console.log('❌ No peak summaries found');
      console.log('Message:', result.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Step 2: Check if explanation exists
  console.log('\n2. Checking explanation API...');
  try {
    const response = await fetch('http://localhost:9002/api/explain-trend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: ['boycotttrump'],
        regenerate: false,
      }),
    });
    
    const result = await response.json();
    
    if (result.success && result.explanation) {
      console.log('✅ Explanation found');
      console.log('Has peakSummaries:', !!result.peakSummaries);
      console.log('PeakSummaries count:', result.peakSummaries?.length || 0);
      
      if (result.peakSummaries && result.peakSummaries.length > 0) {
        console.log('\nPeak Summaries in response:');
        result.peakSummaries.forEach((p: any, idx: number) => {
          console.log(`  ${idx + 1}. Date: ${p.date}, Summary: ${p.summary}`);
        });
      }
      
      // Check for peak sections in explanation
      const peakMatches = result.explanation.match(/### PEAK:/g);
      console.log('\nPeak sections in explanation:', peakMatches?.length || 0);
    } else {
      console.log('❌ No explanation found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testBoycottTrumpFlow().catch(console.error);








