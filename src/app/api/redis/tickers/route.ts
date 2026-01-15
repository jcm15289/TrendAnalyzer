import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';

interface TickerGroup {
  baseTicker: string;
  keywords: Array<{
    ticker: string;
    keyword: string;
    trendKey: string; // e.g., "Trends.Uber"
  }>;
}

function stripTickerNumber(ticker: string): string {
  // Remove trailing numbers: UBER2 -> UBER, AAPL3 -> AAPL
  return ticker.replace(/\d+$/, '');
}

function keywordToTrendKey(keyword: string): string {
  // Convert "Uber driver" to "Trends.Uberdriver" (no spaces)
  const cleaned = keyword.replace(/\s+/g, '');
  return `Trends.${cleaned}`;
}

export async function GET(request: NextRequest) {
  try {
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        { success: false, error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }

    // Fetch ALLSYMS from Redis
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
      const allKeys = await redis.keys('*ALLSYMS*');
      if (allKeys.length > 0) {
        foundKey = allKeys[0];
        redisData = await redis.get(foundKey);
      }
    }

    if (!redisData) {
      return NextResponse.json(
        { success: false, error: 'ALLSYMS file not found in Redis' },
        { status: 404 },
      );
    }

    // Parse the data
    let content = '';
    const trimmed = redisData.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsedData = JSON.parse(redisData);
        content = parsedData.content || redisData;
      } catch {
        content = redisData;
      }
    } else {
      content = redisData;
    }

    // Try to decode base64 if needed
    if (typeof content === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(content.trim()) && content.length > 50) {
      try {
        const decoded = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
        if (decoded.includes('\n') || decoded.includes(',')) {
          content = decoded;
        }
      } catch {
        // Not base64, use as-is
      }
    }

    // Parse lines and group by base ticker
    const lines = content.split('\n').filter((line: string) => line.trim());
    const tickerGroups = new Map<string, TickerGroup>();

    for (const line of lines) {
      // Split by whitespace - first part is ticker, rest is keyword
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      const ticker = parts[0];
      const keyword = parts.slice(1).join(' ');
      const baseTicker = stripTickerNumber(ticker);
      const trendKey = keywordToTrendKey(keyword);

      if (!tickerGroups.has(baseTicker)) {
        tickerGroups.set(baseTicker, {
          baseTicker,
          keywords: [],
        });
      }

      tickerGroups.get(baseTicker)!.keywords.push({
        ticker,
        keyword,
        trendKey,
      });
    }

    // Convert to array and sort by base ticker
    const groupsArray = Array.from(tickerGroups.values()).sort((a, b) =>
      a.baseTicker.localeCompare(b.baseTicker)
    );

    return NextResponse.json({
      success: true,
      source: foundKey,
      totalLines: lines.length,
      totalGroups: groupsArray.length,
      groups: groupsArray,
    });
  } catch (error) {
    console.error('Tickers API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ticker groups',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
