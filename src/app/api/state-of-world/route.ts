import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Normalize keywords for consistent cache keys
function normalizeKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0).sort();
}

// Generate a cache key from keywords
function generateCacheKey(keywords: string[]): string {
  const normalized = normalizeKeywords(keywords);
  const sortedKeywords = normalized.join('|');
  const hash = crypto.createHash('sha256').update(sortedKeywords).digest('hex');
  return `explain-trend:${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[STATE-OF-WORLD] Request received');
    
    const { keywordSets, growthMetrics } = await request.json();
    
    if (!keywordSets || !Array.isArray(keywordSets) || keywordSets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Keyword sets array is required' },
        { status: 400 }
      );
    }
    
    if (!growthMetrics || typeof growthMetrics !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Growth metrics object is required' },
        { status: 400 }
      );
    }
    
    // Filter keyword sets with >50% growth
    const highGrowthSets = keywordSets.filter((keywords: string[]) => {
      const key = JSON.stringify([...keywords].slice().sort());
      const growth = growthMetrics[key];
      return growth !== undefined && growth !== null && growth > 50;
    });
    
    console.log('[STATE-OF-WORLD] High growth sets:', {
      totalSets: keywordSets.length,
      highGrowthCount: highGrowthSets.length,
      highGrowthSets: highGrowthSets.map((ks: string[]) => ({
        keywords: ks,
        growth: growthMetrics[JSON.stringify([...ks].slice().sort())]
      }))
    });
    
    if (highGrowthSets.length === 0) {
      return NextResponse.json({
        success: true,
        superconclusion: null,
        message: 'No keyword sets with >50% growth found',
        count: 0
      });
    }
    
    // Get base URL from request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    
    // Helper function to fetch trend data from Redis
    const fetchTrendDataFromRedis = async (keywords: string[]): Promise<any | null> => {
      try {
        // For single keyword, use /api/trends/redis
        // For multiple keywords, use /api/trends
        const keywordsStr = keywords.join(',');
        const apiUrl = keywords.length === 1 
          ? `${baseUrl}/api/trends/redis?keywords=${encodeURIComponent(keywordsStr)}`
          : `${baseUrl}/api/trends?keywords=${encodeURIComponent(keywordsStr)}`;
        
        const response = await fetch(apiUrl, {
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          console.log(`[STATE-OF-WORLD] Failed to fetch trend data for ${keywordsStr}: ${response.status}`);
          return null;
        }
        
        const result = await response.json();
        if (result.success && result.data) {
          return result;
        }
        return null;
      } catch (error) {
        console.error(`[STATE-OF-WORLD] Error fetching trend data for ${keywords.join(', ')}:`, error);
        return null;
      }
    };
    
    // Helper function to generate explanation in background
    const generateExplanationInBackground = async (keywords: string[], trendData: any): Promise<void> => {
      try {
        console.log(`[STATE-OF-WORLD] 🔄 Generating explanation in background for ${keywords.join(', ')}`);
        const response = await fetch(`${baseUrl}/api/explain-trend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords,
            trendData,
            regenerate: false
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`[STATE-OF-WORLD] ✅ Background explanation generated for ${keywords.join(', ')}`, {
            success: result.success,
            cached: result.cached
          });
        } else {
          console.error(`[STATE-OF-WORLD] ❌ Failed to generate explanation for ${keywords.join(', ')}: ${response.status}`);
        }
      } catch (error) {
        console.error(`[STATE-OF-WORLD] ❌ Error generating explanation for ${keywords.join(', ')}:`, error);
      }
    };
    
    // First pass: collect existing conclusions and identify missing ones
    const redis = await getRedisClient();
    const conclusionsWithGrowth: Array<{ keywords: string[]; conclusion: string; growth: number }> = [];
    const missingKeywords: Array<{ keywords: string[]; growth: number }> = [];
    
    for (const keywords of highGrowthSets) {
      try {
        const cacheKey = generateCacheKey(keywords);
        console.log(`[STATE-OF-WORLD] Checking cache for ${keywords.join(', ')}`, {
          cacheKey,
          keywords
        });
        
        const cached = await redis?.get(cacheKey);
        
        if (cached) {
          console.log(`[STATE-OF-WORLD] Found cached explanation for ${keywords.join(', ')}`);
          const cachedResult = JSON.parse(cached);
          if (cachedResult.explanation) {
            console.log(`[STATE-OF-WORLD] Extracting conclusion from explanation (length: ${cachedResult.explanation.length})`);
            // Extract conclusion from explanation
            const conclusion = extractConclusion(cachedResult.explanation);
            if (conclusion) {
              const key = JSON.stringify([...keywords].slice().sort());
              const growth = growthMetrics[key];
              console.log(`[STATE-OF-WORLD] ✅ Successfully extracted conclusion for ${keywords.join(', ')}`, {
                conclusionLength: conclusion.length,
                growth,
                preview: conclusion.substring(0, 100)
              });
              conclusionsWithGrowth.push({
                keywords,
                conclusion,
                growth: growth || 0
              });
            } else {
              console.log(`[STATE-OF-WORLD] ⚠️ No conclusion extracted from explanation for ${keywords.join(', ')}`);
              const key = JSON.stringify([...keywords].slice().sort());
              const growth = growthMetrics[key];
              missingKeywords.push({ keywords, growth: growth || 0 });
            }
          } else {
            console.log(`[STATE-OF-WORLD] ⚠️ Cached result has no explanation for ${keywords.join(', ')}`);
            const key = JSON.stringify([...keywords].slice().sort());
            const growth = growthMetrics[key];
            missingKeywords.push({ keywords, growth: growth || 0 });
          }
        } else {
          console.log(`[STATE-OF-WORLD] ⚠️ No cached explanation found for ${keywords.join(', ')} (key: ${cacheKey})`);
          const key = JSON.stringify([...keywords].slice().sort());
          const growth = growthMetrics[key];
          missingKeywords.push({ keywords, growth: growth || 0 });
        }
      } catch (error) {
        console.error(`[STATE-OF-WORLD] Error fetching conclusion for ${keywords.join(', ')}:`, error);
        const key = JSON.stringify([...keywords].slice().sort());
        const growth = growthMetrics[key];
        missingKeywords.push({ keywords, growth: growth || 0 });
      }
    }
    
    // Generate missing conclusions in background
    if (missingKeywords.length > 0) {
      console.log(`[STATE-OF-WORLD] 🔄 Found ${missingKeywords.length} keyword sets without conclusions, generating in background...`);
      
      const generationPromises = missingKeywords.map(async ({ keywords }) => {
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
          
          await generateExplanationInBackground(keywords, trendData);
        } else {
          console.log(`[STATE-OF-WORLD] ⚠️ Could not fetch trend data for ${keywords.join(', ')}, skipping background generation`);
        }
      });
      
      // Fire off background generations without waiting (truly async)
      // Don't await - let them run in the background
      Promise.all(generationPromises).catch(error => {
        console.error('[STATE-OF-WORLD] Error in background generation:', error);
      });
      
      console.log(`[STATE-OF-WORLD] 🔄 Started ${missingKeywords.length} background generation tasks (not waiting for completion)`);
    }
    
    console.log('[STATE-OF-WORLD] Collected conclusions:', {
      count: conclusionsWithGrowth.length,
      summaries: conclusionsWithGrowth.map(c => ({
        keywords: c.keywords.join(', '),
        growth: c.growth,
        conclusionLength: c.conclusion.length
      }))
    });
    
    if (conclusionsWithGrowth.length === 0) {
      return NextResponse.json({
        success: true,
        superconclusion: null,
        message: 'No conclusions found for high-growth keyword sets',
        count: 0
      });
    }
    
    // Generate superconclusion using Gemini
    const geminiApiKey =
      process.env.GEMINI_API_KEY ??
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ??
      process.env.GOOGLE_GEMINI_API_KEY ??
      'AIzaSyAEqSr2vgcTW7N0yr2Tji6ALDAE88D5jWI';
    
    if (!geminiApiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }
    
    // Build prompt with all conclusions and growth percentages
    const conclusionsText = conclusionsWithGrowth
      .map((item, idx) => {
        const keywordsStr = item.keywords.join(', ');
        return `## ${idx + 1}. ${keywordsStr} (Growth: +${item.growth.toFixed(1)}%)\n\n${item.conclusion}`;
      })
      .join('\n\n');
    
    const prompt = `You are a geopolitical analyst synthesizing insights from multiple Google Trends analyses.

Below are ${conclusionsWithGrowth.length} trend analyses for keywords showing significant growth (>50%). Each analysis includes the keyword(s), growth percentage, and a conclusion about what the data reveals.

${conclusionsText}

Your task: Synthesize these individual analyses into a comprehensive "State of the World" superconclusion that:
1. Identifies overarching themes and patterns across these high-growth trends
2. Explains what these trends collectively reveal about current geopolitical, social, or cultural shifts
3. Highlights connections and relationships between different trends
4. Provides insights into what these patterns suggest about the direction of global events

Write a concise but comprehensive analysis (3-5 paragraphs) that captures the bigger picture these trends paint together. Focus on actionable insights and meaningful patterns rather than just summarizing individual conclusions.`;

    console.log('[STATE-OF-WORLD] Calling Gemini API...');
    
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
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('[STATE-OF-WORLD] Gemini API error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to generate superconclusion from Gemini API' },
        { status: 500 }
      );
    }
    
    const geminiData = await geminiResponse.json();
    const candidate = geminiData?.candidates?.[0];
    
    if (!candidate || !candidate.content) {
      return NextResponse.json(
        { success: false, error: 'Invalid response from Gemini API' },
        { status: 500 }
      );
    }
    
    const textParts = candidate.content.parts.filter((part: any) => part.text);
    const superconclusion = textParts.length > 0 
      ? textParts.map((part: any) => part.text).join('\n\n')
      : 'No superconclusion generated';
    
    console.log('[STATE-OF-WORLD] Superconclusion generated:', {
      length: superconclusion.length,
      preview: superconclusion.substring(0, 200)
    });
    
    return NextResponse.json({
      success: true,
      superconclusion,
      count: conclusionsWithGrowth.length,
      keywordsAnalyzed: conclusionsWithGrowth.map(c => ({
        keywords: c.keywords,
        growth: c.growth
      }))
    });
    
  } catch (error) {
    console.error('[STATE-OF-WORLD] Unexpected error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate state of the world superconclusion', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Extract conclusion section from explanation text (same logic as TrendsCard)
function extractConclusion(text: string): string | null {
  if (!text) return null;
  
  let conclusionStart = -1;
  let conclusionEnd = -1;
  
  // Pattern 1: "**4. Conclusion:**" or "**4. A short conclusion:**" (markdown bold)
  const pattern1 = /\*\*4\.\s+(?:A\s+short\s+)?[Cc]onclusion:\*\*/i;
  let match = text.match(pattern1);
  if (match) {
    conclusionStart = match.index! + match[0].length;
    // Skip any whitespace/newlines after the markdown
    const afterMatch = text.substring(conclusionStart);
    const whitespaceMatch = afterMatch.match(/^\s*\n*/);
    if (whitespaceMatch) {
      conclusionStart += whitespaceMatch[0].length;
    }
  } else {
    // Pattern 2: "4. A short conclusion" or "4. Conclusion" (numbered section, no markdown)
    const pattern2 = /(?:^|\n)\s*4\.\s+(?:A\s+short\s+)?[Cc]onclusion[:\s]*\n/i;
    match = text.match(pattern2);
    if (match) {
      conclusionStart = match.index! + match[0].length;
    } else {
      // Pattern 3: "## Conclusion" or "### Conclusion" (markdown heading)
      const pattern3 = /##+\s+[Cc]onclusion\s*\n/i;
      match = text.match(pattern3);
      if (match) {
        conclusionStart = match.index! + match[0].length;
      } else {
        // Pattern 4: "Conclusion:" or "Conclusion" (plain text heading)
        const pattern4 = /(?:^|\n)\s*[Cc]onclusion[:\s]*\n/i;
        match = text.match(pattern4);
        if (match) {
          conclusionStart = match.index! + match[0].length;
        }
      }
    }
  }
  
  if (conclusionStart === -1) {
    return null;
  }
  
  // Find where conclusion ends - look for "Sources" section or "SUMMARIES" section
  const remainingText = text.substring(conclusionStart);
  const summariesPattern = /\n\s*(?:##\s*)?SUMMARIES\s*\n/i;
  const summariesMatch = remainingText.match(summariesPattern);
  
  // Enhanced Sources detection - look for:
  // 1. "Sources:" or "Source:" header
  // 2. Markdown heading with Sources
  // 3. Numbered section "5. Sources" or similar
  // 4. Numbered list that looks like sources (starts with "1. " followed by publication/URL pattern)
  const sourcesPattern = /\n\s*(?:Sources?[:\s]*\n|##+\s*Sources?\s*\n|5\.\s*Sources?\s*\n|\*\*Sources?\*\*\s*\n)/i;
  const sourcesMatch = remainingText.match(sourcesPattern);
  
  // Also check for numbered list that looks like sources (starts with "1. " and contains publication patterns)
  const numberedSourcesPattern = /\n\s*1\.\s+[^\n]*(?:[-–]\s*(?:YouTube|WION|EBSCO|Wikipedia|Britannica|Research Starters|The Far Right News|Zocalo Public Square|Holistic News)|\([^)]*(?:YouTube|WION|EBSCO|Wikipedia|Britannica|Research Starters|The Far Right News|Zocalo Public Square|Holistic News)[^)]*\))/i;
  const numberedSourcesMatch = remainingText.match(numberedSourcesPattern);
  
  let endMarkerIndex = -1;
  if (summariesMatch) {
    endMarkerIndex = summariesMatch.index!;
  }
  if (sourcesMatch) {
    const sourcesIndex = sourcesMatch.index!;
    if (endMarkerIndex === -1 || sourcesIndex < endMarkerIndex) {
      endMarkerIndex = sourcesIndex;
    }
  }
  if (numberedSourcesMatch) {
    const numberedSourcesIndex = numberedSourcesMatch.index!;
    if (endMarkerIndex === -1 || numberedSourcesIndex < endMarkerIndex) {
      endMarkerIndex = numberedSourcesIndex;
    }
  }
  
  if (endMarkerIndex >= 0) {
    const beforeEnd = remainingText.substring(0, endMarkerIndex).trim();
    if (beforeEnd.length > 50) {
      conclusionEnd = conclusionStart + endMarkerIndex;
    } else {
      conclusionEnd = text.length;
    }
  } else {
    conclusionEnd = text.length;
  }
  
  let conclusionText = text.substring(conclusionStart, conclusionEnd).trim();
  
  // Clean up markdown formatting
  conclusionText = conclusionText
    .replace(/\*\*/g, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/The Google Trends data/gi, 'The data')
    .replace(/^4\.\s*/gm, '')
    .replace(/^4\.\s*Conclusion:\s*/gi, '')
    .replace(/^Conclusion:\s*/gi, '')
    .replace(/^Conclusion\s*$/gim, '')
    .replace(/^Conclusion\s+/gim, '')
    .trim();
  
  // Filter out source lines - enhanced to catch numbered source lists
  const lines = conclusionText.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    
    // Skip numbered lists that look like sources (e.g., "1. Title - YouTube (WION, 2025-11-05)")
    if (/^\d+\.\s+[^\n]*(?:[-–]\s*(?:YouTube|WION|EBSCO|Wikipedia|Britannica|Research Starters|The Far Right News|Zocalo Public Square|Holistic News)|\([^)]*(?:YouTube|WION|EBSCO|Wikipedia|Britannica|Research Starters|The Far Right News|Zocalo Public Square|Holistic News)[^)]*\))/i.test(trimmed)) {
      return false;
    }
    
    if (
      /^https?:\/\//i.test(trimmed) ||
      /^\[.*\]\(https?:\/\/\)/i.test(trimmed) ||
      (/^[-*•]\s*(Wikipedia|Britannica|EBSCO|Research Starters|The Far Right News|YouTube|WION|Zocalo Public Square|Holistic News)/i.test(trimmed)) ||
      (/^\d{4}-\d{2}-\d{2}\s*[-–]\s*(Wikipedia|Britannica|EBSCO|YouTube|WION)/i.test(trimmed))
    ) {
      return false;
    }
    return true;
  });
  
  const finalText = filteredLines.join('\n').trim();
  
  if (finalText.length >= 30) {
    return finalText;
  }
  
  return null;
}

