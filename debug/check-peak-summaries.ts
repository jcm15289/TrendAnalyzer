#!/usr/bin/env tsx

/**
 * Check peak summaries in Redis for a keyword
 * Usage: tsx debug/check-peak-summaries.ts <keyword>
 */

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

async function checkPeakSummaries(keyword: string) {
  console.log(`\n🔍 Checking peak summaries for: "${keyword}"\n`);
  
  const keywords = [keyword];
  const key = generatePeakSummariesKey(keywords);
  
  console.log('Generated cache key:', key);
  console.log('Normalized keywords:', normalizeKeywords(keywords));
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    const cached = await redis.get(key);
    
    if (!cached) {
      console.log('❌ No peak summaries found in Redis');
      console.log('Key:', key);
      
      // Check if there are any peak-summaries keys
      const allKeys = await redis.keys('peak-summaries:*');
      console.log(`\nFound ${allKeys.length} peak-summaries keys in Redis:`);
      allKeys.slice(0, 10).forEach(k => console.log('  -', k));
      if (allKeys.length > 10) {
        console.log(`  ... and ${allKeys.length - 10} more`);
      }
      
      process.exit(1);
    }
    
    const peakSummaries = JSON.parse(cached);
    console.log(`✅ Found ${peakSummaries.length} peak summaries:\n`);
    
    peakSummaries.forEach((peak: any, idx: number) => {
      console.log(`Peak ${idx + 1}:`);
      console.log(`  Date: ${peak.date}`);
      console.log(`  Keyword: ${peak.keyword}`);
      console.log(`  Value: ${peak.value}`);
      console.log(`  Summary: ${peak.summary?.substring(0, 100)}${peak.summary?.length > 100 ? '...' : ''}`);
      console.log('');
    });
    
    // Check TTL
    const ttl = await redis.ttl(key);
    if (ttl > 0) {
      const days = Math.floor(ttl / (24 * 60 * 60));
      const hours = Math.floor((ttl % (24 * 60 * 60)) / (60 * 60));
      console.log(`TTL: ${ttl} seconds (${days}d ${hours}h)`);
    } else {
      console.log('TTL: expired or no expiration');
    }
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

const keyword = process.argv[2];
if (!keyword) {
  console.error('Usage: tsx debug/check-peak-summaries.ts <keyword>');
  process.exit(1);
}

checkPeakSummaries(keyword).catch(console.error);








