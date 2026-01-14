#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';

async function listAllAnnotations() {
  console.log('\n🔍 Listing all peak summaries in Redis...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    const allKeys = await redis.keys('peak-summaries:*');
    console.log(`Found ${allKeys.length} peak-summaries keys:\n`);
    
    const results: Array<{ key: string; keyword: string; count: number; dates: string[] }> = [];
    
    for (const key of allKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const peakSummaries = JSON.parse(cached);
          if (peakSummaries.length > 0) {
            // Try to extract keyword from first peak
            const keyword = peakSummaries[0]?.keyword || 'unknown';
            const dates = peakSummaries.map((p: any) => p.date);
            results.push({
              key,
              keyword,
              count: peakSummaries.length,
              dates,
            });
          }
        }
      } catch (error) {
        console.error(`Error reading key ${key}:`, error);
      }
    }
    
    // Sort by keyword
    results.sort((a, b) => a.keyword.localeCompare(b.keyword));
    
    console.log('Peak Summaries by Keyword:\n');
    console.log('Keyword'.padEnd(30), 'Count'.padEnd(8), 'Dates');
    console.log('-'.repeat(100));
    
    results.forEach(({ keyword, count, dates }) => {
      const datesStr = dates.slice(0, 3).join(', ') + (dates.length > 3 ? '...' : '');
      console.log(keyword.padEnd(30), String(count).padEnd(8), datesStr);
    });
    
    console.log(`\n✅ Total: ${results.length} keywords with annotations, ${results.reduce((sum, r) => sum + r.count, 0)} total annotations`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAllAnnotations().catch(console.error);








