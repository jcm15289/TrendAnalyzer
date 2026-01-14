import { getRedisClient } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    // Create Redis client
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        { error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }

    // Get data from Redis
    const data = await redis.get(key);
    
    if (!data) {
      return NextResponse.json(
        { error: 'File not found in Redis' },
        { status: 404 }
      );
    }

    const parsedData = JSON.parse(data);
    const ttl = await redis.ttl(key);

    // Return file data
    return NextResponse.json({
      success: true,
      key: key,
      content: parsedData.content,
      metadata: parsedData.metadata,
      ttl: ttl
    });

  } catch (error) {
    console.error('Redis download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file from Redis' },
      { status: 500 }
    );
  }
}

