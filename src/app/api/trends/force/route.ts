import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { fetchFreshTrendsData } from '@/lib/trends-data-fetcher';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get('keywords');

  if (!keywords) {
    return NextResponse.json(
      { error: 'Keywords parameter is required' },
      { status: 400 }
    );
  }

  try {
    const keywordList = keywords.split(',').map(k => k.trim());
    
    // Generate the same hash as the Python script
    const crypto = await import('crypto');
    const keywordsStr = keywordList.sort().join(',');
    const hash = crypto.createHash('md5').update(keywordsStr).digest('hex');
    
        // Fetch fresh data from real Google Trends API
        const freshData = await fetchFreshTrendsData(keywordList);
        
        // If fresh data fetch failed, return the error
        if (!freshData.success) {
          return NextResponse.json({
            success: false,
            error: freshData.error,
            keywords: keywordList,
            hash: hash,
            note: 'Failed to fetch fresh data from Google Trends API'
          }, { status: 500 });
        }
        
        // Save fresh data to Redis (only if we actually got real data)
        try {
          const redis = await getRedisClient();

          if (!redis) {
            throw new Error('Redis connection unavailable');
          }
          
          const cacheKey = `trends:${hash}`;
          const cacheData = {
            success: true,
            data: freshData.data,
            keywords: freshData.keywords,
            timestamp: freshData.timestamp,
            note: 'Fresh data from Google Trends API'
          };
          
          // Store in Redis with 7 day expiration
          await redis.setEx(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(cacheData));
          console.log(`Fresh data saved to Redis for keywords: ${keywordList.join(', ')} with key: ${cacheKey}`);
        } catch (redisError) {
          console.log('Redis connection failed:', redisError);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Fresh data fetched successfully',
          data: freshData,
          cacheInfo: {
            filename: `${hash}.json`,
            keywords: keywordList,
            lastModified: new Date().toISOString(),
            size: JSON.stringify(freshData).length,
            note: 'Fresh data - cached in Redis for 7 days'
          }
        });

  } catch (error) {
    console.error('Force API call error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fresh data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
