#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';
import fs from 'fs';
import crypto from 'crypto';

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

async function listAllDeletedKeys() {
  console.log('\n📋 Listing all deleted keys...\n');
  
  const deletedKeys: {
    keywords: string[];
    explainTrendKeys: string[];
    peakSummariesKeys: string[];
  } = {
    keywords: [],
    explainTrendKeys: [],
    peakSummariesKeys: [],
  };
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Get all current keys to see what was deleted
    const explainKeys = await redis.keys('explain-trend:*');
    const peakKeys = await redis.keys('peak-summaries:*');
    
    console.log(`Found ${explainKeys.length} explain-trend keys`);
    console.log(`Found ${peakKeys.length} peak-summaries keys`);
    
    // Check explain-trend keys for deleted keywords
    console.log('\nChecking explain-trend keys...');
    for (const key of explainKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          const keywords = data.keywords || [];
          
          if (keywords.some((k: string) => shouldDeleteKeyword(k))) {
            deletedKeys.explainTrendKeys.push(key);
            keywords.forEach((k: string) => {
              if (shouldDeleteKeyword(k) && !deletedKeys.keywords.includes(k)) {
                deletedKeys.keywords.push(k);
              }
            });
          }
        }
      } catch (error) {
        // Skip errors
      }
    }
    
    // Check peak-summaries keys
    console.log('Checking peak-summaries keys...');
    for (const key of peakKeys) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          const peakSummaries = JSON.parse(cached);
          if (peakSummaries.length > 0) {
            const keyword = peakSummaries[0]?.keyword || '';
            if (shouldDeleteKeyword(keyword)) {
              deletedKeys.peakSummariesKeys.push(key);
              if (!deletedKeys.keywords.includes(keyword)) {
                deletedKeys.keywords.push(keyword);
              }
            }
          }
        }
      } catch (error) {
        // Skip errors
      }
    }
    
    // Read current keywords list to see what was removed
    const keywordsDataStr = await redis.get('gui-keywords');
    if (keywordsDataStr) {
      // We can't know what was deleted from the list, but we can infer from the keys
      console.log('Note: Keywords list deletions are inferred from deleted keys');
    }
    
    // Sort keywords
    deletedKeys.keywords.sort();
    deletedKeys.explainTrendKeys.sort();
    deletedKeys.peakSummariesKeys.sort();
    
    // Create report
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalKeywordsDeleted: deletedKeys.keywords.length,
        totalExplainTrendKeysDeleted: deletedKeys.explainTrendKeys.length,
        totalPeakSummariesKeysDeleted: deletedKeys.peakSummariesKeys.length,
      },
      deletedKeywords: deletedKeys.keywords,
      deletedExplainTrendKeys: deletedKeys.explainTrendKeys,
      deletedPeakSummariesKeys: deletedKeys.peakSummariesKeys,
    };
    
    // Save to file
    const reportPath = 'debug/deleted-keys-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also create a human-readable text file
    const textReport = [
      'DELETED KEYS REPORT',
      '==================',
      `Generated: ${new Date().toISOString()}`,
      '',
      'SUMMARY',
      '-------',
      `Total Keywords Deleted: ${deletedKeys.keywords.length}`,
      `Total explain-trend Keys Deleted: ${deletedKeys.explainTrendKeys.length}`,
      `Total peak-summaries Keys Deleted: ${deletedKeys.peakSummariesKeys.length}`,
      '',
      'DELETED KEYWORDS',
      '----------------',
      ...deletedKeys.keywords.map((k, i) => `${i + 1}. ${k}`),
      '',
      'DELETED EXPLAIN-TREND KEYS',
      '--------------------------',
      ...deletedKeys.explainTrendKeys.map((k, i) => `${i + 1}. ${k}`),
      '',
      'DELETED PEAK-SUMMARIES KEYS',
      '---------------------------',
      ...deletedKeys.peakSummariesKeys.map((k, i) => `${i + 1}. ${k}`),
    ].join('\n');
    
    const textReportPath = 'debug/deleted-keys-report.txt';
    fs.writeFileSync(textReportPath, textReport);
    
    console.log('\n✅ Report generated:');
    console.log(`  JSON: ${reportPath}`);
    console.log(`  Text: ${textReportPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`  Keywords: ${deletedKeys.keywords.length}`);
    console.log(`  explain-trend keys: ${deletedKeys.explainTrendKeys.length}`);
    console.log(`  peak-summaries keys: ${deletedKeys.peakSummariesKeys.length}`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAllDeletedKeys().catch(console.error);








