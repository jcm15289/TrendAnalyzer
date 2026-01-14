import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    console.log('[REGENERATE-ALL] Request received');
    
    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Get all keyword sets from Redis
    const redis = await getRedisClient();
    if (!redis) {
      return NextResponse.json(
        { success: false, error: 'Redis connection unavailable' },
        { status: 503 }
      );
    }
    
    const keywordsData = await redis.get('gui-keywords');
    if (!keywordsData) {
      return NextResponse.json(
        { success: false, error: 'No keywords found in Redis' },
        { status: 404 }
      );
    }
    
    const parsedData = JSON.parse(keywordsData);
    const keywordSets: string[][] = parsedData.keywordSets || [];
    
    if (keywordSets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No keyword sets found',
        count: 0
      });
    }
    
    console.log(`[REGENERATE-ALL] Found ${keywordSets.length} keyword sets to regenerate`);
    
    // Helper function to fetch trend data from Redis
    const fetchTrendDataFromRedis = async (keywords: string[]): Promise<any | null> => {
      try {
        const keywordsStr = keywords.join(',');
        const apiUrl = keywords.length === 1 
          ? `${baseUrl}/api/trends/redis?keywords=${encodeURIComponent(keywordsStr)}`
          : `${baseUrl}/api/trends?keywords=${encodeURIComponent(keywordsStr)}`;
        
        const response = await fetch(apiUrl, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          console.log(`[REGENERATE-ALL] Failed to fetch trend data for ${keywordsStr}: ${response.status}`);
          return null;
        }
        
        const result = await response.json();
        if (result.success && result.data) {
          return result;
        }
        return null;
      } catch (error) {
        console.error(`[REGENERATE-ALL] Error fetching trend data for ${keywords.join(', ')}:`, error);
        return null;
      }
    };
    
    // Helper function to regenerate explanation in background
    const regenerateExplanationInBackground = async (keywords: string[], trendData: any): Promise<void> => {
      try {
        console.log(`[REGENERATE-ALL] 🔄 Regenerating explanation for ${keywords.join(', ')}`);
        const response = await fetch(`${baseUrl}/api/explain-trend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords,
            trendData,
            regenerate: true // Force regeneration
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`[REGENERATE-ALL] ✅ Regenerated explanation for ${keywords.join(', ')}`, {
            success: result.success,
            cached: result.cached
          });
        } else {
          const errorText = await response.text();
          console.error(`[REGENERATE-ALL] ❌ Failed to regenerate explanation for ${keywords.join(', ')}: ${response.status}`, errorText);
        }
      } catch (error) {
        console.error(`[REGENERATE-ALL] ❌ Error regenerating explanation for ${keywords.join(', ')}:`, error);
      }
    };
    
    // Process all keyword sets in background (fire and forget)
    const regenerationPromises = keywordSets.map(async (keywords) => {
      try {
        // Fetch trend data
        const trendDataResult = await fetchTrendDataFromRedis(keywords);
        if (trendDataResult && trendDataResult.data) {
          // Transform data format if needed (similar to explain-trend route)
          let trendData = trendDataResult.data;
          if (trendData.timelineData && Array.isArray(trendData.timelineData) && trendData.timelineData.length > 0) {
            const firstPoint = trendData.timelineData[0];
            // Check if this is Redis format
            if (firstPoint && 'date' in firstPoint && !('time' in firstPoint || 'formattedTime' in firstPoint)) {
              // Transform Redis format to expected format
              const dateMap = new Map<string, any>();
              trendData.timelineData.forEach((point: any) => {
                const date = point.date;
                if (!date) return;
                if (!dateMap.has(date)) {
                  dateMap.set(date, {
                    time: date,
                    formattedTime: date,
                    formattedAxisTime: date,
                    value: []
                  });
                }
                keywords.forEach((keyword, idx) => {
                  const value = point[keyword];
                  if (value !== undefined) {
                    dateMap.get(date)!.value[idx] = value;
                  }
                });
              });
              const transformedTimeline = Array.from(dateMap.values())
                .map(point => ({
                  ...point,
                  value: keywords.map((keyword, idx) => point.value[idx] ?? 0)
                }));
              trendData = {
                ...trendData,
                timelineData: transformedTimeline
              };
            }
          }
          
          // Regenerate explanation in background
          await regenerateExplanationInBackground(keywords, trendData);
        } else {
          console.log(`[REGENERATE-ALL] ⚠️ Could not fetch trend data for ${keywords.join(', ')}, skipping regeneration`);
        }
      } catch (error) {
        console.error(`[REGENERATE-ALL] ❌ Error processing ${keywords.join(', ')}:`, error);
      }
    });
    
    // Fire off all regenerations without waiting (truly async)
    Promise.all(regenerationPromises).catch(error => {
      console.error('[REGENERATE-ALL] Error in background regeneration:', error);
    });
    
    console.log(`[REGENERATE-ALL] 🔄 Started ${keywordSets.length} background regeneration tasks`);
    
    return NextResponse.json({
      success: true,
      message: `Started regeneration for ${keywordSets.length} keyword sets`,
      count: keywordSets.length,
      keywordSets: keywordSets.map(ks => ks.join(', '))
    });
    
  } catch (error) {
    console.error('[REGENERATE-ALL] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


