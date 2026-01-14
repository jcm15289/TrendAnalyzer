'use client';

import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Label, Dot, Customized } from 'recharts';
import { AlertCircle, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Peak detection imports removed - we fetch summaries from Redis instead

interface GoogleTrendsChartProps {
  keywords: string[];
  onDataLoad?: (data: any) => void;
  isWideLayout?: boolean;
  peakSummaries?: Array<{ date: string; keyword: string; value: number; summary: string }>;
}

interface TrendData {
  date: string;
  [key: string]: string | number;
}

interface PeakExplanation {
  date: string;
  keyword: string;
  value: number;
  explanation: string | null;
}

const GoogleTrendsChartRedis: React.FC<GoogleTrendsChartProps> = ({ keywords, onDataLoad, isWideLayout = false, peakSummaries }) => {
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [peakExplanations, setPeakExplanations] = useState<PeakExplanation[]>([]);
  const [dataFetched, setDataFetched] = useState(false); // Track if data has been fetched
  
  // Convert peakSummaries prop to peakExplanations format if provided
  useEffect(() => {
    if (peakSummaries && peakSummaries.length > 0) {
      console.log('[PeakChart] Using peakSummaries from props:', peakSummaries.length);
      const explanations: PeakExplanation[] = peakSummaries.map(peak => ({
        date: peak.date,
        keyword: peak.keyword,
        value: peak.value,
        explanation: peak.summary,
      }));
      setPeakExplanations(explanations);
      console.log('[PeakChart] Set peakExplanations from props:', explanations.length);
    } else if (peakSummaries && peakSummaries.length === 0) {
      // Explicitly clear if empty array is passed
      setPeakExplanations([]);
    }
  }, [peakSummaries]);

  // Track if we've already fetched peak summaries for this data/keyword combo
  const peakSummariesFetchedRef = useRef<string>('');
  
  // Fetch peak summaries when data is available and peakSummaries prop is not provided
  useEffect(() => {
    // Create a unique key for this fetch attempt
    const fetchKey = `${keywords.join(',')}-${data.length}-${dataFetched}`;
    
    console.log('[PeakChart] useEffect: Checking conditions for peak summaries fetch', {
      hasPeakSummariesProp: !!peakSummaries,
      dataFetched,
      dataLength: data.length,
      keywordCount: keywords.length,
      keywords: keywords.join(','),
      currentFetchKey: peakSummariesFetchedRef.current,
      newFetchKey: fetchKey,
      shouldFetch: !peakSummaries && dataFetched && data.length > 0 && keywords.length === 1 && peakSummariesFetchedRef.current !== fetchKey,
    });
    
    // Only fetch if:
    // 1. peakSummaries prop is NOT provided (to avoid duplicate fetching)
    // 2. Data has been fetched and is available
    // 3. Single keyword chart
    // 4. Data array is not empty
    // 5. We haven't already fetched for this exact data/keyword combo
    if (!peakSummaries && dataFetched && data.length > 0 && keywords.length === 1 && peakSummariesFetchedRef.current !== fetchKey) {
      console.log('[PeakChart] ✅ useEffect: Conditions met, fetching peak summaries', {
        dataLength: data.length,
        keyword: keywords[0],
        fetchKey,
        previousFetchKey: peakSummariesFetchedRef.current,
      });
      peakSummariesFetchedRef.current = fetchKey;
      fetchPeakSummaries(data).catch(err => {
        console.error('[PeakChart] ❌ useEffect: Error fetching peak summaries:', err);
        // Reset on error so we can retry
        peakSummariesFetchedRef.current = '';
      });
    } else if (!peakSummaries && dataFetched && keywords.length !== 1) {
      // Clear peak explanations for multi-keyword charts
      console.log('[PeakChart] useEffect: Multi-keyword chart, clearing peak explanations');
      setPeakExplanations([]);
      peakSummariesFetchedRef.current = '';
    } else {
      const reasons = [];
      if (peakSummaries) reasons.push('has peakSummaries prop');
      if (!dataFetched) reasons.push('data not fetched');
      if (data.length === 0) reasons.push('no data');
      if (keywords.length !== 1) reasons.push('not single keyword');
      if (peakSummariesFetchedRef.current === fetchKey) reasons.push('already fetched');
      console.log('[PeakChart] ⚠️ useEffect: Conditions NOT met for fetching', {
        reasons: reasons.length > 0 ? reasons.join(', ') : 'unknown',
        hasPeakSummariesProp: !!peakSummaries,
        dataFetched,
        dataLength: data.length,
        keywordCount: keywords.length,
        currentFetchKey: peakSummariesFetchedRef.current,
        newFetchKey: fetchKey,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length, dataFetched, keywords.join(','), !!peakSummaries]);

  // Combine trend data from multiple keywords
  const combineTrendData = (results: { keyword: string; data: any[] }[]): TrendData[] => {
    if (results.length === 0) return [];
    
    // Create a map to store all unique dates
    const dateMap = new Map<string, TrendData>();
    
    // Process each keyword's data
    results.forEach(({ keyword, data }) => {
      // Ensure data is an array before processing
      if (!Array.isArray(data)) {
        console.warn(`[Chart] Skipping non-array data for keyword ${keyword}:`, typeof data);
        return;
      }
      
      data.forEach((item: any) => {
        const dateKey = item.date;
        
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { 
            date: dateKey // Keep the original date format
          });
        }
        
        // Add this keyword's value to the date entry
        const entry = dateMap.get(dateKey)!;
        entry[keyword] = item[keyword] || 0;
      });
    });
    
    // Convert map to array and sort by date
    return Array.from(dateMap.values()).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const fetchPeakSummaries = async (chartData: TrendData[]) => {
    console.log('[PeakSummaries] ========== FETCH PEAK SUMMARIES START ==========');
    console.log('[PeakSummaries] Keywords:', keywords);
    console.log('[PeakSummaries] Chart data length:', chartData.length);
    
    // Only fetch for single keyword charts
    if (keywords.length !== 1 || chartData.length === 0) {
      console.log('[PeakSummaries] Skipping - not single keyword or no data', {
        keywordCount: keywords.length,
        dataLength: chartData.length,
      });
      setPeakExplanations([]);
      return;
    }
    
    try {
      const keyword = keywords[0];
      console.log('[PeakSummaries] Fetching peak summaries for keyword:', keyword);
      const url = `/api/peak-summaries?keywords=${encodeURIComponent(keyword)}`;
      console.log('[PeakSummaries] Fetch URL:', url);
      
      // Fetch peak summaries from Redis via API
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[PeakSummaries] Response status:', response.status);
      console.log('[PeakSummaries] Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('[PeakSummaries] Failed to fetch peak summaries, status:', response.status, 'error:', errorText);
        setPeakExplanations([]);
        return;
      }
      
      const result = await response.json();
      console.log('[PeakSummaries] ========== API RESULT ==========');
      console.log('[PeakSummaries] Full API result:', JSON.stringify(result, null, 2));
      console.log('[PeakSummaries] API result:', {
        success: result.success,
        peakCount: result.peakSummaries?.length || 0,
        hasPeakSummaries: !!result.peakSummaries,
        isArray: Array.isArray(result.peakSummaries),
      });
      
      if (!result.success || !result.peakSummaries || result.peakSummaries.length === 0) {
        console.log('[PeakSummaries] ❌ No peak summaries available in Redis');
        console.log('[PeakSummaries] Result:', result);
        setPeakExplanations([]);
        return;
      }
      
      console.log('[PeakSummaries] ✅ Found peak summaries, processing:', result.peakSummaries.length);
      
      // Convert peak summaries to PeakExplanation format
      // Match dates from peak summaries to chart data dates
      const explanations: PeakExplanation[] = result.peakSummaries
        .map((peak: any, idx: number) => {
          console.log(`[PeakSummaries] Processing peak ${idx + 1}/${result.peakSummaries.length}:`, {
            peakDate: peak.date,
            peakSummary: peak.summary,
            peakValue: peak.value,
          });
          
          // Try to find matching date in chart data using robust matching (same as peakDataPoints)
          let matchingDataPoint = chartData.find(d => {
            // Strategy 1: Exact string match
            if (d.date === peak.date) {
              return true;
            }
            
            // Strategy 2: ISO date normalization (YYYY-MM-DD)
            try {
              const peakDateStr = new Date(peak.date).toISOString().split('T')[0];
              const chartDateStr = new Date(d.date).toISOString().split('T')[0];
              if (chartDateStr === peakDateStr && chartDateStr !== '1970-01-01') {
                return true;
              }
            } catch (e) {
              // Date parsing failed, continue
            }
            
            // Strategy 3: Try matching without time component if dates include time
            try {
              const peakDateOnly = peak.date.split('T')[0].split(' ')[0];
              const chartDateOnly = d.date.split('T')[0].split(' ')[0];
              if (peakDateOnly === chartDateOnly && peakDateOnly.length >= 10) {
                return true;
              }
            } catch (e) {
              // Continue
            }
            
            // Strategy 4: Partial date match (YYYY-MM) - use for monthly data
            const peakDateParts = peak.date.split('-');
            const chartDateParts = d.date.split('-');
            if (peakDateParts.length >= 2 && chartDateParts.length >= 2) {
              if (peakDateParts[0] === chartDateParts[0] && peakDateParts[1] === chartDateParts[1]) {
                return true;
              }
            }
            
            return false;
          });
          
          // Strategy 5: Find closest date if no exact match (within 14 days)
          if (!matchingDataPoint && chartData.length > 0) {
            const peakDate = new Date(peak.date);
            if (!isNaN(peakDate.getTime())) {
              let closestPoint = chartData[0];
              let minDiff = Math.abs(new Date(chartData[0].date).getTime() - peakDate.getTime());
              
              for (const point of chartData) {
                const pointDate = new Date(point.date);
                if (!isNaN(pointDate.getTime())) {
                  const diff = Math.abs(pointDate.getTime() - peakDate.getTime());
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestPoint = point;
                  }
                }
              }
              
              // Use closest if it's within 14 days
              const maxDiffDays = 14;
              if (minDiff < maxDiffDays * 24 * 60 * 60 * 1000) {
                matchingDataPoint = closestPoint;
                console.log(`[PeakSummaries] ✅ Using closest date match for peak ${idx + 1}:`, {
                  peakDate: peak.date,
                  closestDate: matchingDataPoint.date,
                  diffDays: Math.round(minDiff / (24 * 60 * 60 * 1000)),
                });
              }
            }
          }
          
          if (!matchingDataPoint) {
            console.warn(`[PeakSummaries] ❌ No matching data point for peak ${idx + 1} after all strategies:`, {
              peakDate: peak.date,
              availableDates: chartData.slice(0, 10).map(d => d.date),
              dataLength: chartData.length,
            });
            return null;
          }
          
          // Find the actual peak point (highest value) in chart data around this date (within 14 days)
          // This ensures we use the actual peak value, not just the matched data point value
          const peakDate = new Date(peak.date);
          const searchWindow = 14 * 24 * 60 * 60 * 1000; // 14 days
          let actualPeakPoint = matchingDataPoint;
          let actualPeakValue = Number(matchingDataPoint[peak.keyword]) || 0;
          
          // Search for the highest value point within the search window
          for (const point of chartData) {
            try {
              const pointDate = new Date(point.date);
              const dateDiff = Math.abs(pointDate.getTime() - peakDate.getTime());
              if (dateDiff <= searchWindow) {
                const pointValue = Number(point[peak.keyword]) || 0;
                // Find the point with the highest value (the actual peak)
                if (pointValue > actualPeakValue) {
                  actualPeakValue = pointValue;
                  actualPeakPoint = point;
                }
              }
            } catch (e) {
              // Skip invalid dates
            }
          }
          
          console.log(`[PeakSummaries] ✅ Matched peak ${idx + 1} to data point:`, {
            peakDate: peak.date,
            chartDate: actualPeakPoint.date,
            storedValue: peak.value,
            actualPeakValue,
            originalMatchedValue: Number(matchingDataPoint[peak.keyword]),
            keyword: peak.keyword,
          });
          
          return {
            date: actualPeakPoint.date, // Use actual peak date from chart data
            keyword: peak.keyword,
            value: actualPeakValue, // Use actual peak value from chart data
            explanation: peak.summary || null,
          };
        })
        .filter((e): e is PeakExplanation => e !== null);
      
      console.log('[PeakSummaries] ========== PROCESSED EXPLANATIONS ==========');
      console.log('[PeakSummaries] Loaded from Redis', {
        count: explanations.length,
        summaries: explanations.map(e => ({ date: e.date, summary: e.explanation })),
      });
      
      setPeakExplanations(explanations);
      console.log('[PeakSummaries] ✅ State set with', explanations.length, 'peak explanations');
      console.log('[PeakSummaries] ========== FETCH PEAK SUMMARIES END ==========');
    } catch (err) {
      console.error('[PeakSummaries] ❌ Error fetching peak summaries:', err);
      console.error('[PeakSummaries] Error details:', {
        message: err instanceof Error ? err.message : 'Unknown',
        stack: err instanceof Error ? err.stack : 'No stack',
      });
      setPeakExplanations([]);
    }
  };

  const fetchTrendData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[Chart] Starting fetchTrendData for keywords:', keywords);
      // For comparison queries, fetch each keyword separately from Redis
      const fetchPromises = keywords.map(async (keyword) => {
        try {
          const url = `/api/trends/redis?keywords=${encodeURIComponent(keyword)}&t=${Date.now()}`;
          console.log('[Chart] Fetching from:', url);
          
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          
          const response = await fetch(url, {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
        
          if (!response.ok) {
            if (response.status === 404) {
              // No cache found - this is expected for missing data
              throw new Error(`No cached data found for "${keyword}" in Redis`);
            }
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error(`[Chart] API error for ${keyword}:`, response.status, errorText);
            throw new Error(`API request failed for ${keyword}: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (!result.success) {
            throw new Error(`Failed to fetch trend data for ${keyword}: ${result.error || 'Unknown error'}`);
          }
          
          // Ensure data is always an array
          let dataArray = result.data;
          if (!Array.isArray(dataArray)) {
            console.warn(`[Chart] Data for ${keyword} is not an array, converting:`, {
              dataType: typeof dataArray,
              isNull: dataArray === null,
              isUndefined: dataArray === undefined,
              dataPreview: dataArray ? JSON.stringify(dataArray).substring(0, 100) : 'null/undefined'
            });
            dataArray = [];
          }
          
          return { keyword, data: dataArray, timestamp: result.timestamp };
        } catch (fetchError) {
          console.error(`[Chart] Fetch error for ${keyword}:`, fetchError);
          // Return empty data instead of throwing to prevent breaking the whole chart
          return { keyword, data: [], timestamp: null };
        }
      });
      
      // Wait for all API calls to complete
      const results = await Promise.all(fetchPromises);
      
      // Combine the data from all keywords
      const combinedData = combineTrendData(results);
      
      setData(combinedData);
      setDataFetched(true); // Mark as fetched
      
      // Fetch peak summaries from Redis if available (only for single keyword charts)
      // But only if peakSummaries prop is not provided (to avoid duplicate fetching)
      if (combinedData.length > 0 && keywords.length === 1 && !peakSummaries) {
        // Fetch peak summaries that were stored when explanation was generated
        // Pass combinedData to ensure dates match correctly
        await fetchPeakSummaries(combinedData);
      } else if (!peakSummaries) {
        setPeakExplanations([]);
      }
      // If peakSummaries prop is provided, it will be handled by the useEffect hook above
      
      // Pass raw trend data to parent component for AI analysis
      if (onDataLoad) {
        onDataLoad({
          timelineData: results.flatMap(r => r.data),
          keywords: keywords,
          results: results
        });
      }
      
      // Set the most recent timestamp
      const timestamps = results.map(r => r.timestamp).filter(Boolean);
      if (timestamps.length > 0) {
        const mostRecent = new Date(Math.max(...timestamps.map(t => new Date(t).getTime())));
        setLastUpdated(mostRecent.toLocaleString());
      }
      
    } catch (err) {
      console.error('Error fetching trend data from Redis:', err);
      
      let errorMessage = 'Failed to load trend data from Redis';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Use a ref to track keywords string to avoid infinite loops
  const keywordsRef = useRef<string>('');
  
  useEffect(() => {
    const keywordsStr = keywords.join(',');
    // Only reset if keywords actually changed
    if (keywordsRef.current !== keywordsStr) {
      keywordsRef.current = keywordsStr;
      setDataFetched(false);
      setData([]);
      setPeakExplanations([]);
      
      // Fetch immediately when keywords change
      if (keywords.length > 0) {
        console.log('[PeakChart] Keywords changed, fetching trend data:', keywords);
        fetchTrendData();
      }
    }
  }, [keywords]);

  if (loading) {
    return (
      <div className="h-[300px] w-full bg-gray-50 rounded-lg border flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading cached trend data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] w-full bg-red-50 rounded-lg border border-red-200 flex items-center justify-center">
        <div className="text-center text-red-600 max-w-md">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="font-medium mb-2">No Cached Data Available</p>
          <p className="text-sm mb-4">{error}</p>
          <div className="text-xs text-gray-500">
            <p>This data needs to be cached first using the TrendsRun.pl script</p>
            <p>or uploaded to Redis using the UploadTrendsCache script.</p>
          </div>
          <Button 
            onClick={fetchTrendData} 
            size="sm" 
            variant="outline" 
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const colors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6'];
  // Use thicker lines in single column (wide) layout for better visibility
  const strokeWidth = isWideLayout ? 4 : 2;

  // Find peak data points for annotations
  const peakDataPoints = peakExplanations
    .filter(peak => peak.explanation && peak.explanation.length > 0)
    .map(peak => {
      // Try multiple date matching strategies with improved logic
      let dataPoint = data.find(d => {
        // Strategy 1: Exact string match
        if (d.date === peak.date) {
          console.log('[PeakChart] ✅ Exact date match:', { peakDate: peak.date, chartDate: d.date });
          return true;
        }
        
        // Strategy 2: ISO date normalization (YYYY-MM-DD)
        try {
          const peakDateStr = new Date(peak.date).toISOString().split('T')[0];
          const chartDateStr = new Date(d.date).toISOString().split('T')[0];
          if (chartDateStr === peakDateStr && chartDateStr !== '1970-01-01') {
            console.log('[PeakChart] ✅ ISO date match:', { peakDate: peak.date, chartDate: d.date, normalized: peakDateStr });
            return true;
          }
        } catch (e) {
          // Date parsing failed, continue
        }
        
        // Strategy 3: Try matching without time component if dates include time
        try {
          const peakDateOnly = peak.date.split('T')[0].split(' ')[0];
          const chartDateOnly = d.date.split('T')[0].split(' ')[0];
          if (peakDateOnly === chartDateOnly && peakDateOnly.length >= 10) {
            console.log('[PeakChart] ✅ Date-only match:', { peakDate: peak.date, chartDate: d.date, dateOnly: peakDateOnly });
            return true;
          }
        } catch (e) {
          // Continue
        }
        
        // Strategy 4: Partial date match (YYYY-MM) - use for monthly data
        const peakDateParts = peak.date.split('-');
        const chartDateParts = d.date.split('-');
        if (peakDateParts.length >= 2 && chartDateParts.length >= 2) {
          if (peakDateParts[0] === chartDateParts[0] && peakDateParts[1] === chartDateParts[1]) {
            console.log('[PeakChart] ✅ Partial date match (YYYY-MM):', { peakDate: peak.date, chartDate: d.date });
            return true;
          }
        }
        
        return false;
      });
      
      if (!dataPoint && data.length > 0) {
        // Strategy 5: Find the closest date (within reasonable range)
        const peakDate = new Date(peak.date);
        if (!isNaN(peakDate.getTime())) {
          let closestPoint = data[0];
          let minDiff = Math.abs(new Date(data[0].date).getTime() - peakDate.getTime());
          
          for (const point of data) {
            const pointDate = new Date(point.date);
            if (!isNaN(pointDate.getTime())) {
              const diff = Math.abs(pointDate.getTime() - peakDate.getTime());
            if (diff < minDiff) {
              minDiff = diff;
              closestPoint = point;
              }
            }
          }
          
          // Use closest if it's within 14 days (more lenient for weekly/monthly data)
          const maxDiffDays = 14;
          if (minDiff < maxDiffDays * 24 * 60 * 60 * 1000) {
            dataPoint = closestPoint;
            console.log('[PeakChart] ✅ Using closest date match:', {
              peakDate: peak.date,
              closestDate: dataPoint.date,
              diffDays: Math.round(minDiff / (24 * 60 * 60 * 1000)),
              maxAllowedDays: maxDiffDays,
            });
          } else {
            console.warn('[PeakChart] ⚠️ Closest date too far:', {
              peakDate: peak.date,
              closestDate: closestPoint.date,
              diffDays: Math.round(minDiff / (24 * 60 * 60 * 1000)),
              maxAllowedDays: maxDiffDays,
            });
          }
        }
      }
      
      if (!dataPoint) {
        console.warn('[PeakChart] ❌ No matching data point for peak after all strategies:', {
          peakDate: peak.date,
          peakKeyword: peak.keyword,
          peakValue: peak.value,
          availableDates: data.slice(0, 10).map(d => d.date),
          dataLength: data.length,
          firstFewDates: data.slice(0, 3).map(d => ({ date: d.date, value: d[keywords[0]] })),
        });
        return null;
      }
      
      // Find the actual peak point (highest value) in chart data around this date (within 14 days)
      // This ensures we're pointing to the actual peak, not just the closest date or a matched value
      const peakDate = new Date(peak.date);
      const searchWindow = 14 * 24 * 60 * 60 * 1000; // 14 days
      let actualPeakPoint = dataPoint;
      let actualPeakValue = Number(dataPoint[peak.keyword]) || 0;
      
      // Search for the highest value point within the search window
      for (const point of data) {
        try {
          const pointDate = new Date(point.date);
          const dateDiff = Math.abs(pointDate.getTime() - peakDate.getTime());
          if (dateDiff <= searchWindow) {
            const pointValue = Number(point[peak.keyword]) || 0;
            // Find the point with the highest value (the actual peak)
            if (pointValue > actualPeakValue) {
              actualPeakValue = pointValue;
              actualPeakPoint = point;
            }
          }
        } catch (e) {
          // Skip invalid dates
        }
      }
      
      // Use the actual peak value from the chart data to position the dot at the correct height
      const yValue = actualPeakValue;
      
      if (actualPeakPoint !== dataPoint) {
        console.log(`[PeakChart] ✅ Found actual peak point:`, {
          peakDate: peak.date,
          storedValue: peak.value,
          actualDate: actualPeakPoint.date,
          actualValue: actualPeakValue,
          originalMatchedDate: dataPoint.date,
          originalMatchedValue: Number(dataPoint[peak.keyword]),
        });
      }
      
      console.log('[PeakChart] ✅ Matched peak to data point:', {
        peakDate: peak.date,
        chartDate: actualPeakPoint.date,
        yValue,
        peakValue: peak.value,
        chartValue: Number(actualPeakPoint[peak.keyword]),
        keyword: peak.keyword,
      });
      return { ...peak, yValue, matchedDate: actualPeakPoint.date };
    })
    .filter((p): p is PeakExplanation & { yValue: number } => p !== null);
  
  console.log('[PeakChart] ========== PEAK DATA POINTS SUMMARY ==========');
  console.log('[PeakChart] Peak data points for chart', {
    totalPeaks: peakExplanations.length,
    peaksWithExplanations: peakExplanations.filter(p => p.explanation).length,
    matchedDataPoints: peakDataPoints.length,
    dataLength: data.length,
    hasData: data.length > 0,
    peakDataPoints: peakDataPoints.map(p => ({ 
      date: p.date, 
      explanation: p.explanation?.substring(0, 50), 
      yValue: p.yValue,
      keyword: p.keyword,
    })),
  });
  console.log('[PeakChart] ========== END PEAK DATA POINTS SUMMARY ==========');
  
  if (peakExplanations.length > 0 && peakDataPoints.length === 0) {
    console.warn('[PeakChart] ⚠️ WARNING: Have peak explanations but no matched data points!', {
      peakExplanations: peakExplanations.map(p => ({ date: p.date, keyword: p.keyword })),
      sampleDataDates: data.slice(0, 5).map(d => d.date),
    });
  }

  // Custom component to render peak annotations with proper positioning
  const PeakAnnotations = (props: any) => {
    console.log('[PeakAnnotations] Received props:', Object.keys(props || {}));
    
    // Customized component receives xAxisMap, yAxisMap, etc.
    const { xAxisMap, yAxisMap } = props;
    
    if (!xAxisMap || !yAxisMap || peakDataPoints.length === 0) {
      console.warn('[PeakAnnotations] Missing axis maps or no peaks', { 
        hasXAxisMap: !!xAxisMap, 
        hasYAxisMap: !!yAxisMap, 
        peakCount: peakDataPoints.length 
      });
      return null;
    }
    
    // Get the default axis scales
    const xAxis = xAxisMap[0];
    const yAxis = yAxisMap[0];
    
    if (!xAxis || !yAxis || !xAxis.scale || !yAxis.scale) {
      console.warn('[PeakAnnotations] Missing scales', { 
        hasXAxis: !!xAxis, 
        hasYAxis: !!yAxis,
        hasXScale: !!xAxis?.scale,
        hasYScale: !!yAxis?.scale
      });
      return null;
    }
    
    const xScale = xAxis.scale;
    const yScale = yAxis.scale;
    
    // First pass: calculate box dimensions and initial positions
    const boxData = peakDataPoints.map((peak, idx) => {
      let explanationText = peak.explanation || 'Peak';
      explanationText = explanationText
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
      const displayText = explanationText.length > 60 
        ? explanationText.substring(0, 57) + '...' 
        : explanationText;
      
      // Use the matched date for x position, but peak value for y position
      // This ensures the dot is at the correct peak height
      const peakDate = peak.matchedDate || peak.date;
      const peakX = xScale(peakDate);
      // Use the actual peak value (peak.value) for y position, not the matched data point value
      const peakY = yScale(peak.yValue);
      
      if (peakX === undefined || peakY === undefined || isNaN(peakX) || isNaN(peakY)) {
        return null;
      }
      
      const maxCharsPerLine = 20;
      const words = displayText.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      
      words.forEach((word) => {
        if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);
      
      const lineHeight = 16;
      const padding = 8;
      const boxWidth = Math.max(120, Math.max(...lines.map(l => l.length * 7.5)) + padding * 2);
      const boxHeight = lines.length * lineHeight + padding * 2;
      
      return {
        peak,
        x: peakX, // X position of the peak point
        y: peakY, // Y position of the peak point (at actual peak value)
        boxWidth,
        boxHeight,
        lines,
        displayText,
        idx
      };
    }).filter((item): item is NonNullable<typeof boxData[0]> => item !== null);
    
    // Sort by x position (left to right)
    boxData.sort((a, b) => a.x - b.x);
    
    // Position annotations so they DON'T hide the chart line
    // Strategy: give extra vertical gap and gently push overlapping boxes sideways + stack vertically
    const spacing = 10; // Minimum spacing between boxes
    const baseOffset = 22; // Gap between box bottom and peak point so the line remains visible
    const minY = 5; // Top margin
    
    // Sort boxes by X position (left to right) for consistent processing
    boxData.sort((a, b) => a.x - b.x);
    
    // First pass: assign initial positions - above each peak with good clearance
    for (let i = 0; i < boxData.length; i++) {
      const current = boxData[i];
      // Place annotation above peak with enough gap to see the chart line
      current.boxY = current.y - current.boxHeight - baseOffset;
      current.boxXOffset = 0; // Start centered on peak
      current.placeAbove = true;
    }
    
    // Second pass: resolve collisions with horizontal push + vertical stacking
    // Move apart sideways first so boxes don't sit directly over peaks/lines
    for (let iterations = 0; iterations < 20; iterations++) {
      let hasCollision = false;

      for (let i = 0; i < boxData.length; i++) {
        for (let j = i + 1; j < boxData.length; j++) {
          const left = boxData[i];
          const right = boxData[j];

          const leftLeft = (left.x - left.boxWidth / 2) + (left.boxXOffset || 0);
          const leftRight = (left.x + left.boxWidth / 2) + (left.boxXOffset || 0);
          const rightLeft = (right.x - right.boxWidth / 2) + (right.boxXOffset || 0);
          const rightRight = (right.x + right.boxWidth / 2) + (right.boxXOffset || 0);

          const horizontalOverlap = leftRight + spacing > rightLeft && leftLeft < rightRight + spacing;

          if (horizontalOverlap) {
            // Push horizontally away from each other
            hasCollision = true;
            const overlapAmount = (leftRight + spacing) - rightLeft;
            const shift = (overlapAmount / 2) + 6; // gentle push
            left.boxXOffset = (left.boxXOffset || 0) - shift;
            right.boxXOffset = (right.boxXOffset || 0) + shift;

            // Also check vertical overlap to stack if still overlapping after horizontal push
            const leftTop = left.boxY!;
            const leftBottom = leftTop + left.boxHeight;
            const rightTop = right.boxY!;
            const rightBottom = rightTop + right.boxHeight;
            const verticalOverlap = leftBottom + spacing > rightTop && leftTop < rightBottom + spacing;
            if (verticalOverlap) {
              right.boxY = leftTop - right.boxHeight - spacing;
            }
          }
        }
      }

      if (!hasCollision) break;
    }
    
    // Final pass: ensure boxes don't go off screen edges
    const chartWidth = xScale.range()[1] - xScale.range()[0];
    const maxX = xScale.range()[1] || chartWidth;
    const minX = xScale.range()[0] || 0;
    
    for (let i = 0; i < boxData.length; i++) {
      const current = boxData[i];
      
      // Ensure box doesn't go above chart area
      if (current.boxY! < minY) {
        current.boxY = minY;
      }
      
      // Ensure box doesn't go off right edge
      const currentRight = (current.x + current.boxWidth / 2) + (current.boxXOffset || 0);
      if (currentRight > maxX - 10) {
        current.boxXOffset = (current.boxXOffset || 0) - (currentRight - maxX + 10);
      }
      
      // Ensure box doesn't go off left edge
      const currentLeft = (current.x - current.boxWidth / 2) + (current.boxXOffset || 0);
      if (currentLeft < minX + 10) {
        current.boxXOffset = (current.boxXOffset || 0) + (minX + 10 - currentLeft);
      }
    }
    
    return (
      <g>
        {boxData.map((box) => {
          const boxXOffset = box.boxXOffset || 0;
          const boxX = box.x - box.boxWidth / 2 + boxXOffset;
          const boxY = box.boxY!;
          
          return (
            <g key={`peak-annotation-${box.peak.date}-${box.idx}`}>
              {/* Background box with transparency so chart line shows through */}
              <rect
                x={boxX}
                y={boxY}
                width={box.boxWidth}
                height={box.boxHeight}
                fill="#FAF9FF"
                fillOpacity={0.85}
                stroke="#DED8F7"
                strokeWidth={1}
                rx={6}
              />
              {/* Text lines */}
              {box.lines.map((line, lineIdx) => (
                <text
                  key={lineIdx}
                  x={box.x + boxXOffset}
                  y={boxY + 8 + (lineIdx + 1) * 16 - 3}
                  textAnchor="middle"
                  fill="#1a1a1a"
                  fontSize={13}
                  fontWeight={400}
                >
                  {line}
                </text>
              ))}
              {/* Arrow/line connecting to peak - always from bottom of box (above peak) */}
              <line
                x1={box.x + boxXOffset}
                y1={boxY + box.boxHeight}
                x2={box.x}
                y2={box.y}
                stroke="#9CA3AF"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
              {/* Peak dot */}
              <circle
                cx={box.x}
                cy={box.y}
                r={4}
                fill="#9CA3AF"
                stroke="white"
                strokeWidth={1}
              />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 60, right: 30, left: 20, bottom: 40 }}>
          <XAxis 
            dataKey="date" 
            stroke="#666"
            fontSize={12}
          />
          <YAxis 
            stroke="#666"
            fontSize={12}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Legend />
          {keywords.map((keyword, index) => (
            <Line
              key={keyword}
              type="monotone"
              dataKey={keyword}
              stroke={colors[index % colors.length]}
              strokeWidth={strokeWidth}
              dot={false}
              activeDot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GoogleTrendsChartRedis;
