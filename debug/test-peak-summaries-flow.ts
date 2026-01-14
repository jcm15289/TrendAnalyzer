#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';
import crypto from 'crypto';

function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0).sort();
}

function generatePeakSummariesKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  const key = `peak-summaries:${hash}`;
  return key;
}

async function testPeakSummariesFlow() {
  console.log('\n🧪 Testing peak summaries flow...\n');
  
  const testKeywords = ['Mamdani', 'Sliwa', 'Chromium', 'Monitor'];
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    console.log('1. Checking for existing peak summaries:\n');
    for (const keyword of testKeywords) {
      const key = generatePeakSummariesKey([keyword]);
      const cached = await redis.get(key);
      
      if (cached) {
        const peakSummaries = JSON.parse(cached);
        console.log(`✅ ${keyword}: Found ${peakSummaries.length} peak summaries`);
        if (peakSummaries.length > 0) {
          console.log(`   First peak:`, {
            date: peakSummaries[0].date,
            summary: peakSummaries[0].summary?.substring(0, 80) + '...',
          });
        }
      } else {
        console.log(`❌ ${keyword}: No peak summaries found`);
        console.log(`   Key: ${key}`);
      }
    }
    
    console.log('\n2. Checking explain-trend cache for these keywords:\n');
    for (const keyword of testKeywords) {
      const normalized = normalizeKeywords([keyword]);
      const sortedKeywords = normalized.join('|');
      const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
      const explainKey = `explain-trend:${hash}`;
      
      const cached = await redis.get(explainKey);
      if (cached) {
        const explainData = JSON.parse(cached);
        console.log(`✅ ${keyword}: Found explanation`);
        console.log(`   Has explanation: ${!!explainData.explanation}`);
        console.log(`   Explanation length: ${explainData.explanation?.length || 0}`);
        
        // Check if explanation contains peak sections
        const peakMatches = (explainData.explanation || '').match(/### PEAK:/g);
        console.log(`   Peak sections found: ${peakMatches?.length || 0}`);
      } else {
        console.log(`❌ ${keyword}: No explanation found`);
        console.log(`   Key: ${explainKey}`);
      }
    }
    
    console.log('\n3. Testing API endpoint:\n');
    for (const keyword of testKeywords) {
      try {
        const response = await fetch(`http://localhost:9002/api/peak-summaries?keywords=${encodeURIComponent(keyword)}`);
        const result = await response.json();
        
        if (result.success && result.peakSummaries && result.peakSummaries.length > 0) {
          console.log(`✅ ${keyword}: API returned ${result.peakSummaries.length} peak summaries`);
        } else {
          console.log(`❌ ${keyword}: API returned empty (${result.message || 'no message'})`);
        }
      } catch (error) {
        console.log(`❌ ${keyword}: API error:`, error instanceof Error ? error.message : 'Unknown');
      }
    }
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testPeakSummariesFlow().catch(console.error);








