import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🚦 All Trends API: Fetching trends from Redis...');
    const redis = await getRedisClient();

    if (!redis) {
      console.error('🚦 All Trends API: Redis connection unavailable');
      return NextResponse.json(
        {
          success: false,
          error: 'Redis connection unavailable',
        },
        { status: 503 },
      );
    }

    // Get all keys matching cache-trends:Trends.*
    console.log('🚦 All Trends API: Querying Redis for keys matching "cache-trends:Trends.*"...');
    const keys = await redis.keys('cache-trends:Trends.*');
    
    // Filter out metadata keys (those ending with :metadata) and ensure we only get trend data keys
    const trendKeys = keys.filter(key => {
      // Exclude metadata keys
      if (key.endsWith(':metadata')) {
        return false;
      }
      // Only include keys that start with cache-trends:Trends. and don't have :metadata
      return key.startsWith('cache-trends:Trends.') && !key.includes(':metadata');
    });
    
    console.log('🚦 All Trends API: Found keys', {
      total: keys.length,
      trendKeys: trendKeys.length,
      sample: trendKeys.slice(0, 10),
    });

    const trends = [];

    // Process each trend key
    for (const key of trendKeys) {
      try {
        const redisData = await redis.get(key);
        if (!redisData) continue;

        // Extract keyword from key: cache-trends:Trends.{keyword}
        const keyword = key.replace('cache-trends:Trends.', '');
        
        let parsedData: any = null;
        let rawContent: string | null = null;
        const trimmed = redisData.trim();

        // Try to parse as JSON first
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            parsedData = JSON.parse(redisData);
            // If JSON, extract content field if present
            rawContent = typeof parsedData?.content === 'string' ? parsedData.content : null;
          } catch (error) {
            console.warn('🚦 All Trends API: Failed to parse JSON for key', key, error);
            // Fall through to try as raw base64
          }
        }

        // If not JSON or no content in JSON, treat as raw base64 CSV
        if (!rawContent && !parsedData) {
          // Data is likely raw base64-encoded CSV
          rawContent = trimmed;
        }

        // Extract data array
        let dataArray: any[] = [];
        
        // First try to get data from parsed JSON
        if (parsedData) {
          if (Array.isArray(parsedData)) {
            dataArray = parsedData;
          } else if (Array.isArray(parsedData.data)) {
            dataArray = parsedData.data;
          } else if (parsedData && typeof parsedData === 'object') {
            const possibleArrayKeys = ['data', 'values', 'timeline', 'timelineData', 'results'];
            for (const arrayKey of possibleArrayKeys) {
              if (Array.isArray(parsedData[arrayKey])) {
                dataArray = parsedData[arrayKey];
                break;
              }
            }
          }
        }

        // If no data array yet, try to parse from rawContent (base64 CSV)
        if (dataArray.length === 0 && rawContent) {
          // Check if it looks like base64
          const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(rawContent.trim());
          
          if (looksBase64 && rawContent.length > 50) {
            try {
              // Decode base64 to get CSV content
              const decodedContent = Buffer.from(rawContent.replace(/\s/g, ''), 'base64').toString('utf-8');
              
              // Parse CSV if we have content
              if (decodedContent && decodedContent.includes('\n')) {
                const lines = decodedContent.trim().split('\n');
                if (lines.length > 2) {
                  dataArray = lines.slice(2).map((line) => {
                    const values = line.split(/\s+/).filter(v => v.trim());
                    const row: any = {};
                    if (values[0]) row.date = values[0];
                    if (values[1]) {
                      // Use decoded keyword or original
                      const decodedKeyword = decodeURIComponent(keyword);
                      row[decodedKeyword] = parseInt(values[1]) || 0;
                    }
                    return row;
                  }).filter(row => row.date && row[Object.keys(row).find(k => k !== 'date')]);
                }
              }
            } catch (error) {
              console.warn('🚦 All Trends API: Failed to decode base64 content for key', key, error);
            }
          } else if (rawContent.includes('\n')) {
            // Already decoded CSV, parse directly
            const lines = rawContent.trim().split('\n');
            if (lines.length > 2) {
              dataArray = lines.slice(2).map((line) => {
                const values = line.split(/\s+/).filter(v => v.trim());
                const row: any = {};
                if (values[0]) row.date = values[0];
                if (values[1]) {
                  const decodedKeyword = decodeURIComponent(keyword);
                  row[decodedKeyword] = parseInt(values[1]) || 0;
                }
                return row;
              }).filter(row => row.date && row[Object.keys(row).find(k => k !== 'date')]);
            }
          }
        }

        if (dataArray.length > 0) {
          trends.push({
            key: key,
            keyword: decodeURIComponent(keyword),
            data: dataArray,
            timestamp: parsedData?.metadata?.uploadedAt || parsedData?.timestamp || new Date().toISOString(),
            metadata: parsedData?.metadata,
          });
        } else {
          console.warn('🚦 All Trends API: No data extracted for key', key, {
            hasParsedData: !!parsedData,
            hasRawContent: !!rawContent,
            rawContentLength: rawContent?.length || 0,
          });
        }
      } catch (error) {
        console.error(`🚦 All Trends API: Error processing key ${key}:`, error);
      }
    }

    console.log('🚦 All Trends API: Returning trends', {
      count: trends.length,
      sampleKeywords: trends.slice(0, 5).map(t => t.keyword),
    });

    return NextResponse.json({
      success: true,
      trends: trends,
      count: trends.length,
    });

  } catch (error) {
    console.error('🚦 All Trends API: Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch trends from Redis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
