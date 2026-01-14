#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';

async function checkAllPeakSummaries() {
  console.log('\n🔍 Checking all peak summaries in Redis...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Get all peak-summaries keys
    const allKeys = await redis.keys('peak-summaries:*');
    console.log(`Found ${allKeys.length} peak-summaries keys in Redis:\n`);
    
    if (allKeys.length === 0) {
      console.log('❌ No peak summaries found in Redis');
      await redis.quit();
      process.exit(1);
    }
    
    // Check each key
    const results: Array<{ key: string; count: number; sample: any; ttl: number }> = [];
    
    for (const key of allKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const peakSummaries = JSON.parse(cached);
          const ttl = await redis.ttl(key);
          results.push({
            key,
            count: peakSummaries.length,
            sample: peakSummaries.length > 0 ? peakSummaries[0] : null,
            ttl,
          });
        }
      } catch (error) {
        console.error(`Error reading key ${key}:`, error);
      }
    }
    
    // Sort by count (descending)
    results.sort((a, b) => b.count - a.count);
    
    console.log('Peak Summaries Summary:\n');
    console.log('Key'.padEnd(50), 'Count'.padEnd(8), 'TTL'.padEnd(12), 'Sample Date');
    console.log('-'.repeat(100));
    
    results.forEach(({ key, count, sample, ttl }) => {
      const ttlStr = ttl > 0 ? `${Math.floor(ttl / 86400)}d` : 'expired';
      const sampleDate = sample?.date || 'N/A';
      console.log(key.padEnd(50), String(count).padEnd(8), ttlStr.padEnd(12), sampleDate);
    });
    
    console.log(`\n✅ Total: ${results.length} keys, ${results.reduce((sum, r) => sum + r.count, 0)} peak summaries`);
    
    // Show details for first 5
    console.log('\n📋 Details for first 5 keys:\n');
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const { key, count, sample } = results[i];
      const cached = await redis.get(key);
      if (cached) {
        const peakSummaries = JSON.parse(cached);
        console.log(`\n${i + 1}. Key: ${key}`);
        console.log(`   Count: ${count}`);
        console.log(`   First peak:`, peakSummaries[0]);
        if (count > 1) {
          console.log(`   Second peak:`, peakSummaries[1]);
        }
      }
    }
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAllPeakSummaries().catch(console.error);








