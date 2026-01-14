#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';

// Comprehensive list of company names
const COMPANY_NAMES = [
  '2u', 'asml', 'adobe', 'affirm', 'airbnb', 'akumin', 'alibaba', 'alteryx', 
  'amd', 'apple', 'applovin', 'asana', 'atlassian',
  'beyondmeat', 'bigbear', 'box', 'broadcom', 'broadridge', 'bullish', 'bumble',
  'c3.ai', 'caci', 'carvana', 'chargepoint', 'checkpoint', 'chegg', 'chewy', 
  'circle', 'citrix', 'cloudflare', 'coinbase', 'confluent', 'coreweave', 
  'corelogic', 'couchbase', 'coupa', 'coursera', 'crowdstrike', 'cyberark',
  'datadog', 'digitalocean', 'disney', 'docusign', 'doordash', 'doximity', 'dropbox', 
  'duolingo',
  'ebay', 'elastic', 'endava', 'etsy', 'everquote', 'everbridge', 'expensify',
  'f5', 'facebook', 'factset', 'fastly', 'firstsolar', 'five9', 'fivebelow', 
  'fortinet', 'freshpet', 'freshworks', 'fubo', 'fubotv',
  'gitlab', 'google', 'groupon', 'guideware',
  'hubspot',
  'illumina', 'intapp', 'invisalign', 'irobot',
  'jfrog', 'jumia',
  'lendingtree', 'legalzoom', 'lifelock', 'liveperson', 'logitech', 'lululemon', 'lyft',
  'marqeta', 'marvell', 'mercadolibre', 'microsoft', 'mobileye', 'mongodb', 'monday.com',
  'nelnet', 'netflix', 'nikola', 'nvidia',
  'okta', 'oracle', 'organigram',
  'palantir', 'paloalto', 'paypal', 'paycom', 'paylocity', 'peloton', 'pentair', 
  'petco', 'pinterest', 'polestar', 'proofpoint',
  'qualys',
  'rackspace', 'radware', 'rapid7', 'reddit', 'redfin', 'ringcentral', 'rivian', 
  'robinhood', 'roblox', 'roku',
  'sailpoint', 'salesforce', 'samsara', 'sentinelone', 'servicenow', 'shopify', 
  'slack', 'smartsheet', 'snapchat', 'solarwinds', 'soundhound', 'spotify', 
  'splunk', 'stride', 'supermicro', 'sumologic', 'symbiotic',
  'tsmc', 'teladoc', 'tenable', 'tesla', 'toast', 'tucows', 'twilio',
  'uber', 'udemy', 'uipath', 'unity', 'upstart',
  'varonis', 'veeva', 'verisign', 'vertiv', 'vroom',
  'wayfair', 'workday', 'wix',
  'yelp',
  'zoominfo', 'zoom', 'zscaler'
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

async function forceDeleteAllMatching() {
  console.log('\n🗑️  Force deleting all matching keywords from Redis...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Step 1: Read current keywords
    const keywordsDataStr = await redis.get('gui-keywords');
    
    if (!keywordsDataStr) {
      console.log('❌ No keywords found in Redis');
      await redis.quit();
      return;
    }
    
    const keywordsData = JSON.parse(keywordsDataStr);
    const originalKeywords = keywordsData.keywords || [];
    const originalKeywordSets = keywordsData.keywordSets || [];
    
    console.log(`Current state:`);
    console.log(`  Keywords: ${originalKeywords.length}`);
    console.log(`  Keyword sets: ${originalKeywordSets.length}`);
    
    // Step 2: Filter out matching keywords
    const filteredKeywords = originalKeywords.filter((k: string) => !shouldDeleteKeyword(k));
    const filteredKeywordSets = originalKeywordSets.filter((set: string[]) => {
      return !set.some((k: string) => shouldDeleteKeyword(k));
    });
    
    const removedKeywords = originalKeywords.filter((k: string) => shouldDeleteKeyword(k));
    const removedKeywordSets = originalKeywordSets.filter((set: string[]) => {
      return set.some((k: string) => shouldDeleteKeyword(k));
    });
    
    console.log(`\nFiltering results:`);
    console.log(`  Keywords to remove: ${removedKeywords.length}`);
    console.log(`  Keyword sets to remove: ${removedKeywordSets.length}`);
    console.log(`  Remaining keywords: ${filteredKeywords.length}`);
    console.log(`  Remaining keyword sets: ${filteredKeywordSets.length}`);
    
    if (removedKeywords.length === 0) {
      console.log('\n✅ No keywords to delete - already clean!');
      await redis.quit();
      return;
    }
    
    // Step 3: Update Redis with filtered data
    const updatedKeywordsData = {
      ...keywordsData,
      keywords: filteredKeywords,
      keywordSets: filteredKeywordSets,
      lastUpdated: new Date().toISOString(),
      cleanedAt: new Date().toISOString(),
      removedCount: removedKeywords.length,
      removedSetsCount: removedKeywordSets.length,
      source: 'cleanup_script',
    };
    
    await redis.set('gui-keywords', JSON.stringify(updatedKeywordsData));
    
    // Step 4: Verify it was saved
    const verifyStr = await redis.get('gui-keywords');
    const verifyData = JSON.parse(verifyStr!);
    
    console.log(`\n✅ Updated keywords list in Redis`);
    console.log(`  Verified keywords: ${verifyData.keywords?.length || 0}`);
    console.log(`  Verified keyword sets: ${verifyData.keywordSets?.length || 0}`);
    
    // Step 5: Delete explain-trend keys
    console.log(`\nDeleting explain-trend keys...`);
    const explainKeys = await redis.keys('explain-trend:*');
    let explainDeleted = 0;
    
    for (const key of explainKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          const keywords = data.keywords || [];
          if (keywords.some((k: string) => shouldDeleteKeyword(k))) {
            await redis.del(key);
            explainDeleted++;
          }
        }
      } catch (error) {
        // Skip errors
      }
    }
    
    console.log(`  ✅ Deleted ${explainDeleted} explain-trend keys`);
    
    // Step 6: Delete peak-summaries keys
    console.log(`\nDeleting peak-summaries keys...`);
    const peakKeys = await redis.keys('peak-summaries:*');
    let peakDeleted = 0;
    
    for (const key of peakKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const peakSummaries = JSON.parse(cached);
          if (peakSummaries.length > 0) {
            const keyword = peakSummaries[0]?.keyword || '';
            if (shouldDeleteKeyword(keyword)) {
              await redis.del(key);
              peakDeleted++;
            }
          }
        }
      } catch (error) {
        // Skip errors
      }
    }
    
    console.log(`  ✅ Deleted ${peakDeleted} peak-summaries keys`);
    
    console.log(`\n✅ Force deletion complete!`);
    console.log(`\n📊 Final summary:`);
    console.log(`  Keywords removed: ${removedKeywords.length}`);
    console.log(`  Keyword sets removed: ${removedKeywordSets.length}`);
    console.log(`  Remaining keywords: ${filteredKeywords.length}`);
    console.log(`  Remaining keyword sets: ${filteredKeywordSets.length}`);
    console.log(`  explain-trend keys deleted: ${explainDeleted}`);
    console.log(`  peak-summaries keys deleted: ${peakDeleted}`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

forceDeleteAllMatching().catch(console.error);

