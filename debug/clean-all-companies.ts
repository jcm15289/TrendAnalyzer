#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';

// Comprehensive list of company names (case-insensitive matching)
const COMPANY_NAMES = [
  // A
  '2u', 'asml', 'adobe', 'affirm', 'airbnb', 'akumin', 'alibaba', 'alteryx', 
  'amd', 'apple', 'applovin', 'asana', 'atlassian',
  // B
  'beyondmeat', 'bigbear', 'box', 'broadcom', 'broadridge', 'bullish', 'bumble',
  // C
  'c3.ai', 'caci', 'carvana', 'chargepoint', 'checkpoint', 'chegg', 'chewy', 
  'circle', 'citrix', 'cloudflare', 'coinbase', 'confluent', 'coreweave', 
  'corelogic', 'couchbase', 'coupa', 'coursera', 'crowdstrike', 'cyberark',
  // D
  'datadog', 'digitalocean', 'disney', 'docusign', 'doordash', 'doximity', 'dropbox', 
  'duolingo',
  // E
  'ebay', 'elastic', 'endava', 'etsy', 'everquote', 'everbridge', 'expensify',
  // F
  'f5', 'facebook', 'factset', 'fastly', 'firstsolar', 'five9', 'fivebelow', 
  'fortinet', 'freshpet', 'freshworks', 'fubo', 'fubotv',
  // G
  'gitlab', 'google', 'groupon', 'guideware',
  // H
  'hubspot',
  // I
  'illumina', 'intapp', 'invisalign', 'irobot',
  // J
  'jfrog', 'jumia',
  // L
  'lendingtree', 'legalzoom', 'lifelock', 'liveperson', 'logitech', 'lululemon', 'lyft',
  // M
  'marqeta', 'marvell', 'mercadolibre', 'microsoft', 'mobileye', 'mongodb', 'monday.com',
  // N
  'nelnet', 'netflix', 'nikola', 'nvidia',
  // O
  'okta', 'oracle', 'organigram',
  // P
  'palantir', 'paloalto', 'paypal', 'paycom', 'paylocity', 'peloton', 'pentair', 
  'petco', 'pinterest', 'polestar', 'proofpoint',
  // Q
  'qualys',
  // R
  'rackspace', 'radware', 'rapid7', 'reddit', 'redfin', 'ringcentral', 'rivian', 
  'robinhood', 'roblox', 'roku',
  // S
  'sailpoint', 'salesforce', 'samsara', 'sentinelone', 'servicenow', 'shopify', 
  'slack', 'smartsheet', 'snapchat', 'solarwinds', 'soundhound', 'spotify', 
  'splunk', 'stride', 'supermicro', 'sumologic', 'symbiotic',
  // T
  'tsmc', 'teladoc', 'tenable', 'tesla', 'toast', 'tucows', 'twilio',
  // U
  'uber', 'udemy', 'uipath', 'unity', 'upstart',
  // V
  'varonis', 'veeva', 'verisign', 'vertiv', 'vroom',
  // W
  'wayfair', 'workday', 'wix',
  // Y
  'yelp',
  // Z
  'zoominfo', 'zoom', 'zscaler', 'zuora'
];

function shouldDeleteKeyword(keyword: string): boolean {
  const trimmed = keyword.trim();
  
  // Delete keywords starting with "/" (Google Trends topic IDs)
  if (trimmed.startsWith('/')) {
    return true;
  }
  
  const lower = trimmed.toLowerCase();
  
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

async function cleanAllCompanies() {
  console.log('\n🧹 Cleaning ALL company keywords from Redis...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Step 1: Clean keywords list
    console.log('Step 1: Cleaning keywords list...');
    const keywordsDataStr = await redis.get('gui-keywords');
    
    if (keywordsDataStr) {
      const keywordsData = JSON.parse(keywordsDataStr);
      const originalKeywords = keywordsData.keywords || [];
      const filteredKeywords = originalKeywords.filter((k: string) => !shouldDeleteKeyword(k));
      const removedKeywords = originalKeywords.filter((k: string) => shouldDeleteKeyword(k));
      
      const originalKeywordSets = keywordsData.keywordSets || [];
      const filteredKeywordSets = originalKeywordSets.filter((set: string[]) => {
        return !set.some((k: string) => shouldDeleteKeyword(k));
      });
      const removedKeywordSets = originalKeywordSets.filter((set: string[]) => {
        return set.some((k: string) => shouldDeleteKeyword(k));
      });
      
      const updatedKeywordsData = {
        ...keywordsData,
        keywords: filteredKeywords,
        keywordSets: filteredKeywordSets,
        lastUpdated: new Date().toISOString(),
        cleanedAt: new Date().toISOString(),
        removedCount: removedKeywords.length,
        removedSetsCount: removedKeywordSets.length,
      };
      
      await redis.set('gui-keywords', JSON.stringify(updatedKeywordsData));
      
      console.log(`  ✅ Removed ${removedKeywords.length} keywords`);
      console.log(`  ✅ Removed ${removedKeywordSets.length} keyword sets`);
      console.log(`  ✅ Remaining: ${filteredKeywords.length} keywords`);
    }
    
    // Step 2: Delete explain-trend keys for companies
    console.log('\nStep 2: Deleting explain-trend keys for companies...');
    const explainKeys = await redis.keys('explain-trend:*');
    const keysToDelete: string[] = [];
    
    for (const key of explainKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          const keywords = data.keywords || [];
          
          if (keywords.some((k: string) => shouldDeleteKeyword(k))) {
            keysToDelete.push(key);
          }
        }
      } catch (error) {
        // Skip errors
      }
    }
    
    console.log(`  Found ${keysToDelete.length} explain-trend keys to delete`);
    
    let deletedCount = 0;
    for (const key of keysToDelete) {
      try {
        const result = await redis.del(key);
        if (result > 0) deletedCount++;
      } catch (error) {
        // Skip errors
      }
    }
    
    console.log(`  ✅ Deleted ${deletedCount} explain-trend keys`);
    
    // Step 3: Delete peak-summaries keys for companies
    console.log('\nStep 3: Deleting peak-summaries keys for companies...');
    const peakKeys = await redis.keys('peak-summaries:*');
    const peakKeysToDelete: string[] = [];
    
    for (const key of peakKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const peakSummaries = JSON.parse(cached);
          if (peakSummaries.length > 0) {
            const keyword = peakSummaries[0]?.keyword || '';
            if (shouldDeleteKeyword(keyword)) {
              peakKeysToDelete.push(key);
            }
          }
        }
      } catch (error) {
        // Skip errors
      }
    }
    
    console.log(`  Found ${peakKeysToDelete.length} peak-summaries keys to delete`);
    
    let peakDeletedCount = 0;
    for (const key of peakKeysToDelete) {
      try {
        const result = await redis.del(key);
        if (result > 0) peakDeletedCount++;
      } catch (error) {
        // Skip errors
      }
    }
    
    console.log(`  ✅ Deleted ${peakDeletedCount} peak-summaries keys`);
    
    console.log('\n✅ Cleanup complete!');
    console.log(`\n📊 Summary:`);
    console.log(`  Company keywords removed from list`);
    console.log(`  ${deletedCount} explain-trend keys deleted`);
    console.log(`  ${peakDeletedCount} peak-summaries keys deleted`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanAllCompanies().catch(console.error);

