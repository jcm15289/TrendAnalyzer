import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Normalize keywords for consistent cache keys (case-insensitive, trimmed)
function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0).sort();
}

// Generate a cache key for peak summaries
function generatePeakSummariesKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  const key = `peak-summaries:${hash}`;
  console.log('[PEAK-SUMMARIES] Generated cache key', {
    originalKeywords: keywords,
    normalizedKeywords: normalized,
    hash,
    key,
  });
  return key;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keywordsParam = searchParams.get('keywords');
    
    if (!keywordsParam) {
      return NextResponse.json(
        { success: false, error: 'Keywords parameter is required' },
        { status: 400 }
      );
    }

    // Parse keywords - handle both comma-separated and single keyword
    let keywords: string[];
    if (keywordsParam.includes(',')) {
      keywords = keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0);
    } else {
      keywords = [keywordsParam.trim()];
    }
    
    console.log('[PEAK-SUMMARIES] Request received', {
      keywordsParam,
      parsedKeywords: keywords,
      keywordCount: keywords.length,
    });
    
    if (keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one keyword is required' },
        { status: 400 }
      );
    }

    // Only support single keyword for peak summaries
    if (keywords.length !== 1) {
      console.log('[PEAK-SUMMARIES] Multiple keywords, returning empty', { keywords });
      return NextResponse.json({
        success: true,
        peakSummaries: [],
        message: 'Peak summaries only available for single keyword queries',
      });
    }

    // Fetch peak summaries from Redis
    try {
      const redis = await getRedisClient();
      if (!redis) {
        return NextResponse.json({
          success: true,
          peakSummaries: [],
          message: 'Redis not available',
        });
      }

      const peakSummariesKey = generatePeakSummariesKey(keywords);
      const cachedPeakSummaries = await redis.get(peakSummariesKey);
      
      if (!cachedPeakSummaries) {
        console.log('[PEAK-SUMMARIES] cache miss', { peakSummariesKey });
        return NextResponse.json({
          success: true,
          peakSummaries: [],
          message: 'No peak summaries found in cache',
        });
      }

      const peakSummaries = JSON.parse(cachedPeakSummaries);
      console.log('[PEAK-SUMMARIES] cache hit', {
        peakSummariesKey,
        peakCount: peakSummaries.length,
      });

      return NextResponse.json({
        success: true,
        peakSummaries,
      });
    } catch (redisError) {
      console.error('[PEAK-SUMMARIES] Redis error', redisError);
      return NextResponse.json({
        success: true,
        peakSummaries: [],
        message: 'Failed to fetch peak summaries',
      });
    }
  } catch (error) {
    console.error('[PEAK-SUMMARIES] Unexpected error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get peak summaries',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

