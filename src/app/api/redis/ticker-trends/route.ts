import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';

interface TrendDataPoint {
  date: string;
  [keyword: string]: string | number;
}

function parseTrendData(content: string, keyword: string): TrendDataPoint[] {
  const lines = content.split('\n').filter(line => line.trim());
  const dataPoints: TrendDataPoint[] = [];

  for (const line of lines) {
    // Skip header lines
    if (line.toLowerCase().includes('date') || line.toLowerCase().includes('week')) continue;

    // Parse CSV: date,value
    const parts = line.split(',');
    if (parts.length >= 2) {
      const date = parts[0].trim();
      const value = parseInt(parts[1].trim(), 10);

      if (date && !isNaN(value)) {
        dataPoints.push({
          date,
          [keyword]: value,
        });
      }
    }
  }

  return dataPoints;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trendKeys = searchParams.get('keys');

    if (!trendKeys) {
      return NextResponse.json(
        { success: false, error: 'Missing keys parameter (comma-separated trend keys)' },
        { status: 400 },
      );
    }

    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { success: false, error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }

    const keys = trendKeys.split(',').map(k => k.trim());
    const results: Array<{
      keyword: string;
      trendKey: string;
      found: boolean;
      dataPointCount: number;
      data: TrendDataPoint[];
    }> = [];

    for (const trendKey of keys) {
      // Extract keyword from trend key (e.g., "Trends.Uber" -> "Uber")
      const keyword = trendKey.replace(/^Trends\./, '');
      
      // Try multiple key patterns - the main pattern is cache-trends:Trends.{keyword}
      const possibleKeys = [
        `cache-trends:${trendKey}`,                    // cache-trends:Trends.Uber
        `cache-trends:Trends.${keyword}`,              // cache-trends:Trends.Uber (redundant but safe)
        `cache-trends:Trends.${keyword.toLowerCase()}`, // lowercase version
        trendKey,                                       // Trends.Uber
        `Trends.${keyword}`,                           // Trends.Uber
      ];

      let found = false;
      let data: TrendDataPoint[] = [];

      for (const redisKey of possibleKeys) {
        try {
          const rawData = await redis.get(redisKey);
          if (rawData) {
            let content = rawData;

            // Try to parse as JSON first
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
              try {
                const parsed = JSON.parse(content);
                content = parsed.content || parsed.data || content;
              } catch {
                // Use as-is
              }
            }

            // Try to decode base64 if needed
            if (typeof content === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(content.trim()) && content.length > 50) {
              try {
                const decoded = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf-8');
                if (decoded.includes('\n') || decoded.includes(',')) {
                  content = decoded;
                }
              } catch {
                // Not base64
              }
            }

            data = parseTrendData(content, keyword);
            if (data.length > 0) {
              found = true;
              break;
            }
          }
        } catch (error) {
          console.warn(`Error fetching ${redisKey}:`, error);
        }
      }

      results.push({
        keyword,
        trendKey,
        found,
        dataPointCount: data.length,
        data,
      });
    }

    // Combine all trend data into a unified dataset
    const allDates = new Map<string, TrendDataPoint>();
    
    for (const result of results) {
      if (!result.found) continue;
      
      for (const point of result.data) {
        const existing = allDates.get(point.date) || { date: point.date };
        existing[result.keyword] = point[result.keyword];
        allDates.set(point.date, existing);
      }
    }

    // Sort by date
    const combinedData = Array.from(allDates.values()).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return NextResponse.json({
      success: true,
      totalRequested: keys.length,
      totalFound: results.filter(r => r.found).length,
      results,
      combinedData,
      dataPointCount: combinedData.length,
    });
  } catch (error) {
    console.error('Ticker trends API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ticker trends',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
