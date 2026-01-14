#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';
import crypto from 'crypto';

function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0).sort();
}

function generateCacheKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  return `explain-trend:${hash}`;
}

function generatePeakSummariesKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  return `peak-summaries:${hash}`;
}

// Common company names to filter out
const COMPANY_NAMES = [
  'zuora', 'asml', 'adobe', 'affirm', 'airbnb', 'akumin', 'alibaba', 'alteryx', 
  'amd', 'apple', 'applovin', 'asana', 'atlassian', 'beyondmeat', 'bigbear',
  'box', 'broadcom', 'broadridge', 'bullish', 'bumble', 'c3.ai', 'caci',
  'carvana', 'chargepoint', 'checkpoint', 'chegg', 'chewy', 'circle', 'citrix',
  'cloudflare', 'coinbase', 'confluent', 'coreweave', 'corelogic', 'couchbase',
  'coupa', 'coursera', 'crowdstrike', 'cyberark', 'datadog', 'digitalocean',
  'disney', 'docusign', 'doordash', 'doximity'
];

function shouldDeleteKeyword(keyword: string): boolean {
  const lower = keyword.toLowerCase().trim();
  
  // Check if ends with login or signup
  if (lower.endsWith('login') || lower.endsWith('signup')) {
    return true;
  }
  
  // Check if it's a company name (exact match, case-insensitive)
  if (COMPANY_NAMES.includes(lower)) {
    return true;
  }
  
  // Check if it's a company name with login/signup suffix
  for (const company of COMPANY_NAMES) {
    if (lower === `${company}login` || lower === `${company}signup`) {
      return true;
    }
  }
  
  return false;
}

async function deleteCompanyLoginSignupKeys() {
  console.log('\n🗑️  Finding and deleting company/login/signup keys from Redis...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Get all explain-trend and peak-summaries keys
    const explainKeys = await redis.keys('explain-trend:*');
    const peakKeys = await redis.keys('peak-summaries:*');
    
    console.log(`Found ${explainKeys.length} explain-trend keys`);
    console.log(`Found ${peakKeys.length} peak-summaries keys\n`);
    
    const keysToDelete: string[] = [];
    const keywordsToDelete = new Set<string>();
    
    // Check explain-trend keys
    console.log('Checking explain-trend keys...');
    for (const key of explainKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          const keywords = data.keywords || [];
          
          // Check if any keyword should be deleted
          const shouldDelete = keywords.some((k: string) => shouldDeleteKeyword(k));
          
          if (shouldDelete) {
            keysToDelete.push(key);
            keywords.forEach((k: string) => {
              if (shouldDeleteKeyword(k)) {
                keywordsToDelete.add(k);
              }
            });
            console.log(`  Marked for deletion: ${key} (keywords: ${keywords.join(', ')})`);
          }
        }
      } catch (error) {
        console.error(`Error reading key ${key}:`, error);
      }
    }
    
    // Check peak-summaries keys
    console.log('\nChecking peak-summaries keys...');
    for (const key of peakKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const peakSummaries = JSON.parse(cached);
          if (peakSummaries.length > 0) {
            const keyword = peakSummaries[0]?.keyword || '';
            
            if (shouldDeleteKeyword(keyword)) {
              keysToDelete.push(key);
              keywordsToDelete.add(keyword);
              console.log(`  Marked for deletion: ${key} (keyword: ${keyword})`);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading key ${key}:`, error);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Keys to delete: ${keysToDelete.length}`);
    console.log(`  Unique keywords: ${Array.from(keywordsToDelete).sort().join(', ')}`);
    
    if (keysToDelete.length === 0) {
      console.log('\n✅ No keys found matching the criteria');
      await redis.quit();
      return;
    }
    
    // Delete keys
    console.log(`\n🗑️  Deleting ${keysToDelete.length} keys...`);
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const key of keysToDelete) {
      try {
        const result = await redis.del(key);
        if (result > 0) {
          deletedCount++;
          console.log(`  ✅ Deleted: ${key}`);
        } else {
          console.log(`  ⚠️  Key not found (may have been deleted already): ${key}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ❌ Error deleting ${key}:`, error);
      }
    }
    
    console.log(`\n✅ Deletion complete:`);
    console.log(`  Deleted: ${deletedCount}`);
    console.log(`  Errors: ${errorCount}`);
    console.log(`  Total: ${keysToDelete.length}`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteCompanyLoginSignupKeys().catch(console.error);








