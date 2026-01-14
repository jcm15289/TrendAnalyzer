import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import crypto from 'crypto';
import { extractPeakExplanation } from '@/lib/peak-detection';

export const dynamic = 'force-dynamic';

// Generate a cache key from keywords (same as explain-trend)
function generateCacheKey(keywords: string[]): string {
  const sortedKeywords = [...keywords].sort().join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  return `explain-trend:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const { keywords, peaks } = await request.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Keywords array is required' },
        { status: 400 }
      );
    }

    if (!peaks || !Array.isArray(peaks) || peaks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Peaks array is required' },
        { status: 400 }
      );
    }

    // Get cached explanation from Redis
    const cacheKey = generateCacheKey(keywords);
    let explanation = null;

    try {
      const redis = await getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const cachedResult = JSON.parse(cached);
          explanation = cachedResult.explanation;
        }
      }
    } catch (error) {
      console.warn('[PEAK-EXPLANATIONS] Failed to fetch cached explanation', error);
    }

    if (!explanation) {
      return NextResponse.json({
        success: true,
        peakExplanations: peaks.map((peak: any) => ({
          date: peak.date,
          keyword: peak.keyword,
          explanation: null,
        })),
      });
    }

    // Extract explanations for each peak
    const peakExplanations = peaks.map((peak: any) => {
      const explanationText = extractPeakExplanation(explanation, peak.date);
      return {
        date: peak.date,
        keyword: peak.keyword,
        value: peak.value,
        explanation: explanationText,
      };
    });

    return NextResponse.json({
      success: true,
      peakExplanations,
    });

  } catch (error) {
    console.error('[PEAK-EXPLANATIONS] Unexpected error', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get peak explanations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

