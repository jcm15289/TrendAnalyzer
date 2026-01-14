import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywordsParam = searchParams.get('keywords');

  if (!keywordsParam) {
    return NextResponse.json({ success: false, error: 'Keywords parameter is required' }, { status: 400 });
  }

  try {
    const keywords = keywordsParam.split(',');
    
    // Generate the same hash as the Python script
    const crypto = await import('crypto');
    const keywordsStr = keywords.sort().join(',');
    const hash = crypto.createHash('md5').update(keywordsStr).digest('hex');
    
    // Delete cache from Redis
    try {
      const redis = await getRedisClient();

      if (!redis) {
        return NextResponse.json(
          {
            success: false,
            error: 'Redis connection unavailable',
            details: 'Could not obtain Redis client to delete cache',
          },
          { status: 503 },
        );
      }
      
      const cacheKey = `trends:${hash}`;
      const deleted = await redis.del(cacheKey);
      
      if (deleted > 0) {
        return NextResponse.json({
          success: true,
          message: `Cache deleted from Redis for keywords: ${keywords.join(', ')}`,
          filename: `${hash}.json`,
          note: 'Cache permanently deleted from Redis'
        });
      } else {
        return NextResponse.json({
          success: false,
          message: `No cache found in Redis for keywords: ${keywords.join(', ')}`,
          filename: `${hash}.json`,
          note: 'Cache was not found in Redis'
        }, { status: 404 });
      }
      
    } catch (redisError) {
      console.error('Redis delete error:', redisError);
      return NextResponse.json({ 
        success: false, 
        error: 'Could not connect to Redis to delete cache',
        details: redisError instanceof Error ? redisError.message : 'Unknown Redis error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Delete cache error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Could not delete cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}