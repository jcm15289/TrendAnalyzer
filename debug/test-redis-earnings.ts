import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../.env.local') });

import { getRedisClient } from '../src/lib/redis';

async function testRedisEarnings() {
  console.log('🔍 ====== TESTING REDIS EARNINGS CALENDAR ======');
  
  try {
    const redis = await getRedisClient();
    
    if (!redis) {
      console.error('❌ Redis client not available');
      return;
    }
    
    console.log('✅ Connected to Redis');
    
    // Get the earnings calendar key
    const redisKey = 'earning-calendar:EarningCalendar';
    console.log(`\n📅 Fetching key: "${redisKey}"`);
    
    const rawContent = await redis.get(redisKey);
    
    if (!rawContent) {
      console.error(`❌ Key "${redisKey}" not found in Redis`);
      
      // List all earning-calendar keys
      console.log('\n📋 Searching for all earning-calendar keys...');
      const allKeys = await redis.keys('earning-calendar:*');
      console.log(`Found ${allKeys.length} keys:`);
      allKeys.forEach(key => console.log(`  - ${key}`));
      return;
    }
    
    console.log(`✅ Found content (${rawContent.length} chars)`);
    
    // Try to parse as JSON
    let textContent = rawContent;
    try {
      const parsed = JSON.parse(rawContent);
      console.log('📦 Content is JSON, keys:', Object.keys(parsed));
      
      if (parsed.content) {
        textContent = parsed.content;
        console.log(`📦 Extracted content field (${textContent.length} chars)`);
        
        // Try base64 decode
        try {
          const decoded = Buffer.from(textContent, 'base64').toString('utf-8');
          if (decoded.includes(',') || decoded.includes('\n')) {
            textContent = decoded;
            console.log(`📦 Decoded base64 content (${textContent.length} chars)`);
          }
        } catch (e) {
          console.log('📦 Content is not base64, using as-is');
        }
      }
    } catch (e) {
      console.log('📦 Content is not JSON, treating as raw text');
    }
    
    // Show first 500 chars
    console.log('\n📄 First 500 characters of content:');
    console.log(textContent.substring(0, 500));
    console.log('...\n');
    
    // Parse dates from content
    const lines = textContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log(`📊 Total lines: ${lines.length}`);
    
    // Look for date patterns
    const datePattern = /\d{4}-\d{2}-\d{2}/g;
    const dates = new Set<string>();
    lines.forEach(line => {
      const matches = line.match(datePattern);
      if (matches) {
        matches.forEach(date => dates.add(date));
      }
    });
    
    console.log(`\n📅 Dates found in content:`, Array.from(dates).sort());
    
    // Show sample lines with dates
    console.log('\n📋 Sample lines with dates:');
    lines.slice(0, 10).forEach((line, i) => {
      if (datePattern.test(line)) {
        console.log(`  ${i + 1}: ${line.substring(0, 100)}`);
      }
    });
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`\n📅 Today: ${today}`);
    console.log(`📅 Tomorrow: ${tomorrow}`);
    console.log(`📅 Has today's date: ${dates.has(today)}`);
    console.log(`📅 Has tomorrow's date: ${dates.has(tomorrow)}`);
    
    await redis.quit();
    console.log('\n✅ Test complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRedisEarnings().catch(console.error);

