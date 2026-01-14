import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Try to read from Redis first
    const redis = await getRedisClient();

    if (!redis) {
      console.warn('Redis connection unavailable for keywords/read, falling back to file');
    }
    
    const redisData = redis ? await redis.get('gui-keywords') : null;
    
    if (redisData) {
      const parsedData = JSON.parse(redisData);
      return NextResponse.json({
        success: true,
        keywords: parsedData.keywords,
        keywordSets: parsedData.keywordSets || [],  // Include keyword sets for comparisons
        lastModified: parsedData.lastUpdated,
        source: 'redis',
        keywordCount: parsedData.keywords ? parsedData.keywords.length : 0,
        keywordSetsCount: parsedData.keywordSets ? parsedData.keywordSets.length : 0
      });
    }
    
    // Fallback to local file if Redis doesn't have data
    const keywordsFilePath = path.join(process.cwd(), '..', 'TrendKeywords', 'Keywords');
    
    if (!fs.existsSync(keywordsFilePath)) {
      return NextResponse.json({
        success: false,
        error: 'No keywords found in Redis or local file',
        filePath: keywordsFilePath
      }, { status: 404 });
    }

    // Read the file
    const fileContent = fs.readFileSync(keywordsFilePath, 'utf-8');
    const lines = fileContent.split('\n');
    
    // Parse keywords (skip comments and empty lines)
    const keywords: string[] = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        keywords.push(trimmed);
      }
    });

    // Get file stats
    const stats = fs.statSync(keywordsFilePath);

    return NextResponse.json({
      success: true,
      keywords: keywords,
      filePath: keywordsFilePath,
      lastModified: stats.mtime.toISOString(),
      size: stats.size,
      lineCount: lines.length,
      keywordCount: keywords.length,
      source: 'local_file'
    });

  } catch (error) {
    console.error('Keywords read error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to read keywords file', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
