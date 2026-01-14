import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Try different possible key patterns for ALLSYMS
    const possibleKeys = [
      'finantialscan:ALLSYMS',
      'files:finantialscan:ALLSYMS',
      'cache-trends:finantialscan:ALLSYMS',
      'ALLSYMS',
      'files:ALLSYMS',
    ];

    let redisData = null;
    let foundKey = null;

    for (const key of possibleKeys) {
      try {
        const data = await redis.get(key);
        if (data) {
          redisData = data;
          foundKey = key;
          break;
        }
      } catch (error) {
        console.warn(`Failed to fetch key ${key}:`, error);
      }
    }

    if (!redisData) {
      // If not found, try to search for keys containing ALLSYMS
      const allKeys = await redis.keys('*ALLSYMS*');
      if (allKeys.length > 0) {
        foundKey = allKeys[0];
        redisData = await redis.get(foundKey);
      }
    }

    if (!redisData) {
      return NextResponse.json(
        {
          success: false,
          error: 'ALLSYMS file not found in Redis',
          searchedKeys: possibleKeys,
        },
        { status: 404 },
      );
    }

    // Parse the data
    let parsedData: any = null;
    let content = '';
    const trimmed = redisData.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedData = JSON.parse(redisData);
        content = parsedData.content || redisData;
      } catch (error) {
        content = redisData;
      }
    } else {
      content = redisData;
    }

    // Try to decode base64 if it looks like base64
    if (typeof content === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(content.trim()) && content.length > 50) {
      try {
        const decoded = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
        if (decoded.includes('\n') || decoded.includes(',')) {
          content = decoded;
        }
      } catch (error) {
        // Not base64, use as-is
      }
    }

    // Parse as lines if it's text
    const lines = typeof content === 'string' ? content.split('\n').filter(line => line.trim()) : [];

    return NextResponse.json({
      success: true,
      key: foundKey,
      content: content,
      lines: lines,
      lineCount: lines.length,
      size: typeof content === 'string' ? content.length : 0,
      metadata: parsedData?.metadata || null,
    });

  } catch (error) {
    console.error('ALLSYMS API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ALLSYMS from Redis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
