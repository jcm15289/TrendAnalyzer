import { getRedisClient } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'files';
    const pattern = searchParams.get('pattern') || '*';

    // Create Redis client
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        { error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }

    // Get all keys matching the pattern
    const keys = await redis.keys(`${folder}:${pattern}`);
    const files = [];

    // Get metadata for each key
    for (const key of keys) {
      try {
        const data = await redis.get(key);
        if (data) {
          const parsedData = JSON.parse(data);
          const ttl = await redis.ttl(key);
          
          files.push({
            key: key,
            filename: parsedData.metadata?.filename || key.split(':').pop(),
            size: parsedData.metadata?.size || 0,
            type: parsedData.metadata?.type || 'unknown',
            uploadedAt: parsedData.metadata?.uploadedAt,
            ttl: ttl,
            folder: parsedData.metadata?.folder || folder
          });
        }
      } catch (error) {
        console.error(`Error processing key ${key}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      files: files,
      count: files.length,
      folder: folder
    });

  } catch (error) {
    console.error('Redis list error:', error);
    return NextResponse.json(
      { error: 'Failed to list files from Redis' },
      { status: 500 }
    );
  }
}

