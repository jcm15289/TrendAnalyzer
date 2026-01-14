import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        {
          success: false,
          error: 'Redis connection unavailable',
        },
        { status: 503 },
      );
    }

    const redisData: Record<string, any> = {};

    try {
      const keys = await redis.keys('cache-trends:Trends.*');
      
      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          const parsed = JSON.parse(data);
          const keyword = key.replace('cache-trends:Trends.', '');
          
          redisData[keyword] = {
            key: key,
            filename: parsed.metadata?.filename || 'Unknown',
            size: parsed.metadata?.size || 0,
            type: parsed.metadata?.type || 'Unknown',
            folder: parsed.metadata?.folder || 'Unknown',
            uploaded: parsed.metadata?.uploadedAt ? new Date(parsed.metadata.uploadedAt).toISOString() : null,
            exists: true
          };
        }
      }
      
    } catch (error) {
      console.error('Error connecting to Redis:', error);
      return NextResponse.json({
        success: false,
        error: 'Error connecting to Redis',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: redisData,
      count: Object.keys(redisData).length
    });

  } catch (error) {
    console.error('Redis data API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
