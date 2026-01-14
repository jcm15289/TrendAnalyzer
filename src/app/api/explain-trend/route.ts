import { NextRequest, NextResponse } from 'next/server';
import { buildTrendExplanationPrompt } from '@/lib/trend-explanation';
import { getRedisClient } from '@/lib/redis';
import { detectPeaks, extractPeakExplanation, Peak } from '@/lib/peak-detection';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Normalize keywords for consistent cache keys (case-insensitive, trimmed)
function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0).sort();
}

// Generate a cache key from keywords
function generateCacheKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  const key = `explain-trend:${hash}`;
  console.log('[CACHE-KEY] Generated cache key', {
    originalKeywords: keywords,
    normalizedKeywords: normalized,
    hash,
    key,
  });
  return key;
}

// Generate a cache key for peak summaries
function generatePeakSummariesKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  const key = `peak-summaries:${hash}`;
  console.log('[CACHE-KEY] Generated peak summaries key', {
    originalKeywords: keywords,
    normalizedKeywords: normalized,
    hash,
    key,
  });
  return key;
}

export async function POST(request: NextRequest) {
  let cacheKey: string | null = null;
  
  try {
    console.log('[GEMINI] explain-trend: POST request received');
    console.log('[GEMINI] explain-trend: Content-Type:', request.headers.get('content-type'));
    console.log('[GEMINI] explain-trend: Content-Length:', request.headers.get('content-length'));
    
    let requestBody;
    try {
      console.log('[GEMINI] explain-trend: Attempting to parse request body...');
      requestBody = await request.json();
      console.log('[GEMINI] explain-trend: Request body parsed successfully');
      console.log('[GEMINI] explain-trend: Request body keys:', Object.keys(requestBody));
    } catch (parseError) {
      console.error('[GEMINI] explain-trend: failed to parse request body', parseError);
      console.error('[GEMINI] explain-trend: Parse error details:', {
        message: parseError instanceof Error ? parseError.message : 'Unknown',
        stack: parseError instanceof Error ? parseError.stack : 'No stack',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { keywords, trendData, regenerate } = requestBody;

    console.log('[GEMINI] explain-trend: incoming request', {
      keywords,
      keywordCount: Array.isArray(keywords) ? keywords.length : 0,
      hasTrendData: Boolean(trendData),
      trendDataType: typeof trendData,
      trendDataKeys: trendData ? Object.keys(trendData).slice(0, 10) : [],
      timelinePoints: trendData?.timelineData?.length ?? 0,
      timelineDataType: Array.isArray(trendData?.timelineData) ? 'array' : typeof trendData?.timelineData,
      regenerate: Boolean(regenerate),
    });

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Keywords array is required' },
        { status: 400 }
      );
    }

    if (!trendData || !trendData.timelineData) {
      return NextResponse.json(
        { success: false, error: 'Trend data is required' },
        { status: 400 }
      );
    }

    // Transform Redis format to expected format if needed
    // Redis format: [{date, keyword: value}, ...]
    // Expected format: [{time, formattedTime, formattedAxisTime, value: [value1, value2, ...]}, ...]
    let transformedTrendData = trendData;
    if (trendData.timelineData && Array.isArray(trendData.timelineData) && trendData.timelineData.length > 0) {
      const firstPoint = trendData.timelineData[0];
      // Check if this is Redis format (has 'date' field instead of 'time'/'formattedTime')
      if (firstPoint && 'date' in firstPoint && !('time' in firstPoint || 'formattedTime' in firstPoint)) {
        console.log('[GEMINI] explain-trend: Detected Redis format, transforming data...');
        // Group by date and collect values for each keyword
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
          
          // Add values for each keyword
          keywords.forEach((keyword, idx) => {
            const value = point[keyword];
            if (value !== undefined) {
              dateMap.get(date)!.value[idx] = value;
            }
          });
        });
        
        // Convert map to array
        const transformedTimeline = Array.from(dateMap.values())
          .map(point => ({
            ...point,
            value: keywords.map((keyword, idx) => point.value[idx] ?? 0)
          }));
        
        transformedTrendData = {
          ...trendData,
          timelineData: transformedTimeline
        };
        
        console.log('[GEMINI] explain-trend: Data transformed', {
          originalPoints: trendData.timelineData.length,
          transformedPoints: transformedTimeline.length,
          sampleOriginal: trendData.timelineData[0],
          sampleTransformed: transformedTimeline[0],
        });
      }
    }

    // Prepare timeline data first (needed for both cache check and peak generation)
    const {
      sanitisedTimeline,
    } = buildTrendExplanationPrompt(keywords, transformedTrendData);

    // Check cache unless regenerate is requested
    cacheKey = generateCacheKey(keywords);
    let cachedResult = null;
    
    if (!regenerate) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const cached = await redis.get(cacheKey);
          if (cached) {
            try {
              cachedResult = JSON.parse(cached);
              
              // Also fetch peak summaries if available
              let peakSummaries: any[] = [];
              if (keywords.length === 1) {
                try {
                  const peakSummariesKey = generatePeakSummariesKey(keywords);
                  console.log('[GEMINI] explain-trend: Fetching peak summaries from cache', {
                    peakSummariesKey,
                    keywords,
                  });
                  const cachedPeakSummaries = await redis.get(peakSummariesKey);
                  if (cachedPeakSummaries) {
                    peakSummaries = JSON.parse(cachedPeakSummaries);
                    console.log('[GEMINI] explain-trend: ✅ peak summaries cache hit', {
                      peakSummariesKey,
                      peakCount: peakSummaries.length,
                      sampleSummaries: peakSummaries.slice(0, 2).map((p: any) => ({ date: p.date, summary: p.summary })),
                    });
                  } else {
                    console.log('[GEMINI] explain-trend: ⚠️ peak summaries cache miss', {
                      peakSummariesKey,
                      keywords,
                    });
                    // If explanation exists but peak summaries don't, try to generate them from cached explanation
                    // Use sanitisedTimeline that was prepared above
                    if (cachedResult.explanation && sanitisedTimeline.length > 0) {
                      console.log('[GEMINI] explain-trend: Attempting to generate peak summaries from cached explanation');
                      try {
                        // Rebuild sanitised timeline from trendData
                        const rawTimeline = Array.isArray(trendData.timelineData) ? trendData.timelineData : [];
                        const tempSanitisedTimeline = rawTimeline.map((point: any, index: number) => {
                          const valuesArray = Array.isArray(point?.value)
                            ? point.value.map((val: any) => {
                                const parsed = Number(val);
                                return Number.isFinite(parsed) ? parsed : 0;
                              })
                            : [Number(point?.value) || 0];
                          return {
                            index,
                            time: point?.time ?? null,
                            formattedTime: point?.formattedTime ?? null,
                            formattedAxisTime: point?.formattedAxisTime ?? null,
                            values: valuesArray,
                          };
                        });
                        
                        const resolveDateString = (point: any): string | null => {
                          if (point?.formattedTime) return String(point.formattedTime);
                          if (point?.formattedAxisTime) return String(point.formattedAxisTime);
                          if (point?.time !== null && point?.time !== undefined) return String(point.time);
                          return null;
                        };
                        
                        const chartData = tempSanitisedTimeline
                          .map((point, idx) => {
                            const dateStr = resolveDateString(point);
                            // SanitisedPoint has values array (plural), not value
                            const value = Array.isArray(point.values) && point.values.length > 0 
                              ? point.values[0] 
                              : (typeof point.values === 'number' ? point.values : 0);
                            return dateStr ? {
                              date: dateStr,
                              [keywords[0]]: value,
                            } : null;
                          })
                          .filter((d): d is { date: string; [key: string]: number } => d !== null);
                        
                        const peaks = detectPeaks(chartData, keywords[0], 15, 3);
                        
                        // Extract ALL peak dates from the cached explanation (not just detected peaks)
                        const allPeakDatesPattern = /### PEAK:\s*(\d{4}-\d{2}-\d{2})/gi;
                        const explanationPeakDates: Array<{ date: string; matchIndex: number }> = [];
                        let match;
                        while ((match = allPeakDatesPattern.exec(cachedResult.explanation)) !== null) {
                          explanationPeakDates.push({
                            date: match[1],
                            matchIndex: match.index
                          });
                        }
                        
                        const detectedPeaksByDate = new Map<string, Peak>();
                        peaks.forEach(peak => {
                          const dateKey = peak.date.split('T')[0];
                          detectedPeaksByDate.set(dateKey, peak);
                        });
                        
                        const allPeakSummaries: Array<{ date: string; keyword: string; value: number; summary: string }> = [];
                        
                        // Process all peaks mentioned in explanation
                        for (const explanationPeak of explanationPeakDates) {
                          const peakDate = explanationPeak.date;
                          let matchedPeak: Peak | null = detectedPeaksByDate.get(peakDate) || null;
                          let chartValue = 0;
                          
                          if (!matchedPeak) {
                            const targetDate = new Date(peakDate);
                            let closestPoint: { date: string; [key: string]: number } | null = null;
                            let minDiff = Infinity;
                            
                            for (const point of chartData) {
                              const pointDate = new Date(point.date);
                              const diff = Math.abs(pointDate.getTime() - targetDate.getTime());
                              if (diff < minDiff) {
                                minDiff = diff;
                                closestPoint = point;
                              }
                            }
                            
                            if (closestPoint && minDiff < 14 * 24 * 60 * 60 * 1000) {
                              chartValue = Number(closestPoint[keywords[0]]) || 0;
                              matchedPeak = {
                                date: closestPoint.date,
                                value: chartValue,
                                keyword: keywords[0],
                                index: chartData.indexOf(closestPoint)
                              };
                            }
                          } else {
                            chartValue = matchedPeak.value;
                          }
                          
                          if (!matchedPeak) continue;
                          
                          const summary = extractPeakExplanation(cachedResult.explanation, matchedPeak.date, 15);
                          if (!summary || summary.length === 0) continue;
                          
                          const lowerSummary = summary.toLowerCase();
                          if (
                            lowerSummary.includes('google trends') ||
                            lowerSummary.includes('search interest') ||
                            lowerSummary.includes('search volume') ||
                            lowerSummary.includes('peak') ||
                            lowerSummary.includes('keyword') ||
                            lowerSummary.includes('analysis') ||
                            lowerSummary.includes('here\'s')
                          ) {
                            continue;
                          }
                          
                          allPeakSummaries.push({
                            date: matchedPeak.date,
                            keyword: keywords[0],
                            value: chartValue,
                            summary: summary.trim(),
                          });
                        }
                        
                        // Also add detected peaks not in explanation
                        const explanationPeakDateSet = new Set(explanationPeakDates.map(p => p.date));
                        const existingDates = new Set(allPeakSummaries.map(p => p.date.split('T')[0]));
                        
                        for (const peak of peaks) {
                          const dateKey = peak.date.split('T')[0];
                          if (explanationPeakDateSet.has(dateKey) || existingDates.has(dateKey)) {
                            continue;
                          }
                          
                          const summary = extractPeakExplanation(cachedResult.explanation, peak.date, 15);
                          if (!summary || summary.length === 0) continue;
                          
                          const lowerSummary = summary.toLowerCase();
                          if (
                            lowerSummary.includes('google trends') ||
                            lowerSummary.includes('search interest') ||
                            lowerSummary.includes('search volume') ||
                            lowerSummary.includes('peak') ||
                            lowerSummary.includes('keyword') ||
                            lowerSummary.includes('analysis') ||
                            lowerSummary.includes('here\'s')
                          ) {
                            continue;
                          }
                          
                          allPeakSummaries.push({
                            date: peak.date,
                            keyword: keywords[0],
                            value: peak.value,
                            summary: summary.trim(),
                          });
                        }
                        
                        peakSummaries = allPeakSummaries;
                        
                        // Store the generated peak summaries (no expiration) - ALWAYS store even if empty
                        await redis.set(peakSummariesKey, JSON.stringify(peakSummaries));
                        console.log('[GEMINI] explain-trend: ✅ Generated and cached peak summaries from cached explanation (no expiration)', {
                          peakSummariesKey,
                          peakCount: peakSummaries.length,
                          stored: true,
                        });
                      } catch (genError) {
                        console.warn('[GEMINI] explain-trend: Failed to generate peak summaries from cached explanation', genError);
                      }
                    }
                  }
                } catch (peakError) {
                  console.error('[GEMINI] explain-trend: ❌ failed to fetch cached peak summaries', peakError);
                }
              }
              
              console.log('[GEMINI] explain-trend: cache hit', {
                cacheKey,
                cachedAt: cachedResult.generatedAt,
                peakSummariesCount: peakSummaries.length,
                hasPeakSummaries: peakSummaries.length > 0,
              });
              return NextResponse.json({
                ...cachedResult,
                peakSummaries: peakSummaries, // Include peak summaries from cache
                peakSummariesCount: peakSummaries.length,
                cached: true,
              });
            } catch (parseError) {
              console.warn('[GEMINI] explain-trend: failed to parse cached result', parseError);
              // Continue to generate new explanation
            }
          } else {
            console.log('[GEMINI] explain-trend: cache miss', { cacheKey });
          }
        }
      } catch (cacheError) {
        console.warn('[GEMINI] explain-trend: cache check failed, continuing', cacheError);
        // Continue to generate new explanation even if cache fails
      }
    } else {
      console.log('[GEMINI] explain-trend: regenerate requested, bypassing cache', { cacheKey });
      // Delete cache if regenerate is requested
      try {
        const redis = await getRedisClient();
        if (redis) {
          await redis.del(cacheKey);
          console.log('[GEMINI] explain-trend: cache deleted for regenerate', { cacheKey });
          
          // Also delete peak summaries cache
          if (keywords.length === 1) {
            const peakSummariesKey = generatePeakSummariesKey(keywords);
            await redis.del(peakSummariesKey);
            console.log('[GEMINI] explain-trend: peak summaries cache deleted for regenerate', { peakSummariesKey });
          }
        }
      } catch (deleteError) {
        console.warn('[GEMINI] explain-trend: failed to delete cache', deleteError);
      }
    }

    // Get Gemini API key from environment (fall back to configured runtime default)
    const geminiApiKey =
      process.env.GEMINI_API_KEY ??
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ??
      process.env.GOOGLE_GEMINI_API_KEY ??
      'AIzaSyAEqSr2vgcTW7N0yr2Tji6ALDAE88D5jWI';
    if (!geminiApiKey) {
      console.error('[GEMINI] explain-trend: missing API key');
      return NextResponse.json(
        { success: false, error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Prepare the data for Gemini (reuse sanitisedTimeline from above, get full result)
    const {
      prompt,
      sanitisedTimeline: sanitisedTimelineForPrompt,
      significantPoints,
      timelineEntries,
      startDate,
      endDate,
    } = buildTrendExplanationPrompt(keywords, transformedTrendData);
    
    // Use the sanitisedTimeline from the prompt builder (guaranteed to be in scope)
    const finalSanitisedTimeline = sanitisedTimelineForPrompt;

    console.log('[GEMINI] explain-trend: prompt prepared', {
      promptChars: prompt.length,
      promptLines: prompt.split('\n').length,
      sanitisedTimelinePoints: finalSanitisedTimeline.length,
      timelineEntriesCount: timelineEntries.length,
      significantPointCount: significantPoints.length,
      dateRange: { startDate, endDate },
    });
    if (timelineEntries.length > 0) {
      console.log('[GEMINI] explain-trend: preview first timeline entry', timelineEntries[0]);
    }
    
    // Log detailed info about sanitisedTimeline structure for debugging
    console.log('[GEMINI] explain-trend: ========== SANITISED TIMELINE DEBUG ==========');
    console.log('[GEMINI] explain-trend: sanitisedTimeline length:', finalSanitisedTimeline.length);
    if (finalSanitisedTimeline.length > 0) {
      const first3 = finalSanitisedTimeline.slice(0, 3);
      console.log('[GEMINI] explain-trend: First 3 sanitised points:');
      first3.forEach((point, idx) => {
        console.log(`  Point ${idx}:`, {
          index: point.index,
          time: point.time,
          timeType: typeof point.time,
          formattedTime: point.formattedTime,
          formattedTimeType: typeof point.formattedTime,
          formattedAxisTime: point.formattedAxisTime,
          formattedAxisTimeType: typeof point.formattedAxisTime,
          values: point.values,
          valuesLength: point.values?.length,
        });
      });
    }
    console.log('[GEMINI] explain-trend: ========== END SANITISED TIMELINE DEBUG ==========');

    console.log('🚀 Trend explanation payload prepared', {
      keywords,
      points: finalSanitisedTimeline.length,
      startDate,
      endDate,
      significantPointCount: significantPoints.length,
    });

    // Call Gemini API with Google Search grounding enabled
    console.log('[GEMINI] explain-trend: issuing request to Gemini API with Google Search grounding');
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          tools: [{
            googleSearch: {}
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        })
      }
    );
    console.log('[GEMINI] explain-trend: response received', {
      status: geminiResponse.status,
      statusText: geminiResponse.statusText,
      ok: geminiResponse.ok,
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[GEMINI] explain-trend: API error payload', errorText);
      let errorMessage = 'Failed to get explanation from Gemini API';
      let errorDetails = '';
      
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || errorJson.message || errorText;
        console.error('[GEMINI] explain-trend: parsed error details', {
          status: geminiResponse.status,
          error: errorJson.error,
          message: errorJson.message,
          details: errorDetails,
        });
      } catch {
        errorDetails = errorText.substring(0, 200); // Limit length
      }
      
      // Provide more specific error messages based on status code
      if (geminiResponse.status === 401 || geminiResponse.status === 403) {
        errorMessage = 'Gemini API authentication failed. Please check your API key.';
      } else if (geminiResponse.status === 429) {
        errorMessage = 'Gemini API rate limit exceeded. Please try again later.';
      } else if (geminiResponse.status === 400) {
        errorMessage = `Gemini API request error: ${errorDetails || 'Invalid request format'}`;
      } else if (geminiResponse.status >= 500) {
        errorMessage = 'Gemini API server error. Please try again later.';
      } else {
        errorMessage = `Gemini API error (${geminiResponse.status}): ${errorDetails || 'Unknown error'}`;
      }
      
      return NextResponse.json(
        { success: false, error: errorMessage, details: errorDetails },
        { status: 500 }
      );
    }

    let geminiData = await geminiResponse.json();
    let candidate = geminiData?.candidates?.[0];
    
    // Check if Gemini wants to call functions (like search)
    // If so, we need to handle function calls and continue the conversation
    let conversationHistory: any[] = [{
      parts: [{ text: prompt }]
    }];
    
    // Handle function calls if present
    let maxIterations = 3; // Prevent infinite loops
    let iteration = 0;
    
    while (candidate?.content?.parts?.some((part: any) => part.functionCall) && iteration < maxIterations) {
      iteration++;
      console.log(`[GEMINI] explain-trend: handling function call iteration ${iteration}`);
      
      const functionCalls = candidate.content.parts
        .filter((part: any) => part.functionCall)
        .map((part: any) => part.functionCall);
      
      console.log('[GEMINI] explain-trend: function calls detected', {
        functionCallCount: functionCalls.length,
        functionCalls: functionCalls.map((fc: any) => ({
          name: fc.name,
          args: fc.args,
        })),
      });
      
      // Add the function calls to conversation history
      conversationHistory.push({
        parts: candidate.content.parts
      });
      
      // For googleSearch, Gemini handles it automatically, but we need to continue the conversation
      // Add a response indicating we're waiting for search results
      conversationHistory.push({
        parts: [{
          text: 'Please proceed with the search and provide the complete analysis with the search results included.'
        }]
      });
      
      // Continue the conversation
      const continueResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: conversationHistory,
            tools: [{
              googleSearch: {}
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          })
        }
      );
      
      if (!continueResponse.ok) {
        const errorText = await continueResponse.text();
        console.error('[GEMINI] explain-trend: continue conversation error', {
          status: continueResponse.status,
          statusText: continueResponse.statusText,
          errorText,
        });
        // Don't break immediately - try to get partial response if available
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[GEMINI] explain-trend: parsed continue error', errorJson);
        } catch {
          // Not JSON, use text as-is
        }
        break;
      }
      
      geminiData = await continueResponse.json();
      candidate = geminiData?.candidates?.[0];
      
      // Check if we got a final response (no more function calls)
      const hasMoreFunctionCalls = candidate?.content?.parts?.some((part: any) => part.functionCall);
      if (!hasMoreFunctionCalls) {
        console.log('[GEMINI] explain-trend: received final response after function calls');
        break;
      }
    }
    
    const citationMetadata = candidate?.citationMetadata;
    const groundingMetadata = candidate?.groundingMetadata;
    const searchQueriesUsed = groundingMetadata?.webSearchQueries ?? [];
    const citationsUsed = citationMetadata?.citations ?? [];
    
    console.log('[GEMINI] explain-trend: parsed response summary', {
      hasCandidates: Boolean(geminiData?.candidates?.length),
      hasCitationMetadata: Boolean(citationMetadata),
      hasGroundingMetadata: Boolean(groundingMetadata),
      searchQueriesCount: searchQueriesUsed.length,
      citationsCount: citationsUsed.length,
      searchQueries: searchQueriesUsed,
      citations: citationsUsed.map((c: any) => ({
        startIndex: c.startIndex,
        endIndex: c.endIndex,
        uri: c.uri,
        title: c.title,
      })),
      safetyRatings: candidate?.safetyRatings,
      iterations: iteration,
    });
    
    if (!candidate || !candidate.content) {
      console.error('[GEMINI] explain-trend: missing content in response');
      return NextResponse.json(
        { success: false, error: 'Invalid response from Gemini API' },
        { status: 500 }
      );
    }

    // Get the final text response
    const textParts = candidate.content.parts.filter((part: any) => part.text);
    let explanation = textParts.length > 0 
      ? textParts.map((part: any) => part.text).join('\n\n')
      : 'No explanation generated';
    
    const usedSearchGrounding = searchQueriesUsed.length > 0 || citationsUsed.length > 0;
    
    // Check if response says it will search but hasn't actually searched
    const saysWillSearch = /will (search|use google|look up|find)/i.test(explanation) || 
                          /going to (search|use google|look up|find)/i.test(explanation);
    
    if (saysWillSearch && !usedSearchGrounding && iteration === 0) {
      console.log('[GEMINI] explain-trend: response indicates search will happen but hasn\'t executed, making follow-up call');
      
      // Make a follow-up call that explicitly requests the search results
      const followUpPrompt = `${prompt}\n\nYou mentioned you will search, but please execute the search NOW and provide the complete analysis with the search results included. Do not say you will search - actually perform the search and include the results.`;
      
      const followUpResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: followUpPrompt }]
            }],
            tools: [{
              googleSearch: {}
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            }
          })
        }
      );
      
      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        const followUpCandidate = followUpData?.candidates?.[0];
        const followUpCitationMetadata = followUpCandidate?.citationMetadata;
        const followUpGroundingMetadata = followUpCandidate?.groundingMetadata;
        const followUpSearchQueries = followUpGroundingMetadata?.webSearchQueries ?? [];
        const followUpCitations = followUpCitationMetadata?.citations ?? [];
        
        if (followUpCandidate?.content) {
          const followUpTextParts = followUpCandidate.content.parts.filter((part: any) => part.text);
          if (followUpTextParts.length > 0) {
            explanation = followUpTextParts.map((part: any) => part.text).join('\n\n');
            const followUpUsedSearch = followUpSearchQueries.length > 0 || followUpCitations.length > 0;
            
            console.log('[GEMINI] explain-trend: follow-up response received', {
              usedSearchGrounding: followUpUsedSearch,
              searchQueries: followUpSearchQueries.length > 0 ? followUpSearchQueries : 'none',
              citationsFound: followUpCitations.length,
            });
            
            // Update the search grounding info with follow-up results
            if (followUpUsedSearch) {
              searchQueriesUsed.push(...followUpSearchQueries);
              citationsUsed.push(...followUpCitations);
            }
          }
        }
      }
    }
    
    const finalUsedSearchGrounding = searchQueriesUsed.length > 0 || citationsUsed.length > 0;
    
    console.log('[GEMINI] explain-trend: explanation generated', {
      explanationChars: explanation?.length ?? 0,
      excerpt: explanation?.slice(0, 200),
      usedSearchGrounding: finalUsedSearchGrounding,
      searchQueriesUsed: searchQueriesUsed.length > 0 ? searchQueriesUsed : 'none',
      citationsFound: citationsUsed.length,
      citations: citationsUsed.length > 0 ? citationsUsed.slice(0, 3).map((c: any) => ({
        title: c.title,
        uri: c.uri?.substring(0, 80),
      })) : 'none',
      iterations: iteration,
      madeFollowUpCall: saysWillSearch && !usedSearchGrounding && iteration === 0,
      summaryGenerationMethod: finalUsedSearchGrounding ? 'FROM SEARCH RESULTS' : 'NO SEARCH GROUNDING USED',
    });

    // Detect peaks and extract summaries (only for single keyword)
    let peakSummaries: Array<{ date: string; keyword: string; value: number; summary: string }> = [];
    
    console.log('[GEMINI] explain-trend: ========== PEAK DETECTION CHECK ==========');
    console.log('[GEMINI] explain-trend: Peak detection conditions:', {
      keywordsLength: keywords.length,
      isSingleKeyword: keywords.length === 1,
      hasExplanation: !!explanation,
      explanationLength: explanation?.length || 0,
      timelineLength: finalSanitisedTimeline.length,
      allConditionsMet: keywords.length === 1 && !!explanation && finalSanitisedTimeline.length > 0,
    });
    
    if (keywords.length === 1 && explanation && finalSanitisedTimeline.length > 0) {
      console.log('[GEMINI] explain-trend: ✅ All conditions met, starting peak detection');
      console.log('[GEMINI] explain-trend: finalSanitisedTimeline sample:', {
        length: finalSanitisedTimeline.length,
        firstPoint: finalSanitisedTimeline[0] ? {
          index: finalSanitisedTimeline[0].index,
          time: finalSanitisedTimeline[0].time,
          formattedTime: finalSanitisedTimeline[0].formattedTime,
          formattedAxisTime: finalSanitisedTimeline[0].formattedAxisTime,
          values: finalSanitisedTimeline[0].values,
          valuesLength: finalSanitisedTimeline[0].values?.length,
        } : 'null',
      });
      try {
        // Convert timeline data to chart format for peak detection
        // Use resolveDateString to get consistent date format (matching SanitisedPoint structure)
        const resolveDateString = (point: any): string | null => {
          if (point?.formattedTime) return String(point.formattedTime);
          if (point?.formattedAxisTime) return String(point.formattedAxisTime);
          if (point?.time !== null && point?.time !== undefined) return String(point.time);
          return null;
        };
        
        const chartData = finalSanitisedTimeline
          .map((point, idx) => {
            const dateStr = resolveDateString(point);
            // SanitisedPoint has values array (plural), not value
            const value = Array.isArray(point.values) && point.values.length > 0 
              ? point.values[0] 
              : (typeof point.values === 'number' ? point.values : 0);
            
            if (!dateStr) {
              console.log(`[GEMINI] explain-trend: Skipping point ${idx} - no date resolved`, {
                point: {
                  index: point.index,
                  time: point.time,
                  formattedTime: point.formattedTime,
                  formattedAxisTime: point.formattedAxisTime,
                },
              });
              return null;
            }
            
            return {
              date: dateStr,
              [keywords[0]]: value,
            };
          })
          .filter((d): d is { date: string; [key: string]: number } => d !== null);
        
        // Find max value to understand the data range
        const maxValue = Math.max(...chartData.map(d => Number(d[keywords[0]]) || 0));
        const valuesAbove30 = chartData.filter(d => (Number(d[keywords[0]]) || 0) > 30).length;
        
        console.log('[GEMINI] explain-trend: chart data prepared for peak detection', {
          chartDataLength: chartData.length,
          finalSanitisedTimelineLength: finalSanitisedTimeline.length,
          maxValue,
          valuesAbove30,
          sampleDates: chartData.slice(0, 3).map(d => d.date),
          sampleValues: chartData.slice(0, 3).map(d => d[keywords[0]]),
          lastDates: chartData.slice(-3).map(d => d.date),
          lastValues: chartData.slice(-3).map(d => d[keywords[0]]),
          firstChartPoint: chartData[0] || null,
        });

        // Detect peaks (lower threshold to catch more peaks - using 15 to catch smaller peaks)
        const peaks = detectPeaks(chartData, keywords[0], 15, 3);
        console.log('[GEMINI] explain-trend: detected peaks', {
          peakCount: peaks.length,
          peaks: peaks.map(p => ({ date: p.date, value: p.value, index: p.index })),
          chartDataSample: chartData.slice(0, 5),
        });

        // Extract ALL peak dates from the AI explanation (not just detected peaks)
        // This ensures we capture events mentioned in the explanation even if they're not detected as peaks
        const allPeakDatesPattern = /### PEAK:\s*(\d{4}-\d{2}-\d{2})/gi;
        const explanationPeakDates: Array<{ date: string; matchIndex: number }> = [];
        let match;
        while ((match = allPeakDatesPattern.exec(explanation)) !== null) {
          explanationPeakDates.push({
            date: match[1],
            matchIndex: match.index
          });
        }
        
        console.log('[GEMINI] explain-trend: All peak dates found in explanation', {
          explanationPeakDates: explanationPeakDates.map(p => p.date),
          detectedPeaks: peaks.map(p => p.date.split('T')[0]),
        });

        // Create a map of detected peaks by date for quick lookup
        const detectedPeaksByDate = new Map<string, Peak>();
        peaks.forEach(peak => {
          const dateKey = peak.date.split('T')[0];
          detectedPeaksByDate.set(dateKey, peak);
        });

        // Extract summaries for ALL detected peaks first, then add explanation peaks that weren't detected
        // This ensures we get annotations for all significant peaks
        const allPeakSummaries: Array<{ date: string; keyword: string; value: number; summary: string }> = [];
        
        // Process ALL detected peaks first - try to find explanations for each
        console.log('[GEMINI] explain-trend: Processing all detected peaks to find explanations');
        for (const peak of peaks) {
          const dateKey = peak.date.split('T')[0];
          
          // Try to extract explanation for this detected peak
          // extractPeakExplanation will do flexible date matching within 14 days
          const summary = extractPeakExplanation(explanation, peak.date, 15);
          
          console.log('[GEMINI] explain-trend: Detected peak processing', {
            date: peak.date,
            value: peak.value,
            summaryFound: !!summary,
            summary: summary ? summary.substring(0, 60) : 'NOT FOUND',
          });
          
          if (!summary || summary.length === 0) {
            console.log(`[GEMINI] explain-trend: No EVENT found for detected peak ${peak.date}`);
            continue;
          }
          
          const lowerSummary = summary.toLowerCase();
          if (
            lowerSummary.includes('google trends') ||
            lowerSummary.includes('search interest') ||
            lowerSummary.includes('search volume') ||
            lowerSummary.includes('peak') ||
            lowerSummary.includes('keyword') ||
            lowerSummary.includes('analysis') ||
            lowerSummary.includes('here\'s')
          ) {
            console.log(`[GEMINI] explain-trend: REJECTED detected peak summary: ${summary}`);
            continue;
          }
          
          allPeakSummaries.push({
            date: peak.date,
            keyword: keywords[0],
            value: peak.value,
            summary: summary.trim(),
          });
        }
        
        // Now add explanation peaks that weren't already included (peaks mentioned in explanation but not detected)
        const existingDates = new Set(allPeakSummaries.map(p => p.date.split('T')[0]));
        
        // Also create a map of detected peaks by date (with flexible matching) for finding closest matches
        const detectedPeaksByDateFlexible = new Map<string, Peak>();
        peaks.forEach(peak => {
          const dateKey = peak.date.split('T')[0];
          detectedPeaksByDateFlexible.set(dateKey, peak);
        });
        
        for (const explanationPeak of explanationPeakDates) {
          const peakDate = explanationPeak.date;
          
          // Skip if already processed from detected peaks
          if (existingDates.has(peakDate)) {
            console.log(`[GEMINI] explain-trend: Skipping explanation peak ${peakDate} - already processed from detected peaks`);
            continue;
          }
          
          // Try to find a matching detected peak, or find the closest data point
          let matchedPeak: Peak | null = detectedPeaksByDateFlexible.get(peakDate) || null;
          let chartValue = 0;
          
          if (!matchedPeak) {
            // Try flexible date matching - check if any detected peak is within 14 days
            const targetDate = new Date(peakDate);
            let closestPeak: Peak | null = null;
            let minDiff = Infinity;
            
            for (const peak of peaks) {
              try {
                const peakDateObj = new Date(peak.date);
                const diff = Math.abs(peakDateObj.getTime() - targetDate.getTime());
                if (diff < minDiff && diff < 14 * 24 * 60 * 60 * 1000) {
                  minDiff = diff;
                  closestPeak = peak;
                }
              } catch (e) {
                // Ignore date parsing errors
              }
            }
            
            if (closestPeak) {
              matchedPeak = closestPeak;
              chartValue = closestPeak.value;
            } else {
              // Find closest data point for this date
              const targetDate = new Date(peakDate);
              let closestPoint: { date: string; [key: string]: number } | null = null;
              let minDiff = Infinity;
              
              for (const point of chartData) {
                const pointDate = new Date(point.date);
                const diff = Math.abs(pointDate.getTime() - targetDate.getTime());
                if (diff < minDiff) {
                  minDiff = diff;
                  closestPoint = point;
                }
              }
              
              if (closestPoint && minDiff < 14 * 24 * 60 * 60 * 1000) { // Within 14 days
                chartValue = Number(closestPoint[keywords[0]]) || 0;
                matchedPeak = {
                  date: closestPoint.date,
                  value: chartValue,
                  keyword: keywords[0],
                  index: chartData.indexOf(closestPoint)
                };
              }
            }
          } else {
            chartValue = matchedPeak.value;
          }
          
          if (!matchedPeak) {
            console.log(`[GEMINI] explain-trend: No matching data point found for explanation peak ${peakDate}, skipping`);
            continue;
          }
          
          // Use the explanation date (peakDate) to extract the summary, not the matched peak date
          // This ensures we get the correct event description for this specific date
          const summary = extractPeakExplanation(explanation, peakDate, 15);
          const hasSourceInExplanation = new RegExp(`### PEAK:\\s*${peakDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n\\s*EVENT:[^\\n]+\\n\\s*SOURCE:`, 'i').test(explanation);
          
          console.log('[GEMINI] explain-trend: peak summary extraction', {
            date: matchedPeak.date,
            explanationDate: peakDate,
            value: chartValue,
            summaryFound: !!summary,
            summary: summary || 'NOT FOUND',
            fromSearchResults: hasSourceInExplanation ? 'YES (has SOURCE citation)' : 'UNKNOWN',
            searchGroundingUsed: finalUsedSearchGrounding,
            wasDetectedPeak: detectedPeaksByDate.has(peakDate),
          });
          
          // ONLY use EVENT from structured PEAK EXPLANATIONS (section 2)
          // NEVER create fallback summaries - if no EVENT found, skip this peak
          if (!summary || summary.length === 0) {
            console.log(`[GEMINI] explain-trend: No EVENT found for peak ${matchedPeak.date}, skipping`);
            continue;
          }
          
          // Clean up summary - remove any remaining generic language
          let finalSummary = summary.trim();
          const lowerSummary = finalSummary.toLowerCase();
          
          // Final check: reject if it contains forbidden terms
          if (
            lowerSummary.includes('google trends') ||
            lowerSummary.includes('search interest') ||
            lowerSummary.includes('search volume') ||
            lowerSummary.includes('peak') ||
            lowerSummary.includes('keyword') ||
            lowerSummary.includes('analysis') ||
            lowerSummary.includes('here\'s')
          ) {
            console.log(`[GEMINI] explain-trend: REJECTED summary contains forbidden terms: ${finalSummary}`);
            continue;
          }
          
          allPeakSummaries.push({
            date: matchedPeak.date,
            keyword: keywords[0],
            value: chartValue,
            summary: finalSummary,
          });
        }
        
        peakSummaries = allPeakSummaries;
        
        console.log('[GEMINI] explain-trend: Created peak summaries:', peakSummaries.length);
        peakSummaries.forEach((p, idx) => {
          console.log(`[GEMINI] explain-trend: Summary ${idx + 1}:`, { date: p.date, value: p.value, summary: p.summary });
        });

        console.log('[GEMINI] explain-trend: extracted peak summaries', {
          summaryCount: peakSummaries.length,
          summaries: peakSummaries.map(p => ({ date: p.date, summary: p.summary })),
        });

        // Store peak summaries in Redis - ALWAYS store (even if empty) to mark chart as processed
        console.log('[GEMINI] explain-trend: ========== CACHING PEAK SUMMARIES ==========');
        console.log('[GEMINI] explain-trend: About to cache peak summaries:', {
          peakSummariesCount: peakSummaries.length,
          keywords: keywords.join(','),
          peakSummaries: peakSummaries,
        });
        
        try {
          const redis = await getRedisClient();
          if (!redis) {
            console.error('[GEMINI] explain-trend: ❌ Redis not available for caching peak summaries');
            throw new Error('Redis client not available');
          }
          
          const peakSummariesKey = generatePeakSummariesKey(keywords);
          const peakSummariesData = JSON.stringify(peakSummaries);
          
          console.log('[GEMINI] explain-trend: Caching to Redis (no expiration):', {
            peakSummariesKey,
            keywords: keywords.join(','),
            dataLength: peakSummariesData.length,
            peakCount: peakSummaries.length,
            dataPreview: peakSummariesData.substring(0, 200),
          });
          
          // ALWAYS store, even if empty array
          await redis.set(peakSummariesKey, peakSummariesData);
          
          // Verify it was stored immediately
          const verify = await redis.get(peakSummariesKey);
          if (!verify) {
            throw new Error('Failed to verify peak summaries storage - key not found after set');
          }
          
          const parsed = JSON.parse(verify);
          if (parsed.length !== peakSummaries.length) {
            throw new Error(`Peak summaries count mismatch: stored ${parsed.length}, expected ${peakSummaries.length}`);
          }
          
          console.log('[GEMINI] explain-trend: ✅ peak summaries cached and verified (no expiration)', {
            peakSummariesKey,
            keywords: keywords.join(','),
            peakCount: peakSummaries.length,
            verifiedCount: parsed.length,
            expiresIn: 'never',
            sampleSummary: peakSummaries.length > 0 ? peakSummaries[0] : 'none',
            allSummaries: peakSummaries.slice(0, 3), // Log first 3 for debugging
          });
        } catch (peakCacheError) {
          console.error('[GEMINI] explain-trend: ❌ FAILED to cache peak summaries', peakCacheError);
          console.error('[GEMINI] explain-trend: Cache error details:', {
            message: peakCacheError instanceof Error ? peakCacheError.message : 'Unknown',
            stack: peakCacheError instanceof Error ? peakCacheError.stack : 'No stack',
            keywords: keywords.join(','),
            peakCount: peakSummaries.length,
          });
          // Don't throw - continue even if peak caching fails, but log the error prominently
        }
        console.log('[GEMINI] explain-trend: ========== END CACHING PEAK SUMMARIES ==========');
      } catch (peakError) {
        console.error('[GEMINI] explain-trend: ❌ failed to process peaks', peakError);
        console.error('[GEMINI] explain-trend: Peak processing error details:', {
          message: peakError instanceof Error ? peakError.message : 'Unknown',
          stack: peakError instanceof Error ? peakError.stack : 'No stack',
        });
        // Continue even if peak processing fails - set empty array
        peakSummaries = [];
      }
    } else {
      console.log('[GEMINI] explain-trend: ❌ Skipping peak detection', {
        keywordCount: keywords.length,
        hasExplanation: !!explanation,
        timelineLength: finalSanitisedTimeline.length,
        reason: keywords.length !== 1 ? 'multiple keywords' : !explanation ? 'no explanation' : 'no timeline data',
      });
      console.log('[GEMINI] explain-trend: ========== END PEAK DETECTION CHECK (SKIPPED) ==========');
    }
    
    console.log('[GEMINI] explain-trend: Final peakSummaries count:', peakSummaries.length);
    console.log('[GEMINI] explain-trend: ========== END PEAK DETECTION CHECK ==========');

    // If no peak summaries were generated but we have an explanation, try to extract key points
    // Use actual peak detection from timeline data to get real peak values and dates
    if (peakSummaries.length === 0 && explanation && keywords.length === 1 && finalSanitisedTimeline.length > 0) {
      console.log('[GEMINI] explain-trend: ⚠️ No peak summaries generated, detecting peaks and extracting events from explanation');
      console.log('[GEMINI] explain-trend: Explanation length:', explanation.length);
      console.log('[GEMINI] explain-trend: Timeline length:', finalSanitisedTimeline.length);
      
      try {
        // First, detect actual peaks from the timeline data
        const { detectPeaks } = await import('@/lib/peak-detection');
        
        // Convert timeline to chart format with proper date resolution (matching SanitisedPoint structure)
        const resolveDateString = (point: any): string | null => {
          if (point?.formattedTime) return String(point.formattedTime);
          if (point?.formattedAxisTime) return String(point.formattedAxisTime);
          if (point?.time !== null && point?.time !== undefined) return String(point.time);
          return null;
        };
        
        const chartData = finalSanitisedTimeline
          .map((point, idx) => {
            const dateStr = resolveDateString(point);
            // SanitisedPoint has values array (plural), not value
            const value = Array.isArray(point.values) && point.values.length > 0 
              ? point.values[0] 
              : (typeof point.values === 'number' ? point.values : 0);
            
            if (!dateStr) {
              return null;
            }
            
            return {
              date: dateStr,
              [keywords[0]]: value,
            };
          })
          .filter((d): d is { date: string; [key: string]: number } => d !== null);
        
        console.log('[GEMINI] explain-trend: Chart data prepared for fallback peak detection', {
          chartDataLength: chartData.length,
          finalSanitisedTimelineLength: finalSanitisedTimeline.length,
          sampleDates: chartData.slice(0, 3).map(d => d.date),
          sampleValues: chartData.slice(0, 3).map(d => d[keywords[0]]),
        });
        
        const detectedPeaks = detectPeaks(chartData, keywords[0], 15); // Lower threshold to catch more peaks
        console.log('[GEMINI] explain-trend: Detected peaks from timeline:', detectedPeaks.length);
        
        if (detectedPeaks.length > 0) {
          // Extract event summaries for each detected peak
          const { extractPeakExplanation } = await import('@/lib/peak-detection');
          
          peakSummaries = detectedPeaks.map(peak => {
            // ONLY extract EVENT from structured PEAK EXPLANATIONS (section 2)
            const extracted = extractPeakExplanation(explanation, peak.date, 15);
            
            // If no EVENT found, skip this peak
            if (!extracted || extracted.length === 0) {
              return null;
            }
            
            // Final check: reject if contains forbidden terms
            const lowerSummary = extracted.toLowerCase();
            if (
              lowerSummary.includes('google trends') ||
              lowerSummary.includes('search interest') ||
              lowerSummary.includes('search volume') ||
              lowerSummary.includes('peak') ||
              lowerSummary.includes('keyword') ||
              lowerSummary.includes('analysis') ||
              lowerSummary.includes('here\'s')
            ) {
              return null;
            }
            
            return {
              date: peak.date,
              keyword: keywords[0],
              value: peak.value,
              summary: extracted.trim(),
            };
          }).filter((p): p is { date: string; keyword: string; value: number; summary: string } => p !== null);
          
          console.log('[GEMINI] explain-trend: ✅ Extracted event summaries from peaks:', peakSummaries.length);
          peakSummaries.forEach((p, idx) => {
            console.log(`[GEMINI] explain-trend: Summary ${idx + 1}:`, { date: p.date, value: p.value, summary: p.summary });
          });
        } else {
          console.log('[GEMINI] explain-trend: ⚠️ No peaks detected in timeline data');
        }
      } catch (extractError) {
        console.error('[GEMINI] explain-trend: ❌ Failed to extract key points:', extractError);
      }
    }

    // Don't append SUMMARIES section to explanation - summaries are handled separately via peakSummaries
    let finalExplanation = explanation;

    const responseData = {
      success: true,
      explanation: finalExplanation, // Use explanation with summaries appended
      keywords: keywords,
      dataPoints: finalSanitisedTimeline.length,
      generatedAt: new Date().toISOString(),
      prompt,
      peakSummaries: peakSummaries, // Include peak summaries in response
      peakSummariesCount: peakSummaries.length, // Add count for debugging
      searchGrounding: {
        used: finalUsedSearchGrounding,
        searchQueries: searchQueriesUsed,
        citations: citationsUsed.map((c: any) => ({
          uri: c.uri,
          title: c.title,
          startIndex: c.startIndex,
          endIndex: c.endIndex,
        })),
      },
    };
    
    console.log('[GEMINI] explain-trend: ========== RESPONSE DATA PREPARED ==========');
    console.log('[GEMINI] explain-trend: Response data prepared', {
      hasExplanation: !!explanation,
      explanationLength: explanation?.length || 0,
      peakSummariesCount: peakSummaries.length,
      peakSummaries: peakSummaries.length > 0 ? peakSummaries.map(p => ({ date: p.date, summary: p.summary.substring(0, 30) })) : 'none',
      keywordsLength: keywords.length,
      isSingleKeyword: keywords.length === 1,
      finalSanitisedTimelineLength: finalSanitisedTimeline.length,
    });
    console.log('[GEMINI] explain-trend: Full peakSummaries array:', JSON.stringify(peakSummaries, null, 2));
    console.log('[GEMINI] explain-trend: ========== END RESPONSE DATA ==========');

    // Cache the result with 4-day TTL (345600 seconds)
    if (cacheKey) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const ttlSeconds = 4 * 24 * 60 * 60; // 4 days in seconds
          let serializedData: string;
          try {
            serializedData = JSON.stringify(responseData);
          } catch (serializeError) {
            console.error('[GEMINI] explain-trend: failed to serialize response data for caching', serializeError);
            // Create a simplified version without potentially problematic fields
            const simplifiedData = {
              success: responseData.success,
              explanation: responseData.explanation,
              keywords: responseData.keywords,
              dataPoints: responseData.dataPoints,
              generatedAt: responseData.generatedAt,
              searchGrounding: {
                used: responseData.searchGrounding.used,
                searchQueries: responseData.searchGrounding.searchQueries,
                citations: responseData.searchGrounding.citations.map((c: any) => ({
                  uri: c.uri,
                  title: c.title,
                })),
              },
            };
            serializedData = JSON.stringify(simplifiedData);
          }
          await redis.setEx(cacheKey, ttlSeconds, serializedData);
          console.log('[GEMINI] explain-trend: result cached', {
            cacheKey,
            ttlSeconds,
            expiresIn: '4 days',
          });
        }
      } catch (cacheError) {
        console.warn('[GEMINI] explain-trend: failed to cache result', cacheError);
        // Continue even if caching fails
      }
    }

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[GEMINI] explain-trend: unexpected error', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate trend explanation', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

