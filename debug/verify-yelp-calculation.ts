/**
 * Debug script to verify Yelp login 6m window calculation
 * Fetches data and manually calculates sums for current and previous windows
 */

import { getRedisClient } from '../src/lib/redis';
import { Buffer } from 'buffer';

interface DataPoint {
  date: Date;
  value: number;
}

function parseRedisData(rawData: string, keyword: string): DataPoint[] {
  let content: string = rawData;
  
  // Try to parse as JSON first
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(content);
      content = parsed.content || parsed.data || content;
    } catch {
      // Use as-is
    }
  }

  // Try to decode base64 if needed
  if (typeof content === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(content.trim()) && content.length > 50) {
    try {
      const decoded = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
      if (decoded.includes('\n')) {
        content = decoded;
      }
    } catch {
      // Not base64
    }
  }

  const lines = content.split('\n').filter(line => line.trim());
  const dataPoints: DataPoint[] = [];

  // Skip first 2 lines (header) and parse whitespace-separated values
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    // Skip header lines
    if (line.toLowerCase().includes('date') || line.toLowerCase().includes('week')) continue;

    // Parse whitespace-separated: date value
    const values = line.split(/\s+/).filter(v => v.trim());
    if (values.length >= 2) {
      const dateStr = values[0].trim();
      const value = parseInt(values[1].trim(), 10);

      if (dateStr && !isNaN(value)) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dataPoints.push({ date, value });
        }
      }
    }
  }

  return dataPoints.sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function verifyYelpCalculation() {
  console.log('🔍 Fetching Yelp login data...\n');
  
  const redis = await getRedisClient();
  if (!redis) {
    console.error('❌ Redis connection unavailable');
    return;
  }

  // Try different key variations for Yelp login
  const possibleKeys = [
    'cache-trends:Trends.Yelplogin',
    'cache-trends:Trends.yelplogin',
    'cache-trends:Trends.YelpLogin',
  ];

  let rawData: string | null = null;
  let foundKey: string | null = null;

  for (const key of possibleKeys) {
    try {
      const data = await redis.get(key);
      if (data) {
        rawData = data;
        foundKey = key;
        console.log(`✅ Found data at key: ${key}`);
        break;
      }
    } catch (error) {
      console.log(`⚠️ Error checking key ${key}:`, error);
    }
  }

  if (!rawData) {
    console.error('❌ Could not find Yelp login data in Redis');
    return;
  }

  const parsed = parseRedisData(rawData, 'Yelp login');
  console.log(`\n📊 Parsed ${parsed.length} data points`);
  console.log(`   First date: ${parsed[0]?.date.toISOString().split('T')[0]}`);
  console.log(`   Last date: ${parsed[parsed.length - 1]?.date.toISOString().split('T')[0]}\n`);

  // Calculate 6m window
  const months = 6;
  const days = months * 30;
  const latestEntry = parsed[parsed.length - 1];
  
  const lastWindowStart = new Date(latestEntry.date);
  lastWindowStart.setDate(lastWindowStart.getDate() - days);
  const prevWindowStart = new Date(lastWindowStart);
  prevWindowStart.setDate(prevWindowStart.getDate() - days);

  console.log('📅 Window boundaries:');
  console.log(`   Latest entry: ${latestEntry.date.toISOString().split('T')[0]}`);
  console.log(`   Current window start: ${lastWindowStart.toISOString().split('T')[0]}`);
  console.log(`   Current window end: ${latestEntry.date.toISOString().split('T')[0]}`);
  console.log(`   Previous window start: ${prevWindowStart.toISOString().split('T')[0]}`);
  console.log(`   Previous window end: ${lastWindowStart.toISOString().split('T')[0]}\n`);

  // Filter data points
  const lastWindowPoints: DataPoint[] = [];
  const prevWindowPoints: DataPoint[] = [];

  parsed.forEach(({ date, value }) => {
    if (date >= lastWindowStart) {
      lastWindowPoints.push({ date, value });
    } else if (date >= prevWindowStart) {
      prevWindowPoints.push({ date, value });
    }
  });

  console.log(`📈 Current window (${lastWindowStart.toISOString().split('T')[0]} to ${latestEntry.date.toISOString().split('T')[0]}):`);
  console.log(`   Data points: ${lastWindowPoints.length}`);
  console.log(`   Values: ${lastWindowPoints.map(p => p.value).join(', ')}`);
  console.log(`   Sum: ${lastWindowPoints.reduce((sum, p) => sum + p.value, 0)}`);
  console.log(`   Dates: ${lastWindowPoints.map(p => p.date.toISOString().split('T')[0]).join(', ')}\n`);

  console.log(`📉 Previous window (${prevWindowStart.toISOString().split('T')[0]} to ${lastWindowStart.toISOString().split('T')[0]}):`);
  console.log(`   Data points: ${prevWindowPoints.length}`);
  console.log(`   Values: ${prevWindowPoints.map(p => p.value).join(', ')}`);
  console.log(`   Sum: ${prevWindowPoints.reduce((sum, p) => sum + p.value, 0)}`);
  console.log(`   Dates: ${prevWindowPoints.map(p => p.date.toISOString().split('T')[0]).join(', ')}\n`);

  const lastSum = lastWindowPoints.reduce((sum, p) => sum + p.value, 0);
  const prevSum = prevWindowPoints.reduce((sum, p) => sum + p.value, 0);

  console.log('🧮 Calculation:');
  console.log(`   Current window sum: ${lastSum}`);
  console.log(`   Previous window sum: ${prevSum}`);
  if (prevSum === 0) {
    console.log(`   Growth: ${lastSum > 0 ? '100%' : '0%'} (new activity)`);
  } else {
    const growth = ((lastSum - prevSum) / prevSum) * 100;
    console.log(`   Growth: ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`);
    console.log(`   Formula: ((${lastSum} - ${prevSum}) / ${prevSum}) × 100`);
  }

  // Check for zeros
  const allValues = [...lastWindowPoints.map(p => p.value), ...prevWindowPoints.map(p => p.value)];
  const zeroCount = allValues.filter(v => v === 0).length;
  const zeroPercentage = allValues.length > 0 ? (zeroCount / allValues.length) * 100 : 0;
  console.log(`\n🔍 Zero check:`);
  console.log(`   Total values: ${allValues.length}`);
  console.log(`   Zero values: ${zeroCount}`);
  console.log(`   Zero percentage: ${zeroPercentage.toFixed(1)}%`);
  console.log(`   Is invalid (60%+ zeros): ${zeroPercentage >= 60 ? 'YES' : 'NO'}`);
}

verifyYelpCalculation().catch(console.error);
