import { getRedisClient } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json();

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

    // Check if key exists
    const exists = await redis.exists(key);
    
    if (!exists) {
      return NextResponse.json(
        { error: 'File not found in Redis' },
        { status: 404 }
      );
    }

    // Delete the key
    const deleted = await redis.del(key);

    return NextResponse.json({
      success: true,
      deleted: deleted,
      message: 'File deleted from Redis successfully'
    });

  } catch (error) {
    console.error('Redis delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file from Redis' },
      { status: 500 }
    );
  }
}

