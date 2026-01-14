#!/usr/bin/env ts-node
import { createClient } from 'redis';
import crypto from 'crypto';

const keyword = 'Cuomo';

async function checkExplanation() {
  const client = createClient({ url: process.env.KV_URL });
  await client.connect();
  
  // Generate cache key
  const normalized = keyword.trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  const cacheKey = `explain-trend:${hash}`;
  
  console.log('Cache key:', cacheKey);
  
  const cached = await client.get(cacheKey);
  if (!cached) {
    console.log('No cached explanation found');
    await client.quit();
    return;
  }
  
  const data = JSON.parse(cached);
  console.log('\n=== EXPLANATION ===');
  console.log(data.explanation);
  console.log('\n=== SEARCHING FOR DATES ===');
  
  const dates = ['2021-02-28', '2021-08-08', '2021-12-05'];
  dates.forEach(date => {
    console.log(`\n--- Looking for ${date} ---`);
    const lines = data.explanation.split('\n');
    let found = false;
    lines.forEach((line: string, idx: number) => {
      if (line.includes(date) || line.includes(date.substring(0, 7))) {
        console.log(`Line ${idx}: ${line}`);
        if (idx > 0) console.log(`  Prev: ${lines[idx-1]}`);
        if (idx < lines.length - 1) console.log(`  Next: ${lines[idx+1]}`);
        found = true;
      }
    });
    if (!found) {
      console.log('Date not found in explanation');
    }
  });
  
  await client.quit();
}

checkExplanation().catch(console.error);

