import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { fetchFreshTrendsData } from '@/lib/trends-data-fetcher';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get('keywords');

  if (!keywords) {
    return NextResponse.json(
      { error: 'Keywords parameter is required' },
      { status: 400 }
    );
  }

  try {
    const keywordList = keywords.split(',').map(k => k.trim().toLowerCase());
    
    // Generate the same hash as the Python script (using lowercase for consistency)
    const crypto = await import('crypto');
    const keywordsStr = keywordList.sort().join(',');
    const hash = crypto.createHash('md5').update(keywordsStr).digest('hex');
    
    // Try to get data from Redis first
    try {
      const redis = await getRedisClient();

      if (!redis) {
        throw new Error('Redis connection unavailable');
      }
      
      const cacheKey = `trends:${hash}`;
      const redisData = await redis.get(cacheKey);
      
      if (redisData) {
        const parsedData = JSON.parse(redisData);
        console.log('Redis cache hit for keywords:', keywords, 'hash:', hash);
        return NextResponse.json(parsedData);
      }
    } catch (redisError) {
      console.log('Redis not available for keywords:', keywords, 'hash:', hash);
    }
    
        // No cache found - return error instead of fetching from Google Trends
        console.log(`Cache miss for keywords: ${keywordList.join(', ')}, no cached data available`);
        
        return NextResponse.json({
          success: false,
          error: 'No cached data found in Redis',
          details: `No cached data available for keywords: ${keywordList.join(', ')} in Redis. Use TrendsRun.pl script to generate cache files first.`,
          keywords: keywordList,
          hash: hash
        }, { status: 404 });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
