import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

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
    const keywordList = keywords.split(',').map(k => k.trim());
    
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        {
          success: false,
          error: 'Redis connection unavailable',
          keywords: keywordList,
        },
        { status: 503 },
      );
    }
    
    // Look for the key in the format: cache-trends:Trends.{keyword}
    let redisData = null;
    let foundKey = null;
    let lastModified = null;
    
    for (const keyword of keywordList) {
      // Remove spaces from keyword (same logic as TrendsRun.pl)
      const keywordNoSpaces = keyword.replace(/\s+/g, '');
      
      // Try different case variations
      const variations = [
        keyword, // original case
        keyword.toLowerCase(), // all lowercase
        keyword.toUpperCase(), // all uppercase
        keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase(), // title case
        keywordNoSpaces, // no spaces, original case
        keywordNoSpaces.toLowerCase(), // no spaces, lowercase
        keywordNoSpaces.toUpperCase(), // no spaces, uppercase
        keywordNoSpaces.charAt(0).toUpperCase() + keywordNoSpaces.slice(1).toLowerCase(), // no spaces, title case
      ];
      
      for (const variation of variations) {
        const cacheKey = `cache-trends:Trends.${variation}`;
        redisData = await redis.get(cacheKey);
        if (redisData) {
          foundKey = cacheKey;
          const parsedData = JSON.parse(redisData);
          lastModified = parsedData.metadata?.uploadedAt || new Date().toISOString();
          break;
        }
      }
      
      if (redisData) break;
    }
    
    if (redisData && lastModified) {
      return NextResponse.json({
        success: true,
        cacheInfo: {
          lastModified: lastModified,
          key: foundKey,
          keywords: keywordList
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'No cached data found',
      keywords: keywordList
    }, { status: 404 });

  } catch (error) {
    console.error('Cache API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Cache connection error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}