import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol') || 'GOOGL';

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

    // Try different possible key patterns for stock data
    const possibleKeys = [
      symbol, // Direct symbol like "GOOGL"
      `stock:${symbol}`, // stock:GOOGL
      `stocks:${symbol}`, // stocks:GOOGL
      `data:${symbol}`, // data:GOOGL
      `financial:${symbol}`, // financial:GOOGL
      `finantialscan:${symbol}`, // finantialscan:GOOGL
      `${symbol}:data`, // GOOGL:data
      `${symbol}:financial`, // GOOGL:financial
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
      // If not found, try to search for keys containing the symbol
      const allKeys = await redis.keys(`*${symbol}*`);
      console.log(`Searching for keys containing ${symbol}, found:`, allKeys.slice(0, 10));
      
      if (allKeys.length > 0) {
        // Try the first matching key
        foundKey = allKeys[0];
        redisData = await redis.get(foundKey);
      }
    }

    if (!redisData) {
      return NextResponse.json(
        {
          success: false,
          error: `Stock data for ${symbol} not found in Redis`,
          searchedKeys: possibleKeys,
        },
        { status: 404 },
      );
    }

    // Parse the data
    let parsedData: any = null;
    const trimmed = redisData.trim();

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        parsedData = JSON.parse(redisData);
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to parse JSON data',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 },
        );
      }
    } else {
      // Try to decode base64 if it looks like base64
      if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.length > 50) {
        try {
          const decoded = Buffer.from(trimmed.replace(/\s/g, ''), 'base64').toString('utf-8');
          parsedData = JSON.parse(decoded);
        } catch (error) {
          return NextResponse.json(
            {
              success: false,
              error: 'Data is not in expected format',
            },
            { status: 500 },
          );
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Data format not recognized',
          },
          { status: 500 },
        );
      }
    }

    // Extract data array from parsed JSON
    let dataArray: any[] = [];
    
    if (Array.isArray(parsedData)) {
      dataArray = parsedData;
    } else if (Array.isArray(parsedData.data)) {
      dataArray = parsedData.data;
    } else if (parsedData && typeof parsedData === 'object') {
      // Check for Alpha Vantage "Time Series (Daily)" format
      if (parsedData["Time Series (Daily)"]) {
        const timeSeries = parsedData["Time Series (Daily)"];
        dataArray = Object.keys(timeSeries).map(date => ({
          date: date,
          close: parseFloat(timeSeries[date]["5. adjusted close"] || timeSeries[date]["4. close"] || 0),
        }));
      } else {
        // Check for common array properties
        const possibleArrayKeys = ['data', 'values', 'timeline', 'timelineData', 'results'];
        for (const arrayKey of possibleArrayKeys) {
          if (Array.isArray(parsedData[arrayKey])) {
            dataArray = parsedData[arrayKey];
            break;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      key: foundKey,
      symbol: parsedData.symbol || symbol,
      data: dataArray,
      dataPointCount: dataArray.length,
      timestamp: parsedData.timestamp || null,
      metadata: {
        ...parsedData,
        data: undefined, // Remove data from metadata to avoid duplication
      },
    });

  } catch (error) {
    console.error('Stock data API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch stock data from Redis',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
