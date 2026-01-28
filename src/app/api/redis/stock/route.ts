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

    // First, try the Alpha Vantage queue key pattern
    const alphaVantageUrl = `https://www.alphavantage.co/query?entitlement=delayed&function=TIME_SERIES_DAILY_ADJUSTED&outputsize=full&symbol=${symbol}`;
    const avQueueKey = `av_queue:${alphaVantageUrl}`;
    
    // Try different possible key patterns for stock data
    const possibleKeys = [
      avQueueKey, // Alpha Vantage queue key (priority)
      symbol, // Direct symbol like "GOOGL"
      `stock:${symbol}`, // stock:GOOGL
      `stock:dcf:${symbol}`, // stock:dcf:GOOGL (old format)
      `stocks:${symbol}`, // stocks:GOOGL
      `data:${symbol}`, // data:GOOGL
      `financial:${symbol}`, // financial:GOOGL
      `finantialscan:${symbol}`, // finantialscan:GOOGL
      `${symbol}:data`, // GOOGL:data
      `${symbol}:financial`, // GOOGL:financial
    ];

    let redisData = null;
    let foundKey = null;
    let parsedData: any = null;

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

    // If not found in Redis, try fetching directly from Alpha Vantage API
    if (!redisData) {
      console.log(`[StockAPI] Data not found in Redis for ${symbol}, trying Alpha Vantage API...`);
      
      try {
        const apiKey = process.env.ALPHAVANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
          console.warn('[StockAPI] No Alpha Vantage API key found in environment variables');
        }
        
        const avUrl = apiKey 
          ? `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&outputsize=full&symbol=${symbol}&apikey=${apiKey}`
          : alphaVantageUrl; // Use the URL without API key if none provided
        
        console.log(`[StockAPI] Fetching from Alpha Vantage: ${avUrl.replace(/apikey=[^&]+/, 'apikey=***')}`);
        
        const avResponse = await fetch(avUrl, {
          headers: {
            'User-Agent': 'TrendAnalyzer/1.0',
          },
        });
        
        if (!avResponse.ok) {
          throw new Error(`Alpha Vantage API returned ${avResponse.status}: ${avResponse.statusText}`);
        }
        
        const avData = await avResponse.json();
        
        // Check for Alpha Vantage error messages
        if (avData['Error Message']) {
          throw new Error(`Alpha Vantage API Error: ${avData['Error Message']}`);
        }
        if (avData['Note']) {
          throw new Error(`Alpha Vantage API Note: ${avData['Note']}`);
        }
        
        // Use the Alpha Vantage response as parsedData (skip Redis parsing)
        parsedData = avData;
        foundKey = `alpha_vantage:${symbol}`;
        
        console.log(`[StockAPI] Successfully fetched from Alpha Vantage for ${symbol}`);
      } catch (avError) {
        console.error(`[StockAPI] Failed to fetch from Alpha Vantage:`, avError);
        return NextResponse.json(
          {
            success: false,
            error: `Stock data for ${symbol} not found in Redis and Alpha Vantage fetch failed`,
            details: avError instanceof Error ? avError.message : 'Unknown error',
            searchedKeys: possibleKeys,
          },
          { status: 404 },
        );
      }
    }

    // Parse the data (only if we got it from Redis, not from Alpha Vantage)
    if (!parsedData && redisData) {
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
      } // End of Redis parsing block
    }

    // Extract data array from parsed JSON
    let dataArray: any[] = [];
    
    if (Array.isArray(parsedData)) {
      dataArray = parsedData;
    } else if (Array.isArray(parsedData.data)) {
      dataArray = parsedData.data;
    } else if (parsedData && typeof parsedData === 'object') {
      // Check for Alpha Vantage "Time Series (Daily)" format (priority)
      // It can be directly in parsedData or nested in parsedData.response
      const timeSeries = parsedData["Time Series (Daily)"] || parsedData.response?.["Time Series (Daily)"];
      if (timeSeries && typeof timeSeries === 'object') {
        // Convert Alpha Vantage time series to array format
        dataArray = Object.keys(timeSeries)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()) // Sort by date ascending
          .map(date => {
            const dayData = timeSeries[date];
            return {
              date: date,
              close: parseFloat(dayData["5. adjusted close"] || dayData["4. close"] || dayData["close"] || 0),
              open: parseFloat(dayData["1. open"] || dayData["open"] || 0),
              high: parseFloat(dayData["2. high"] || dayData["high"] || 0),
              low: parseFloat(dayData["3. low"] || dayData["low"] || 0),
              volume: parseFloat(dayData["6. volume"] || dayData["volume"] || 0),
            };
          });
        console.log(`[StockAPI] Parsed ${dataArray.length} data points from Alpha Vantage Time Series`);
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
    
    // CRITICAL: If no data points found, this is a failure
    if (dataArray.length === 0) {
      console.error(`[StockAPI] FAILURE: No data points extracted for ${symbol}`, {
        foundKey,
        parsedDataKeys: parsedData ? Object.keys(parsedData) : [],
        parsedDataType: Array.isArray(parsedData) ? 'array' : typeof parsedData,
      });
      return NextResponse.json(
        {
          success: false,
          error: `No data points found for ${symbol}. This is a failure.`,
          key: foundKey,
          symbol,
          dataPointCount: 0,
          searchedKeys: possibleKeys,
          debug: {
            parsedDataKeys: parsedData ? Object.keys(parsedData).slice(0, 10) : [],
            hasTimeSeries: !!(parsedData?.["Time Series (Daily)"]),
          },
        },
        { status: 404 },
      );
    }

    console.log(`[StockAPI] SUCCESS: Returning ${dataArray.length} data points for ${symbol}`, {
      key: foundKey,
      firstDate: dataArray[0]?.date,
      lastDate: dataArray[dataArray.length - 1]?.date,
    });
    
    return NextResponse.json({
      success: true,
      key: foundKey,
      symbol: parsedData.symbol || parsedData["Meta Data"]?.["2. Symbol"] || symbol,
      data: dataArray,
      dataPointCount: dataArray.length,
      timestamp: parsedData.timestamp || parsedData["Meta Data"]?.["3. Last Refreshed"] || null,
      metadata: {
        ...parsedData,
        data: undefined, // Remove data from metadata to avoid duplication
        "Time Series (Daily)": undefined, // Remove time series from metadata
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
