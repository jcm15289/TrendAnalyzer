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

async function verifyAllAnnotations() {
  console.log('\n🔍 Verifying all annotations in Redis and testing API...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    const allKeys = await redis.keys('peak-summaries:*');
    console.log(`Found ${allKeys.length} peak-summaries keys in Redis\n`);
    
    const results: Array<{ key: string; keyword: string; count: number; dates: string[]; summaries: string[] }> = [];
    
    for (const key of allKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const peakSummaries = JSON.parse(cached);
          if (peakSummaries.length > 0) {
            const keyword = peakSummaries[0]?.keyword || 'unknown';
            const dates = peakSummaries.map((p: any) => p.date);
            const summaries = peakSummaries.map((p: any) => p.summary?.substring(0, 50) || 'no summary');
            results.push({
              key,
              keyword,
              count: peakSummaries.length,
              dates,
              summaries,
            });
          }
        }
      } catch (error) {
        console.error(`Error reading key ${key}:`, error);
      }
    }
    
    console.log('Testing API endpoints for each keyword:\n');
    console.log('Keyword'.padEnd(30), 'Redis Count'.padEnd(12), 'API Count'.padEnd(10), 'Match');
    console.log('-'.repeat(80));
    
    for (const { keyword, count, dates } of results) {
      try {
        const response = await fetch(`http://localhost:9002/api/peak-summaries?keywords=${encodeURIComponent(keyword)}`);
        const result = await response.json();
        
        const apiCount = result.peakSummaries?.length || 0;
        const match = count === apiCount ? '✅' : '❌';
        
        console.log(
          keyword.padEnd(30),
          String(count).padEnd(12),
          String(apiCount).padEnd(10),
          match
        );
        
        if (count !== apiCount) {
          console.log(`  ⚠️  Mismatch! Redis has ${count}, API returned ${apiCount}`);
          console.log(`  Redis dates: ${dates.join(', ')}`);
          if (result.peakSummaries && result.peakSummaries.length > 0) {
            const apiDates = result.peakSummaries.map((p: any) => p.date);
            console.log(`  API dates: ${apiDates.join(', ')}`);
          }
        }
      } catch (error) {
        console.log(keyword.padEnd(30), String(count).padEnd(12), 'ERROR'.padEnd(10), '❌');
      }
    }
    
    console.log(`\n✅ Total: ${results.length} keywords with annotations`);
    console.log(`   ${results.reduce((sum, r) => sum + r.count, 0)} total annotations in Redis`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

verifyAllAnnotations().catch(console.error);








