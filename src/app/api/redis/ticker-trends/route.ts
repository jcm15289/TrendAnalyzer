import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';

interface TrendDataPoint {
  date: string;
  [keyword: string]: string | number;
}

function parseRedisData(rawData: string, keyword: string): TrendDataPoint[] {
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

  return parseTrendData(content, keyword);
}

function parseTrendData(content: string, keyword: string): TrendDataPoint[] {
  const lines = content.split('\n').filter(line => line.trim());
  const dataPoints: TrendDataPoint[] = [];

  // Skip first 2 lines (header) and parse whitespace-separated values
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    // Skip header lines
    if (line.toLowerCase().includes('date') || line.toLowerCase().includes('week')) continue;

    // Parse whitespace-separated: date value
    const values = line.split(/\s+/).filter(v => v.trim());
    if (values.length >= 2) {
      const date = values[0].trim();
      const value = parseInt(values[1].trim(), 10);

      if (date && !isNaN(value)) {
        dataPoints.push({
          date,
          [keyword]: value,
        });
      }
    }
  }

  return dataPoints;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trendKeys = searchParams.get('keys');

    if (!trendKeys) {
      return NextResponse.json(
        { success: false, error: 'Missing keys parameter (comma-separated trend keys)' },
        { status: 400 },
      );
    }

    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { success: false, error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }

    const keys = trendKeys.split(',').map(k => k.trim());
    
    // Extract base keyword from the first trend key (e.g., "Trends.Google" -> "Google")
    // This is the base keyword we'll use to find ALL related trends
    const baseTrendKey = keys[0];
    const baseKeyword = baseTrendKey.replace(/^Trends\./, '');
    
    console.log(`[TickerTrends] Processing ${keys.length} trend keys, base keyword: "${baseKeyword}"`);
    
    const results: Array<{
      keyword: string;
      trendKey: string;
      found: boolean;
      dataPointCount: number;
      data: TrendDataPoint[];
      redisKey: string | null;
    }> = [];

    // Strategy: First try direct key fetching, then use keys() to find all related trends
    // This ensures we get at least some data even if keys() fails
    // Updated: 2026-01-15 - Prioritize direct fetching for better reliability
    
    // Step 1: Try direct key fetching for ALL requested keys (not just the first one)
    console.log(`[TickerTrends] Step 1: Trying direct key fetching for ${keys.length} requested keys...`);
    for (const trendKey of keys) {
      const keyword = trendKey.replace(/^Trends\./, '');
      const keywordNoSpaces = keyword.replace(/\s+/g, ''); // Remove spaces to match Redis key format
      
      const possibleKeys = [
        `cache-trends:${trendKey}`, // e.g., cache-trends:Trends.Googlelogin
        `cache-trends:Trends.${keywordNoSpaces}`, // e.g., cache-trends:Trends.Googlelogin (no spaces)
        `cache-trends:Trends.${keywordNoSpaces.toLowerCase()}`, // lowercase
        trendKey,
        `Trends.${keywordNoSpaces}`,
        `Trends.${keywordNoSpaces.toLowerCase()}`,
      ];
      
      let found = false;
      for (const redisKey of possibleKeys) {
        try {
          const rawData = await redis.get(redisKey);
          if (rawData) {
            console.log(`[TickerTrends] ✅ Found direct key: ${redisKey} for "${keyword}"`);
            const parsed = parseRedisData(rawData, keyword); // Use original keyword (with spaces) for display
            if (parsed.length > 0) {
              results.push({
                keyword, // Use original keyword format (with spaces if it had them)
                trendKey,
                found: true,
                dataPointCount: parsed.length,
                data: parsed,
                redisKey,
              });
              found = true;
              break; // Found it, move to next trend key
            }
          }
        } catch (err) {
          // Try next key format
        }
      }
      if (!found) {
        console.log(`[TickerTrends] ❌ Direct fetch failed for "${keyword}" (tried ${possibleKeys.length} variations)`);
      }
    }
    
    console.log(`[TickerTrends] Direct fetch found ${results.length} results`);
    
    // Step 2: Fetch ALL trend keys using the same pattern that works in /api/trends/all
    let allTrendKeys: string[] = [];
    try {
      console.log(`[TickerTrends] Step 2: Fetching all keys with pattern 'cache-trends:Trends.*'...`);
      allTrendKeys = await redis.keys('cache-trends:Trends.*');
      console.log(`[TickerTrends] ✅ Found ${allTrendKeys.length} total keys`);
    } catch (error) {
      console.error(`[TickerTrends] ❌ Error fetching keys:`, error);
    }
    
    // Step 3: If we found keys via pattern matching, filter for related trends
    let matchingKeys: string[] = [];
    if (allTrendKeys.length > 0) {
      const trendKeysWithoutMetadata = allTrendKeys.filter(k => !k.endsWith(':metadata'));
      console.log(`[TickerTrends] Step 3: Filtering ${trendKeysWithoutMetadata.length} keys (excluding metadata)...`);
      
      // Build a set of requested keywords (without "Trends." prefix) for exact matching
      // Remove spaces from requested keywords to match Redis key format (e.g., "Google login" -> "Googlelogin")
      const requestedKeywords = new Set(
        keys.map(k => {
          const keyword = k.replace(/^Trends\./, '');
          // Remove spaces to match Redis key format
          return keyword.replace(/\s+/g, '').toLowerCase();
        })
      );
      
      console.log(`[TickerTrends] Requested keywords (no spaces):`, Array.from(requestedKeywords));
      
      // Also filter keys that start with the base keyword (case-insensitive)
      // This finds related trends like "Googleads", "Googlecloud" when searching for "Google"
      const baseKeywordLower = baseKeyword.replace(/\s+/g, '').toLowerCase();
      
      matchingKeys = trendKeysWithoutMetadata.filter(k => {
        // Remove prefix to get just the keyword part
        const keyPart = k.replace(/^cache-trends:Trends\./, '').replace(/^Trends\./, '');
        const keyPartLower = keyPart.toLowerCase();
        
        // Check if this key matches any requested keyword exactly (case-insensitive, no spaces)
        if (requestedKeywords.has(keyPartLower)) {
          console.log(`[TickerTrends] ✅ Exact match: "${keyPart}" matches requested keyword`);
          return true;
        }
        
        // Also check if keyword starts with base keyword (e.g., "Googleads" starts with "Google")
        // This finds related trends that weren't explicitly requested
        if (keyPartLower.startsWith(baseKeywordLower)) {
          console.log(`[TickerTrends] ✅ Prefix match: "${keyPart}" starts with "${baseKeyword}"`);
          return true;
        }
        
        return false;
      });
      
      console.log(`[TickerTrends] Filtered ${matchingKeys.length} keys (requested: ${requestedKeywords.size}, base: "${baseKeyword}"):`, matchingKeys.slice(0, 15));
    }
    
    // Process each matching key (avoid duplicates from direct fetch)
    if (matchingKeys.length > 0) {
      const existingRedisKeys = new Set(results.map(r => r.redisKey).filter(Boolean));
      for (const redisKey of matchingKeys) {
        if (existingRedisKeys.has(redisKey)) {
          console.log(`[TickerTrends] Skipping duplicate key: ${redisKey}`);
          continue;
        }
        try {
          const rawData = await redis.get(redisKey);
          if (rawData) {
            // Extract the actual keyword from the Redis key (e.g., "Googleads" from "cache-trends:Trends.Googleads")
            const keyKeyword = redisKey.replace(/^cache-trends:Trends\./, '').replace(/:metadata$/, '');
            const trendKey = `Trends.${keyKeyword}`;
            
            // Try to find the original requested keyword format (with spaces) if it exists
            // This matches "Googleads" -> "Google ads" or "Googlelogin" -> "Google login"
            let displayKeyword = keyKeyword;
            for (const requestedKey of keys) {
              const requestedKeyword = requestedKey.replace(/^Trends\./, '');
              // Check if the requested keyword (without spaces) matches the Redis key keyword
              const requestedKeywordNoSpaces = requestedKeyword.replace(/\s+/g, '').toLowerCase();
              const keyKeywordLower = keyKeyword.toLowerCase();
              if (requestedKeywordNoSpaces === keyKeywordLower) {
                // Use the original requested keyword format (with spaces if it had them)
                displayKeyword = requestedKeyword;
                break;
              }
            }
            
            console.log(`[TickerTrends] Parsing data for key "${redisKey}", keyword: "${keyKeyword}" -> display: "${displayKeyword}"`);
            const parsed = parseRedisData(rawData, displayKeyword);
            console.log(`[TickerTrends] Parsed ${parsed.length} data points for "${displayKeyword}"`);
            
            if (parsed.length > 0) {
              // Add as a result
              results.push({
                keyword: displayKeyword, // Use display keyword (with spaces if original had them)
                trendKey: trendKey,
                found: true,
                dataPointCount: parsed.length,
                data: parsed,
                redisKey: redisKey,
              });
            }
          }
        } catch (error) {
          console.warn(`[TickerTrends] Error fetching ${redisKey}:`, error);
        }
      }
    }
    
    // If no results found, add "not found" entries for the requested keys
    if (results.length === 0) {
      for (const trendKey of keys) {
        const keyword = trendKey.replace(/^Trends\./, '');
        results.push({
          keyword,
          trendKey,
          found: false,
          dataPointCount: 0,
          data: [],
          redisKey: null,
        });
      }
    }

    // Combine all trend data into a unified dataset
    const allDates = new Map<string, TrendDataPoint>();
    
    for (const result of results) {
      if (!result.found) continue;
      
      for (const point of result.data) {
        const existing = allDates.get(point.date) || { date: point.date };
        existing[result.keyword] = point[result.keyword];
        allDates.set(point.date, existing);
      }
    }

    // Sort by date
    const combinedData = Array.from(allDates.values()).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return NextResponse.json({
      success: true,
      totalRequested: keys.length,
      totalFound: results.filter(r => r.found).length,
      results,
      combinedData,
      dataPointCount: combinedData.length,
    });
  } catch (error) {
    console.error('Ticker trends API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ticker trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
