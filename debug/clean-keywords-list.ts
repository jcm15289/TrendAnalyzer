#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';

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

async function cleanKeywordsList() {
  console.log('\n🧹 Cleaning keywords list in Redis...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Read current keywords from Redis
    const keywordsDataStr = await redis.get('gui-keywords');
    
    if (!keywordsDataStr) {
      console.log('❌ No keywords found in Redis (gui-keywords key)');
      await redis.quit();
      return;
    }
    
    const keywordsData = JSON.parse(keywordsDataStr);
    console.log('Current keywords data:');
    console.log(`  Total keywords: ${keywordsData.keywords?.length || 0}`);
    console.log(`  Total keyword sets: ${keywordsData.keywordSets?.length || 0}`);
    
    // Filter keywords
    const originalKeywords = keywordsData.keywords || [];
    const filteredKeywords = originalKeywords.filter((k: string) => !shouldDeleteKeyword(k));
    const removedKeywords = originalKeywords.filter((k: string) => shouldDeleteKeyword(k));
    
    console.log(`\n📊 Filtering results:`);
    console.log(`  Original keywords: ${originalKeywords.length}`);
    console.log(`  Removed keywords: ${removedKeywords.length}`);
    console.log(`  Remaining keywords: ${filteredKeywords.length}`);
    
    if (removedKeywords.length > 0) {
      console.log(`\n🗑️  Removed keywords:`);
      removedKeywords.slice(0, 20).forEach((k: string) => console.log(`  - ${k}`));
      if (removedKeywords.length > 20) {
        console.log(`  ... and ${removedKeywords.length - 20} more`);
      }
    }
    
    // Filter keyword sets (remove sets that contain keywords to delete)
    const originalKeywordSets = keywordsData.keywordSets || [];
    const filteredKeywordSets = originalKeywordSets.filter((set: string[]) => {
      // Keep the set if none of its keywords should be deleted
      return !set.some((k: string) => shouldDeleteKeyword(k));
    });
    const removedKeywordSets = originalKeywordSets.filter((set: string[]) => {
      // Remove the set if any of its keywords should be deleted
      return set.some((k: string) => shouldDeleteKeyword(k));
    });
    
    console.log(`\n📊 Keyword sets filtering:`);
    console.log(`  Original sets: ${originalKeywordSets.length}`);
    console.log(`  Removed sets: ${removedKeywordSets.length}`);
    console.log(`  Remaining sets: ${filteredKeywordSets.length}`);
    
    if (removedKeywordSets.length > 0) {
      console.log(`\n🗑️  Removed keyword sets:`);
      removedKeywordSets.slice(0, 10).forEach((set: string[]) => {
        console.log(`  - [${set.join(', ')}]`);
      });
      if (removedKeywordSets.length > 10) {
        console.log(`  ... and ${removedKeywordSets.length - 10} more`);
      }
    }
    
    // Update keywords data
    const updatedKeywordsData = {
      ...keywordsData,
      keywords: filteredKeywords,
      keywordSets: filteredKeywordSets,
      lastUpdated: new Date().toISOString(),
      cleanedAt: new Date().toISOString(),
      removedCount: removedKeywords.length,
      removedSetsCount: removedKeywordSets.length,
    };
    
    // Write back to Redis
    await redis.set('gui-keywords', JSON.stringify(updatedKeywordsData));
    
    console.log(`\n✅ Updated keywords list in Redis`);
    console.log(`  Remaining keywords: ${filteredKeywords.length}`);
    console.log(`  Remaining keyword sets: ${filteredKeywordSets.length}`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanKeywordsList().catch(console.error);








