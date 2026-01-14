#!/usr/bin/env tsx

import { getRedisClient } from '../src/lib/redis';
import { detectPeaks, extractPeakExplanation, Peak } from '../src/lib/peak-detection';
import crypto from 'crypto';

function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 0);
}

function generateCacheKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.sort().join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  return `explain-trend:${hash}`;
}

function generatePeakSummariesKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  return `peak-summaries:${hash}`;
}

async function regenerateAllPeakAnnotations() {
  console.log('\n🔄 Regenerating peak annotations for all keywords...\n');
  
  try {
    const redis = await getRedisClient();
    if (!redis) {
      console.error('❌ Redis client not available');
      process.exit(1);
    }
    
    // Get all keywords from Redis
    const keywordsData = await redis.get('gui-keywords');
    if (!keywordsData) {
      console.error('❌ No keywords found in Redis');
      process.exit(1);
    }
    
    const parsedData = JSON.parse(keywordsData);
    const keywordSets: string[][] = parsedData.keywordSets || [];
    
    // Filter to single-keyword sets only (peak annotations only work for single keywords)
    const singleKeywords = keywordSets
      .filter(ks => ks.length === 1)
      .map(ks => ks[0]);
    
    console.log(`Found ${singleKeywords.length} single keywords to process\n`);
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    
    for (const keyword of singleKeywords) {
      try {
        processed++;
        console.log(`[${processed}/${singleKeywords.length}] Processing: ${keyword}`);
        
        // Fetch trend data from Redis
        // Normalize keyword: remove spaces, lowercase
        const keywordNoSpaces = keyword.replace(/\s+/g, '');
        const variations = [
          keyword, // original
          keyword.toLowerCase(),
          keyword.toUpperCase(),
          keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase(),
          keywordNoSpaces, // no spaces
          keywordNoSpaces.toLowerCase(),
          keywordNoSpaces.toUpperCase(),
          keywordNoSpaces.charAt(0).toUpperCase() + keywordNoSpaces.slice(1).toLowerCase(),
        ];
        
        let redisData: string | null = null;
        let foundKey: string | null = null;
        
        for (const variation of variations) {
          const cacheKey = `cache-trends:Trends.${variation}`;
          redisData = await redis.get(cacheKey);
          if (redisData) {
            foundKey = cacheKey;
            break;
          }
        }
        
        if (!redisData || !foundKey) {
          console.log(`  ⚠️  No trend data found, skipping`);
          skipped++;
          continue;
        }
        
        // Parse trend data
        let parsedData: any = null;
        const trimmed = redisData.trim();
        
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            parsedData = JSON.parse(redisData);
          } catch (error) {
            console.log(`  ⚠️  Failed to parse JSON, skipping`);
            skipped++;
            continue;
          }
        }
        
        // Extract CSV data
        let rawContent = typeof parsedData?.content === 'string' ? parsedData.content : redisData;
        
        if (typeof parsedData?.content === 'string') {
          const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(parsedData.content);
          if (looksBase64) {
            try {
              rawContent = Buffer.from(parsedData.content.replace(/\s/g, ''), 'base64').toString('utf-8');
            } catch (error) {
              rawContent = parsedData.content;
            }
          }
        }
        
        // Parse CSV to get chart data
        let chartData: Array<{ date: string; [key: string]: number }> = [];
        
        if (parsedData?.content) {
          const csvContent = rawContent;
          const lines = csvContent.trim().split('\n');
          
          chartData = lines.slice(2).map(line => {
            const values = line.split(/\s+/).filter(v => v.trim());
            const row: any = {};
            
            if (values[0]) {
              row.date = values[0];
            }
            
            if (values[1]) {
              row[keyword] = parseInt(values[1]) || 0;
            }
            
            return row;
          }).filter(row => row.date && row[keyword] !== undefined);
        } else {
          // Try to extract from old format
          if (Array.isArray(parsedData?.data)) {
            chartData = parsedData.data;
          } else if (Array.isArray(parsedData)) {
            chartData = parsedData;
          }
        }
        
        if (chartData.length === 0) {
          console.log(`  ⚠️  No chart data extracted, skipping`);
          skipped++;
          continue;
        }
        
        // Detect all peaks
        const peaks = detectPeaks(chartData, keyword, 15, 3);
        console.log(`  📊 Detected ${peaks.length} peaks`);
        
        if (peaks.length === 0) {
          console.log(`  ℹ️  No peaks detected, skipping`);
          skipped++;
          continue;
        }
        
        // Get existing explanation from Redis using the same cache key generation logic
        const explanationKey = generateCacheKey([keyword]);
        let cachedExplanation: string | null = await redis.get(explanationKey);
        
        if (!cachedExplanation) {
          console.log(`  ⚠️  No explanation found, skipping (need to generate explanation first)`);
          skipped++;
          continue;
        }
        
        let explanation: string;
        try {
          const cached = JSON.parse(cachedExplanation);
          explanation = cached.explanation || cached;
        } catch {
          explanation = cachedExplanation;
        }
        
        if (!explanation || explanation.length < 100) {
          console.log(`  ⚠️  Invalid explanation, skipping`);
          skipped++;
          continue;
        }
        
        // Extract peak summaries for ALL detected peaks
        const peakSummaries: Array<{ date: string; keyword: string; value: number; summary: string }> = [];
        
        for (const peak of peaks) {
          const summary = extractPeakExplanation(explanation, peak.date, 15);
          
          if (!summary || summary.length === 0) {
            console.log(`    ⚠️  No EVENT found for peak ${peak.date}`);
            continue;
          }
          
          const lowerSummary = summary.toLowerCase();
          if (
            lowerSummary.includes('google trends') ||
            lowerSummary.includes('search interest') ||
            lowerSummary.includes('search volume') ||
            lowerSummary.includes('peak') ||
            lowerSummary.includes('keyword') ||
            lowerSummary.includes('analysis') ||
            lowerSummary.includes('here\'s')
          ) {
            console.log(`    ⚠️  Rejected summary for peak ${peak.date}: contains forbidden terms`);
            continue;
          }
          
          peakSummaries.push({
            date: peak.date,
            keyword: keyword,
            value: peak.value,
            summary: summary.trim(),
          });
        }
        
        console.log(`  ✅ Extracted ${peakSummaries.length} peak summaries`);
        
        // Store peak summaries in Redis (no expiration)
        const peakSummariesKey = generatePeakSummariesKey([keyword]);
        await redis.set(peakSummariesKey, JSON.stringify(peakSummaries));
        
        console.log(`  💾 Stored ${peakSummaries.length} annotations for ${keyword}`);
        console.log(`     Dates: ${peakSummaries.map(p => p.date.split('T')[0]).join(', ')}\n`);
        
        updated++;
        
      } catch (error) {
        console.error(`  ❌ Error processing ${keyword}:`, error);
        skipped++;
      }
    }
    
    console.log('\n✅ Regeneration complete!');
    console.log(`   Processed: ${processed}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    
    await redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

regenerateAllPeakAnnotations().catch(console.error);

