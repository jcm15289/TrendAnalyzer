import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get('keywords');

  if (!keywords) {
    console.error('🚦 Redis API: Missing keywords search param');
    return NextResponse.json(
      { error: 'Keywords parameter is required' },
      { status: 400 }
    );
  }

  try {
    const keywordList = keywords.split(',').map(k => k.trim());
    console.log('🚦 Redis API: Request received', { keywords: keywordList });
    
    // Try to get data from Redis using the uploaded key pattern
    const redis = await getRedisClient();

    if (!redis) {
      console.error('🚦 Redis API: Redis connection unavailable');
      return NextResponse.json(
        {
          success: false,
          error: 'Redis connection unavailable',
          keywords: keywordList,
          source: 'redis',
        },
        { status: 503 },
      );
    }
    
    // Look for the key in the format: cache-trends:Trends.{keyword}
    // Try both original case and lowercase versions
    let redisData = null;
    let foundKey = null;
    
    for (const keyword of keywordList) {
      // Remove spaces from keyword (same logic as TrendsRun.pl)
      const keywordNoSpaces = keyword.replace(/\s+/g, '');
      
      // Try different case variations
      console.log('🚦 Redis API: Building key variations for keyword', { keyword, keywordNoSpaces });
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
        try {
          console.log('🚦 Redis API: Checking Redis key', { cacheKey });
          redisData = await redis.get(cacheKey);
        } catch (error) {
          console.error('🚦 Redis API: Error fetching key', { cacheKey, error });
          continue;
        }

        if (redisData) {
          foundKey = cacheKey;
          console.log('🚦 Redis API: Cache hit', { cacheKey, length: redisData.length });
          break;
        }
      }
      
      if (redisData) break;
    }
    
    if (redisData) {
      let parsedData: any = null;
      const trimmed = redisData.trim();

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          parsedData = JSON.parse(redisData);
          console.log('🚦 Redis API: Parsed JSON payload', {
            keys: typeof parsedData === 'object' && parsedData !== null ? Object.keys(parsedData) : [],
          });
        } catch (error) {
          console.warn('🚦 Redis API: Failed to parse JSON, treating as raw content', error);
        }
      } else {
        console.log('🚦 Redis API: Redis value is not JSON, using raw content');
      }

      let rawContent = typeof parsedData?.content === 'string' ? parsedData.content : redisData;
      
      // Handle the uploaded file format with base64 content
      if (typeof parsedData?.content === 'string') {
        const looksBase64 = /^[A-Za-z0-9+/=\s]+$/.test(parsedData.content);
        if (looksBase64) {
          try {
            rawContent = Buffer.from(parsedData.content.replace(/\s/g, ''), 'base64').toString('utf-8');
            console.log('🚦 Redis API: Decoded base64 content', { length: rawContent.length });
          } catch (error) {
            console.warn('🚦 Redis API: Failed to decode base64 content, falling back to original string', error);
            rawContent = parsedData.content;
          }
        } else {
          console.log('🚦 Redis API: Content field is not base64, using raw string');
          rawContent = parsedData.content;
        }
      }

      // Check if we have content to parse (either from parsedData.content or rawContent)
      const hasContent = parsedData?.content || (rawContent && rawContent.length > 100);
      
      if (hasContent) {
        // Decode base64 content and parse as CSV
        let csvContent = rawContent;
        
        // If rawContent looks like base64, decode it
        if (typeof rawContent === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(rawContent.trim()) && rawContent.length > 50) {
          try {
            csvContent = Buffer.from(rawContent.replace(/\s/g, ''), 'base64').toString('utf-8');
            console.log('🚦 Redis API: Decoded base64 rawContent to CSV', { 
              originalLength: rawContent.length,
              decodedLength: csvContent.length 
            });
          } catch (error) {
            console.warn('🚦 Redis API: Failed to decode rawContent as base64, using as-is', error);
          }
        }
        
        const lines = csvContent.trim().split('\n');
        
        console.log('🚦 Redis API: Parsing CSV content', { 
          lineCount: lines.length,
          firstLine: lines[0]?.substring(0, 100),
          secondLine: lines[1]?.substring(0, 100),
          thirdLine: lines[2]?.substring(0, 100),
          requestedKeyword: keywordList[0]
        });
        
        // Parse the CSV data - skip the header row (line 0) and column header row (line 1)
        // Line 0: "keyword"   isPartial
        // Line 1: date
        // Line 2+: date value False
        const data = lines.slice(2).map((line, idx) => {
          const values = line.split(/\s+/).filter(v => v.trim());
          const row: any = {};
          
          // The first column is always the date
          if (values[0]) {
            row.date = values[0];
          }
          
          // The second column is the trend value
          if (values[1]) {
            // Use the normalized keyword (no spaces) for the row key
            row[keywordList[0]] = parseInt(values[1]) || 0;
          }
          
          if (idx < 3) {
            console.log(`🚦 Redis API: Parsed row ${idx}:`, { line, values, row });
          }
          
          return row;
        }).filter(row => {
          const hasDate = !!row.date;
          const hasValue = row[keywordList[0]] !== undefined;
          if (!hasDate || !hasValue) {
            console.warn('🚦 Redis API: Filtered out row:', row);
          }
          return hasDate && hasValue;
        });
        
        console.log('🚦 Redis API: CSV parsing complete', { 
          totalRows: data.length,
          sampleRows: data.slice(0, 3)
        });
        
        return NextResponse.json({
          success: true,
          data: data,
          keywords: keywordList,
          timestamp: parsedData?.metadata?.uploadedAt || new Date().toISOString(),
          metadata: parsedData?.metadata,
          note: 'Data from Redis cache',
          source: 'redis',
          cacheKey: foundKey,
          rawContent
        });
      }
      
      // Handle the old format if it exists
      // Ensure data is always an array
      let dataArray: any[] = [];
      
      // First, try to get data from parsedData
      if (parsedData) {
        if (Array.isArray(parsedData)) {
          // parsedData itself is an array
          dataArray = parsedData;
        } else if (Array.isArray(parsedData.data)) {
          // parsedData.data is an array
          dataArray = parsedData.data;
        } else if (parsedData && typeof parsedData === 'object') {
          // parsedData is an object, check for common array properties
          const possibleArrayKeys = ['data', 'values', 'timeline', 'timelineData', 'results'];
          for (const key of possibleArrayKeys) {
            if (Array.isArray(parsedData[key])) {
              dataArray = parsedData[key];
              break;
            }
          }
          
          // If still no array found, check if it's a single data point object
          if (dataArray.length === 0 && ('date' in parsedData || 'time' in parsedData)) {
            dataArray = [parsedData];
          }
        }
      }
      
      // If we still don't have an array, log warning and return empty array
      if (!Array.isArray(dataArray)) {
        console.warn('🚦 Redis API: Could not extract array data from Redis response', {
          parsedDataType: typeof parsedData,
          isArray: Array.isArray(parsedData),
          hasData: parsedData && typeof parsedData === 'object' && 'data' in parsedData,
          parsedDataKeys: parsedData && typeof parsedData === 'object' ? Object.keys(parsedData) : [],
          redisDataType: typeof redisData,
          redisDataPreview: typeof redisData === 'string' ? redisData.substring(0, 200) : 'not a string',
        });
        dataArray = [];
      }
      
      const responsePayload = {
        success: true,
        data: dataArray,
        keywords: parsedData?.keywords || keywordList,
        timestamp: parsedData?.timestamp || parsedData?.metadata?.uploadedAt || new Date().toISOString(),
        metadata: parsedData?.metadata,
        note: 'Data from Redis cache',
        source: 'redis' as const,
        cacheKey: foundKey,
        rawContent: typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent),
      };

      console.log('🚦 Redis API: Returning parsed payload summary', {
        hasDataArray: Array.isArray(responsePayload.data),
        dataType: typeof responsePayload.data,
        dataLength: Array.isArray(responsePayload.data) ? responsePayload.data.length : 0,
      });

      return NextResponse.json({
        ...responsePayload,
      });
    }
    
    // No cache found - return error instead of fetching from Google Trends
    console.warn('🚦 Redis API: No cached data found, gathering key diagnostics');
    try {
      const availableKeys = await redis.keys('cache-trends:Trends.*');
      console.warn('🚦 Redis API: Available cache keys', {
        total: availableKeys.length,
        sample: availableKeys.slice(0, 20),
      });
    } catch (error) {
      console.error('🚦 Redis API: Failed to list cache keys', error);
    }

    return NextResponse.json({
      success: false,
      error: 'No cached data found in Redis',
      details: `No cached data available for keywords: ${keywordList.join(', ')}`,
      keywords: keywordList,
      source: 'redis'
    }, { status: 404 });

  } catch (error) {
    console.error('Redis trends API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Redis connection error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        source: 'redis'
      },
      { status: 500 }
    );
  }
}
