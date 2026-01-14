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
        const trimmed = redisData.trim();

        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            parsedData = JSON.parse(redisData);
          } catch (error) {
            console.warn('🚦 All Trends API: Failed to parse JSON for key', key, error);
            continue;
          }
        } else {
          console.warn('🚦 All Trends API: Redis value is not JSON for key', key);
          continue;
        }

        // Extract data array
        let dataArray: any[] = [];
        
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

        // Handle CSV content if present
        let rawContent = typeof parsedData?.content === 'string' ? parsedData.content : null;
        
        if (rawContent) {
          const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(rawContent);
          if (looksBase64) {
            try {
              rawContent = Buffer.from(rawContent.replace(/\s/g, ''), 'base64').toString('utf-8');
            } catch (error) {
              console.warn('🚦 All Trends API: Failed to decode base64 content', error);
            }
          }
          
          // Parse CSV if we have content
          if (rawContent && rawContent.includes('\n')) {
            const lines = rawContent.trim().split('\n');
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
        }

        if (dataArray.length > 0) {
          trends.push({
            key: key,
            keyword: decodeURIComponent(keyword),
            data: dataArray,
            timestamp: parsedData?.metadata?.uploadedAt || parsedData?.timestamp || new Date().toISOString(),
            metadata: parsedData?.metadata,
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
