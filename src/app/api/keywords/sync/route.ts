import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { keywords } = await request.json();

    if (!keywords || !Array.isArray(keywords)) {
      return NextResponse.json(
        { error: 'Keywords array is required' },
        { status: 400 }
      );
    }

    // Store keywords in Redis for cross-environment sync
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        { error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }
    
    // Store keyword sets (preserving comparisons/groupings)
    const uniqueKeywordSets = new Map<string, string[]>();
    
    // Remove duplicate keyword sets
    keywords.forEach((keywordSet: string[]) => {
      if (Array.isArray(keywordSet) && keywordSet.length > 0) {
        // Clean and filter keywords
        const cleanedSet = keywordSet
          .map(k => k?.trim())
          .filter(k => k && k.length > 0);
        
        if (cleanedSet.length > 0) {
          // Use sorted JSON as key to detect duplicates
          const key = JSON.stringify(cleanedSet.sort());
          uniqueKeywordSets.set(key, cleanedSet);
        }
      }
    });

    // Store in Redis with keyword sets preserved
    const keywordsData = {
      keywordSets: Array.from(uniqueKeywordSets.values()),
      // Also keep flattened list for backward compatibility
      keywords: Array.from(new Set(
        Array.from(uniqueKeywordSets.values()).flat()
      )).sort(),
      lastUpdated: new Date().toISOString(),
      source: 'vercel_gui'
    };
    
    await redis.set('gui-keywords', JSON.stringify(keywordsData));

    // Trigger Finscanserver update (optional webhook)
    try {
      // You can add a webhook call here to notify Finscanserver
      // await fetch('http://your-finscanserver/webhook/keywords-updated', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ keywords: Array.from(allKeywords) })
      // });
    } catch (webhookError) {
      console.log('Webhook notification failed (optional):', webhookError);
    }

    return NextResponse.json({
      success: true,
      message: 'Keywords synced to Redis successfully',
      keywordSetsCount: uniqueKeywordSets.size,
      keywordSets: Array.from(uniqueKeywordSets.values()),
      keywords: Array.from(new Set(
        Array.from(uniqueKeywordSets.values()).flat()
      )).sort()
    });

  } catch (error) {
    console.error('Keywords sync error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to sync keywords', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
