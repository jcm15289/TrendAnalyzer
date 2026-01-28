'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Eye, EyeOff, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCompanyName } from '@/lib/ticker-names';
import { calculateIntelPeak } from '@/lib/intel-peak';

interface TickerKeyword {
  ticker: string;
  keyword: string;
  trendKey: string;
}

interface TickerGroup {
  baseTicker: string;
  keywords: TickerKeyword[];
}

interface TrendDataPoint {
  date: string;
  [keyword: string]: string | number;
}

interface TickerTrendsCardProps {
  tickerGroup: TickerGroup;
  isWideLayout?: boolean;
  filteredKeywords: TickerKeyword[];
  onDataFound?: (ticker: string, hasData: boolean) => void;
  onGrowthComputed?: (
    ticker: string,
    summary: {
      bestLabel?: string;
      bestPercent?: number | null;
      intelPeak?: number | null;
    } | null
  ) => void;
  growthMode?: 'area' | 'peak' | 'both' | 'intelpeak';
  showGrowthPercentage?: boolean;
  showGrowthDetails?: boolean;
}

// Colors for different trend lines
const LINE_COLORS = [
  '#3B82F6', // Blue
  '#F87171', // Soft Red (was #EF4444)
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
];

export function TickerTrendsCard({ tickerGroup, filteredKeywords = [], isWideLayout = false, onDataFound, onGrowthComputed, growthMode = 'intelpeak', showGrowthPercentage = false, showGrowthDetails = false }: TickerTrendsCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [combinedData, setCombinedData] = useState<TrendDataPoint[]>([]);
  const [foundKeywords, setFoundKeywords] = useState<string[]>([]);
  const [enabledKeywords, setEnabledKeywords] = useState<Set<string>>(new Set());
  const [growthSummary, setGrowthSummary] = useState<{
    bestLabel?: string;
    bestPercent?: number | null;
    intelPeak?: number | null;
  } | null>(null);
  const [growthDetails, setGrowthDetails] = useState<{
    windowSummaries: Array<{
      label: string;
      months: number;
      lastSum: number;
      prevSum: number;
      areaPercent: number | null;
      lastMax: number;
      prevMax: number;
      peakPercent: number | null;
      lastMaxDate?: Date;
      prevMaxDate?: Date;
      lastWindowStart: Date;
      prevWindowStart: Date;
    }>;
    bestAreaWindow: { label: string; percent: number | null } | null;
    bestPeakWindow: { label: string; percent: number | null } | null;
    intelPeakDetails: {
      peakDate: Date | null;
      peakDuration: number;
      peakArea: number;
      baselineArea: number;
      ratio: number | null;
      peakStartDate: Date | null;
      peakEndDate: Date | null;
      baselineStartDate: Date | null;
      baselineEndDate: Date | null;
      higherPeaksCount?: number;
    } | null;
  } | null>(null);
  
  // Ensure filteredKeywords is always an array
  const safeFilteredKeywords = Array.isArray(filteredKeywords) ? filteredKeywords : [];
  
  // Use ref to avoid infinite loops with onGrowthComputed
  const onGrowthComputedRef = React.useRef(onGrowthComputed);
  React.useEffect(() => {
    onGrowthComputedRef.current = onGrowthComputed;
  }, [onGrowthComputed]);
  
  // Format number with commas
  const formatNumberWithCommas = (num: number): string => {
    return num.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };


  const fetchTrends = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build comma-separated list of trend keys
      const trendKeys = tickerGroup.keywords.map(k => k.trendKey).join(',');
      const response = await fetch(`/api/redis/ticker-trends?keys=${encodeURIComponent(trendKeys)}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch trends');
      }

      const trendData = result.combinedData || [];
      setCombinedData(trendData);
      
      // Track which keywords were found from API (these are the actual data keys, e.g., "Googlelogin")
      const normalizeKeyword = (kw: string) => kw.replace(/\s+/g, '').toLowerCase();
      const found = result.results
        .filter((r: any) => r.found)
        .map((r: any) => r.keyword); // These are API keywords like "Googlelogin"
      setFoundKeywords(found);
      
      // Create a mapping from API keywords (no spaces) to tickerGroup keywords (with spaces)
      const apiToDisplayMap = new Map<string, string>();
      tickerGroup.keywords.forEach(tk => {
        const normalized = normalizeKeyword(tk.keyword);
        // Find matching API keyword
        const matchingApiKeyword = found.find(fk => normalizeKeyword(fk) === normalized);
        if (matchingApiKeyword) {
          apiToDisplayMap.set(matchingApiKeyword, tk.keyword);
        }
      });
      
      // Notify parent about data availability
      if (onDataFound) {
        onDataFound(tickerGroup.baseTicker, found.length > 0);
      }
      
      // Enable keywords based on pre-filtered keywords from the page
      const enabledDisplayKeywords = safeFilteredKeywords
        .map(kw => kw.keyword)
        .filter(displayKw => Array.from(apiToDisplayMap.values()).includes(displayKw));
      setEnabledKeywords(new Set(enabledDisplayKeywords));
    } catch (err) {
      console.error('Error fetching ticker trends:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Notify parent that no data was found
      if (onDataFound) {
        onDataFound(tickerGroup.baseTicker, false);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [tickerGroup.baseTicker]);
  
  // Update enabled keywords when filtered keywords change - auto-enable all filtered keywords
  useEffect(() => {
    if (!foundKeywords.length) {
      // If no keywords found, clear enabled keywords
      setEnabledKeywords(new Set());
      return;
    }
    
    const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
    const apiToDisplayMap = new Map<string, string>();
    tickerGroup.keywords.forEach(tk => {
      const normalized = normalizeKeyword(tk.keyword);
      const matchingApiKeyword = foundKeywords.find(fk => normalizeKeyword(fk) === normalized);
      if (matchingApiKeyword) {
        apiToDisplayMap.set(matchingApiKeyword, tk.keyword);
      }
    });
    
    // Auto-enable all filtered keywords (when label is selected, show all matching keywords)
    const enabledDisplayKeywords = safeFilteredKeywords
      .map(kw => kw.keyword)
      .filter(displayKw => Array.from(apiToDisplayMap.values()).includes(displayKw));
    
    setEnabledKeywords(new Set(enabledDisplayKeywords));
  }, [safeFilteredKeywords, foundKeywords, tickerGroup.keywords]);

  // Calculate growth metrics
  useEffect(() => {
    const callback = onGrowthComputedRef.current;
    if (!callback || !combinedData.length || !foundKeywords.length) {
      return;
    }

    // Use the first found keyword for growth calculation
    const mainKeyword = foundKeywords[0];
    if (!mainKeyword) {
      return;
    }

    // Parse data points
    const parsed = combinedData
      .map((point) => {
        const date = point.date ? new Date(point.date) : null;
        const value = point[mainKeyword] != null ? Number(point[mainKeyword]) : null;
        return date && !Number.isNaN(date.getTime()) && typeof value === 'number' && !Number.isNaN(value)
          ? { date, value }
          : null;
      })
      .filter((entry): entry is { date: Date; value: number } => entry !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (parsed.length === 0) {
      console.warn(`[TickerTrendsCard] ${tickerGroup.baseTicker}: No parsed data for growth calculation`, {
        mainKeyword,
        combinedDataLength: combinedData.length,
        samplePoint: combinedData[0],
        availableKeys: combinedData.length > 0 ? Object.keys(combinedData[0]) : [],
      });
      return;
    }
    
    console.log(`[TickerTrendsCard] ${tickerGroup.baseTicker}: Parsed ${parsed.length} data points for growth calculation`, {
      mainKeyword,
      firstDate: parsed[0]?.date.toISOString(),
      lastDate: parsed[parsed.length - 1]?.date.toISOString(),
      sampleValues: parsed.slice(0, 5).map(p => ({ date: p.date.toISOString(), value: p.value })),
      totalSum: parsed.reduce((sum, p) => sum + p.value, 0),
    });

    // Calculate window summaries (3m, 6m, 12m)
    const windowsToEvaluate = [3, 6, 12];
    const latestEntry = parsed[parsed.length - 1];

    const windowSummaries = windowsToEvaluate.map((months) => {
      const days = months * 30;
      const lastWindowStart = new Date(latestEntry.date);
      lastWindowStart.setDate(lastWindowStart.getDate() - days);
      const prevWindowStart = new Date(lastWindowStart);
      prevWindowStart.setDate(prevWindowStart.getDate() - days);

      let lastSum = 0;
      let prevSum = 0;
      const lastValues: number[] = [];
      const prevValues: number[] = [];
      const lastDates: Date[] = [];
      const prevDates: Date[] = [];
      parsed.forEach(({ date, value }) => {
        // Use > (not >=) to avoid double-counting boundary dates
        // lastWindowStart is the start of the current window, prevWindowStart is the start of previous window
        if (date > lastWindowStart) {
          lastSum += value;
          lastValues.push(value);
          lastDates.push(date);
        } else if (date > prevWindowStart) {
          prevSum += value;
          prevValues.push(value);
          prevDates.push(date);
        }
        // Dates <= prevWindowStart are ignored (too old)
      });
      
      // Additional validation: ensure we have data in windows
      if (lastValues.length === 0 && prevValues.length === 0) {
        console.warn(`[AreaAlgorithm] ${tickerGroup.baseTicker} ${months}m: No data found in either window`, {
          latestEntryDate: latestEntry.date.toISOString(),
          lastWindowStart: lastWindowStart.toISOString(),
          prevWindowStart: prevWindowStart.toISOString(),
          totalParsedPoints: parsed.length,
          firstParsedDate: parsed[0]?.date.toISOString(),
          lastParsedDate: parsed[parsed.length - 1]?.date.toISOString(),
        });
      }

      // Detect actual peaks (local maxima) in each window, not just max values
      const detectPeaksInWindow = (values: number[], dates: Date[]): { value: number; date: Date | undefined } => {
        if (values.length === 0) return { value: 0, date: undefined };
        if (values.length === 1) return { value: values[0], date: dates[0] };
        
        // Find local maxima (peaks) - points that are higher than their neighbors
        const peaks: Array<{ value: number; date: Date; index: number }> = [];
        
        // Check first point
        if (values.length > 1 && values[0] > values[1] && values[0] > 0) {
          peaks.push({ value: values[0], date: dates[0], index: 0 });
        }
        
        // Check middle points
        for (let i = 1; i < values.length - 1; i++) {
          if (values[i] > values[i - 1] && values[i] > values[i + 1] && values[i] > 0) {
            peaks.push({ value: values[i], date: dates[i], index: i });
          }
        }
        
        // Check last point
        if (values.length > 1 && values[values.length - 1] > values[values.length - 2] && values[values.length - 1] > 0) {
          peaks.push({ 
            value: values[values.length - 1], 
            date: dates[dates.length - 1], 
            index: values.length - 1 
          });
        }
        
        // If no peaks found, return the max value (but this shouldn't be called a "peak")
        if (peaks.length === 0) {
          const maxValue = Math.max(...values);
          const maxIndex = values.indexOf(maxValue);
          return { value: maxValue, date: maxIndex >= 0 ? dates[maxIndex] : undefined };
        }
        
        // Return the highest peak
        const highestPeak = peaks.reduce((max, peak) => peak.value > max.value ? peak : max);
        return { value: highestPeak.value, date: highestPeak.date };
      };
      
      const lastPeak = detectPeaksInWindow(lastValues, lastDates);
      const prevPeak = detectPeaksInWindow(prevValues, prevDates);
      
      const lastMax = lastPeak.value;
      const prevMax = prevPeak.value;
      const lastMaxDate = lastPeak.date;
      const prevMaxDate = prevPeak.date;
      
      // Debug logging to help diagnose window calculation issues
      if (lastMax >= 90 || prevMax >= 90) {
        console.log(`[PeakAlgorithm] ${months}m window calculation:`, {
          latestEntryDate: latestEntry.date.toISOString(),
          lastWindowStart: lastWindowStart.toISOString(),
          prevWindowStart: prevWindowStart.toISOString(),
          lastWindowDataPoints: lastValues.length,
          prevWindowDataPoints: prevValues.length,
          lastMax,
          prevMax,
          lastMaxDate: lastMaxDate?.toISOString() || 'N/A',
          prevMaxDate: prevMaxDate?.toISOString() || 'N/A',
          lastWindowSampleValues: lastValues.slice(0, 5),
          prevWindowSampleValues: prevValues.slice(0, 5),
        });
      }

      let areaPercent: number | null = null;
      if (prevSum === 0) {
        areaPercent = lastSum > 0 ? 100 : 0;
      } else {
        areaPercent = ((lastSum - prevSum) / prevSum) * 100;
      }
      
      // Detailed logging for Area algorithm formula
      console.log(`[AreaAlgorithm] ${tickerGroup.baseTicker} ${months}m window calculation:`, {
        formula: 'areaPercent = ((lastSum - prevSum) / prevSum) * 100',
        latestEntryDate: latestEntry.date.toISOString(),
        lastWindowStart: lastWindowStart.toISOString(),
        prevWindowStart: prevWindowStart.toISOString(),
        lastWindowEnd: latestEntry.date.toISOString(),
        prevWindowEnd: lastWindowStart.toISOString(),
        lastWindowDataPoints: lastValues.length,
        prevWindowDataPoints: prevValues.length,
        lastSum,
        prevSum,
        calculation: `((${lastSum} - ${prevSum}) / ${prevSum}) * 100`,
        areaPercent,
        lastWindowSampleValues: lastValues.slice(0, 10),
        prevWindowSampleValues: prevValues.slice(0, 10),
        lastWindowSampleDates: lastDates.slice(0, 5).map(d => d.toISOString().split('T')[0]),
        prevWindowSampleDates: prevDates.slice(0, 5).map(d => d.toISOString().split('T')[0]),
      });
      
      // Detailed logging for Area algorithm formula
      console.log(`[AreaAlgorithm] ${tickerGroup.baseTicker} ${months}m window calculation:`, {
        formula: 'areaPercent = ((lastSum - prevSum) / prevSum) * 100',
        latestEntryDate: latestEntry.date.toISOString(),
        windowBoundaries: {
          lastWindowStart: lastWindowStart.toISOString(),
          lastWindowEnd: latestEntry.date.toISOString(),
          prevWindowStart: prevWindowStart.toISOString(),
          prevWindowEnd: lastWindowStart.toISOString(),
        },
        dataPoints: {
          lastWindowCount: lastValues.length,
          prevWindowCount: prevValues.length,
          totalParsedPoints: parsed.length,
        },
        sums: {
          lastSum,
          prevSum,
          calculation: `((${lastSum} - ${prevSum}) / ${prevSum}) * 100`,
          result: areaPercent,
        },
        sampleData: {
          lastWindowValues: lastValues.slice(0, 10),
          prevWindowValues: prevValues.slice(0, 10),
          lastWindowDates: lastDates.slice(0, 5).map(d => d.toISOString().split('T')[0]),
          prevWindowDates: prevDates.slice(0, 5).map(d => d.toISOString().split('T')[0]),
        },
      });

      let peakPercent: number | null = null;
      if (prevMax === 0) {
        peakPercent = lastMax > 0 ? 100 : 0;
      } else {
        peakPercent = ((lastMax - prevMax) / prevMax) * 100;
      }

      return {
        label: `${months}m`,
        months,
        lastSum,
        prevSum,
        areaPercent,
        lastMax,
        prevMax,
        peakPercent,
        lastMaxDate,
        prevMaxDate,
        lastWindowStart,
        prevWindowStart,
      };
    });

    const bestAreaWindow = windowSummaries.reduce((best, current) => {
      const currentPercent = current.areaPercent ?? -Infinity;
      const bestPercent = best ? best.areaPercent ?? -Infinity : -Infinity;
      return currentPercent > bestPercent ? current : best;
    }, null as (typeof windowSummaries)[number] | null);

    const bestPeakWindow = windowSummaries.reduce((best, current) => {
      const currentPercent = current.peakPercent ?? -Infinity;
      const bestPercent = best ? best.peakPercent ?? -Infinity : -Infinity;
      return currentPercent > bestPercent ? current : best;
    }, null as (typeof windowSummaries)[number] | null);

    // Calculate IntelPeak
    let intelPeak: number | null = null;
    let intelPeakDetails = null;
    try {
      const intelPeakResult = calculateIntelPeak(parsed);
      intelPeak = intelPeakResult.intelPeak;
      intelPeakDetails = {
        peakDate: intelPeakResult.peakDate,
        peakDuration: intelPeakResult.peakDuration,
        peakArea: intelPeakResult.peakArea,
        baselineArea: intelPeakResult.baselineArea,
        ratio: intelPeakResult.ratio,
        peakStartDate: intelPeakResult.peakStartDate,
        peakEndDate: intelPeakResult.peakEndDate,
        baselineStartDate: intelPeakResult.baselineStartDate,
        baselineEndDate: intelPeakResult.baselineEndDate,
        higherPeaksCount: intelPeakResult.higherPeaksCount,
      };
    } catch (error) {
      console.error('[TickerTrendsCard] Error calculating IntelPeak:', error);
    }

    // Determine best percent based on growth mode
    let bestPercent: number | null = null;
    let bestLabel: string = 'n/a';

    if (growthMode === 'intelpeak' && intelPeak !== null) {
      bestPercent = intelPeak;
      bestLabel = 'IntelPeak';
    } else if (growthMode === 'area' && bestAreaWindow) {
      bestPercent = bestAreaWindow.areaPercent;
      bestLabel = bestAreaWindow.label;
    } else if (growthMode === 'peak' && bestPeakWindow) {
      bestPercent = bestPeakWindow.peakPercent;
      bestLabel = bestPeakWindow.label;
    } else if (growthMode === 'both') {
      // For 'both', use the better of area or peak
      const areaPercent = bestAreaWindow?.areaPercent ?? -Infinity;
      const peakPercent = bestPeakWindow?.peakPercent ?? -Infinity;
      if (areaPercent > peakPercent) {
        bestPercent = areaPercent;
        bestLabel = bestAreaWindow?.label ?? 'n/a';
      } else {
        bestPercent = peakPercent;
        bestLabel = bestPeakWindow?.label ?? 'n/a';
      }
    }

    const summary = {
      bestLabel,
      bestPercent,
      intelPeak,
    };
    setGrowthSummary(summary);
    
    // Store detailed calculation data for debug display
    setGrowthDetails({
      windowSummaries,
      bestAreaWindow: bestAreaWindow ? { label: bestAreaWindow.label, percent: bestAreaWindow.areaPercent } : null,
      bestPeakWindow: bestPeakWindow ? { label: bestPeakWindow.label, percent: bestPeakWindow.peakPercent } : null,
      intelPeakDetails,
    });
    
    callback(tickerGroup.baseTicker, summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedData.length, foundKeywords.length, tickerGroup.baseTicker, growthMode]);

  const toggleKeyword = (keyword: string) => {
    setEnabledKeywords(prev => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  };

  const toggleAll = () => {
    // Create a mapping from API keywords to display keywords
    const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
    const apiToDisplayMap = new Map<string, string>();
    tickerGroup.keywords.forEach(tk => {
      const normalized = normalizeKeyword(tk.keyword);
      const matchingApiKeyword = foundKeywords.find(fk => normalizeKeyword(fk) === normalized);
      if (matchingApiKeyword) {
        apiToDisplayMap.set(matchingApiKeyword, tk.keyword);
      }
    });
    const allDisplayKeywords = safeFilteredKeywords
      .map(kw => kw.keyword)
      .filter(displayKw => Array.from(apiToDisplayMap.values()).includes(displayKw));
    
    const allEnabled = enabledKeywords.size === allDisplayKeywords.length;

    if (allEnabled) {
      // All enabled, disable all
      setEnabledKeywords(new Set());
    } else {
      // Some or none enabled, enable all
      setEnabledKeywords(new Set(allDisplayKeywords));
    }
  };

  // Filter data to include filtered keywords (for chart) and enabled keywords (for display control)
  const filteredData = useMemo(() => {
    // Create a mapping from display keywords (with spaces) to API keywords (no spaces)
    const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
    const displayToApiMap = new Map<string, string>();
    safeFilteredKeywords.forEach(tk => {
      const normalized = normalizeKeyword(tk.keyword);
      const matchingApiKeyword = foundKeywords.find(fk => normalizeKeyword(fk) === normalized);
      if (matchingApiKeyword) {
        displayToApiMap.set(tk.keyword, matchingApiKeyword);
      }
    });
    
    return combinedData.map(point => {
      const filtered: TrendDataPoint = { date: point.date };
      let hasAnyLine = false; // Track if any line (trend or price) has data for this point
      
      // Include ALL filtered keywords (not just enabled ones) - this ensures chart lines show
      // The enabledKeywords control visibility via the Line component rendering, but data must be present
      safeFilteredKeywords.forEach(tk => {
        const apiKw = displayToApiMap.get(tk.keyword);
        if (apiKw && point[apiKw] !== undefined && point[apiKw] !== null) {
          filtered[apiKw] = point[apiKw];
          hasAnyLine = true;
        }
      });
      
      // Include point if it has any data
      return hasAnyLine ? filtered : null;
    }).filter(Boolean) as TrendDataPoint[];
  }, [combinedData, foundKeywords, safeFilteredKeywords]);
  

  const strokeWidth = isWideLayout ? 2 : 1.5;
  
  // Get company name from keywords
  const companyName = useMemo(() => {
    const keywords = tickerGroup.keywords.map(k => k.keyword);
    return getCompanyName(tickerGroup.baseTicker, keywords);
  }, [tickerGroup]);

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[#FF6B35]" />
            {companyName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-muted-foreground">Loading trends...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Hide cards with errors or no data found
  if (error || foundKeywords.length === 0) {
    return null;
  }

  if (foundKeywords.length === 0) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[#FF6B35]" />
            {tickerGroup.baseTicker}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">No trend data found</p>
              <p className="text-sm">
                Searched for: {tickerGroup.keywords.map(k => k.trendKey).join(', ')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Hide cards when the filtered keywords have no matching data
  const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
  
  // Check if any of the filtered keywords actually have data in Redis
  const hasFilteredKeywordData = safeFilteredKeywords.length > 0 && safeFilteredKeywords.some(kw =>
    foundKeywords.some(fk => normalizeKeyword(fk) === normalizeKeyword(kw.keyword))
  );
  
  // If no filtered keywords were provided, check if any keywords have data
  const hasAnyKeywordData = foundKeywords.length > 0;
  
  // Hide card if there are no trend keywords with data (only price data is not enough)
  // If filteredKeywords were provided (label filter active), we must have matching data
  // If no filteredKeywords (all labels), we need at least some keyword data
  if (safeFilteredKeywords.length > 0) {
    // Label filter is active - must have matching trend data
    if (!hasFilteredKeywordData) {
      return null; // Hide if no matching trend data (even if price exists)
    }
  } else {
    // No label filter - need at least some trend data
    if (!hasAnyKeywordData) {
      return null;
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[#FF6B35]" />
            {companyName}
            <Badge variant="secondary" className="text-xs">
              {foundKeywords.length} lines
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showGrowthPercentage && growthSummary && growthSummary.bestPercent !== null && growthSummary.bestPercent !== undefined && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xl font-semibold text-emerald-600 shrink-0">
                  {growthSummary.bestPercent >= 0 ? '+' : ''}{formatNumberWithCommas(growthSummary.bestPercent)}%
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {growthSummary.bestLabel || 'Peak'}
                  </span>
                </span>
                {showGrowthDetails && growthDetails && (
                  <div className="flex flex-col gap-2 text-xs text-muted-foreground mt-1 max-w-lg">
                    {/* IntelPeak details */}
                    {growthDetails.intelPeakDetails && growthSummary.intelPeak !== null && (
                      <div className="flex flex-col gap-1 p-2 bg-purple-50 rounded border border-purple-200">
                        <div className="font-semibold text-purple-700 text-[10px] uppercase tracking-wide">IntelPeak</div>
                        <div className="flex items-center gap-2">
                          <span className={growthSummary.intelPeak >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                            {growthSummary.intelPeak >= 0 ? '+' : ''}{growthSummary.intelPeak.toFixed(1)}%
                          </span>
                          <span className="text-[10px]">
                            Peak area: {growthDetails.intelPeakDetails.peakArea.toFixed(0)} | Baseline: {growthDetails.intelPeakDetails.baselineArea.toFixed(0)}
                            {growthDetails.intelPeakDetails.ratio && ` | Ratio: ${growthDetails.intelPeakDetails.ratio.toFixed(2)}x`}
                          </span>
                        </div>
                        {growthDetails.intelPeakDetails.peakDuration > 0 && (
                          <div className="text-[10px]">
                            Duration: {growthDetails.intelPeakDetails.peakDuration} days
                            {growthDetails.intelPeakDetails.higherPeaksCount !== undefined && growthDetails.intelPeakDetails.higherPeaksCount > 0 && (
                              <span className="text-blue-600"> | Higher peaks: {growthDetails.intelPeakDetails.higherPeaksCount}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Area details */}
                    {(growthMode === 'area' || growthMode === 'both') && (
                      <div className="flex flex-col gap-1 p-2 bg-blue-50 rounded border border-blue-200">
                        <div className="font-semibold text-blue-700 text-[10px] uppercase tracking-wide">Area Algorithm</div>
                        {growthDetails.bestAreaWindow && (
                          <div className="flex items-center gap-2">
                            <span className={growthDetails.bestAreaWindow.percent !== null && growthDetails.bestAreaWindow.percent >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                              {growthDetails.bestAreaWindow.percent !== null ? `${growthDetails.bestAreaWindow.percent >= 0 ? '+' : ''}${growthDetails.bestAreaWindow.percent.toFixed(1)}%` : 'N/A'}
                            </span>
                            <span className="text-[10px]">Best window: {growthDetails.bestAreaWindow.label}</span>
                          </div>
                        )}
                        <div className="flex flex-col gap-1 text-[10px]">
                          {growthDetails.windowSummaries.map((window) => (
                            <div key={`area-${window.label}`} className="flex flex-col">
                              <span>
                                {window.label}: {window.areaPercent !== null ? `${window.areaPercent >= 0 ? '+' : ''}${window.areaPercent.toFixed(1)}%` : 'N/A'}
                                <span className="text-muted-foreground"> (Σ {Math.round(window.lastSum)}/{Math.round(window.prevSum)})</span>
                              </span>
                              <span className="text-[9px] text-muted-foreground ml-1">
                                Formula: (({Math.round(window.lastSum)} - {Math.round(window.prevSum)}) / {Math.round(window.prevSum)}) × 100
                                {window.lastWindowStart && window.prevWindowStart && (
                                  <>
                                    <br />
                                    Current window: {new Date(window.lastWindowStart).toLocaleDateString()} to {combinedData.length > 0 ? new Date(combinedData[combinedData.length - 1].date).toLocaleDateString() : 'now'}
                                    <br />
                                    Previous window: {new Date(window.prevWindowStart).toLocaleDateString()} to {new Date(window.lastWindowStart).toLocaleDateString()}
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Peak details */}
                    {(growthMode === 'peak' || growthMode === 'both') && (
                      <div className="flex flex-col gap-1 p-2 bg-green-50 rounded border border-green-200">
                        <div className="font-semibold text-green-700 text-[10px] uppercase tracking-wide">Peak Algorithm</div>
                        {growthDetails.bestPeakWindow && (
                          <div className="flex items-center gap-2">
                            <span className={growthDetails.bestPeakWindow.percent !== null && growthDetails.bestPeakWindow.percent >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                              {growthDetails.bestPeakWindow.percent !== null ? `${growthDetails.bestPeakWindow.percent >= 0 ? '+' : ''}${growthDetails.bestPeakWindow.percent.toFixed(1)}%` : 'N/A'}
                            </span>
                            <span className="text-[10px]">Best window: {growthDetails.bestPeakWindow.label}</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          {growthDetails.windowSummaries.map((window) => (
                            <div key={`peak-${window.label}`} className="flex flex-col">
                              <span>
                                {window.label}: {window.peakPercent !== null ? `${window.peakPercent >= 0 ? '+' : ''}${window.peakPercent.toFixed(1)}%` : 'N/A'}
                                <span className="text-muted-foreground"> (max {Math.round(window.lastMax)}/{Math.round(window.prevMax)})</span>
                              </span>
                              {(window.lastMaxDate || window.prevMaxDate) && (
                                <span className="text-[9px] text-muted-foreground ml-1">
                                  {window.lastMaxDate && `Peak: ${window.lastMaxDate.toLocaleDateString()}`}
                                  {window.lastMaxDate && window.prevMaxDate && ' • '}
                                  {window.prevMaxDate && `Prev: ${window.prevMaxDate.toLocaleDateString()}`}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
              className="text-xs"
            >
              {enabledKeywords.size === foundKeywords.length ? (
                <><EyeOff className="h-3 w-3 mr-1" /> Hide All</>
              ) : (
                <><Eye className="h-3 w-3 mr-1" /> Show All</>
              )}
            </Button>
          </div>
        </div>
        
        {/* Keyword toggles - only show found keywords, deduplicated and sorted */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(() => {
            const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
            const seenKeywords = new Set<string>();
            
            // Filter and deduplicate keywords
            const filteredKeywordsForDisplay = safeFilteredKeywords.filter(kw => {
              // Only show keywords that were found in Redis
              const isFound = foundKeywords.some(fk => 
                normalizeKeyword(fk) === normalizeKeyword(kw.keyword)
              );
              if (!isFound) return false;
              
              // Deduplicate by normalized keyword
              const normalized = normalizeKeyword(kw.keyword);
              if (seenKeywords.has(normalized)) return false;
              seenKeywords.add(normalized);
              return true;
            });
            
            // Sort keywords: main keyword first, then "login", then "sign up", then rest
            const sortedKeywords = (() => {
              const normalize = (k: string) => k.replace(/\s+/g, '').toLowerCase();
              
              // Separate keywords into groups
              const mainKeywords: typeof filteredKeywords = [];
              const loginKeywords: typeof filteredKeywords = [];
              const signUpKeywords: typeof filteredKeywords = [];
              const otherKeywords: typeof filteredKeywords = [];
              
              filteredKeywordsForDisplay.forEach(kw => {
                const norm = normalize(kw.keyword);
                if (norm.includes('login') && !norm.includes('signup')) {
                  loginKeywords.push(kw);
                } else if (norm.includes('signup')) {
                  signUpKeywords.push(kw);
                } else {
                  mainKeywords.push(kw);
                }
              });
              
              // Sort main keywords by length (shortest first = main company name)
              mainKeywords.sort((a, b) => a.keyword.length - b.keyword.length);
              
              // Combine: main first, then login, then sign up, then rest
              return [
                ...mainKeywords,
                ...loginKeywords,
                ...signUpKeywords,
                ...otherKeywords,
              ];
            })();
            
            // Create a map from keyword to its index in sortedKeywords for consistent color assignment
            const keywordToIndexMap = new Map<string, number>();
            sortedKeywords.forEach((kw, idx) => {
              keywordToIndexMap.set(kw.keyword, idx);
            });
            
            return sortedKeywords.map((kw) => {
                const isEnabled = enabledKeywords.has(kw.keyword);
                const colorIdx = keywordToIndexMap.get(kw.keyword) ?? 0;
                const color = LINE_COLORS[colorIdx % LINE_COLORS.length];

                return (
                  <button
                    key={kw.trendKey}
                    onClick={() => toggleKeyword(kw.keyword)}
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
                      isEnabled
                        ? 'shadow-sm border-2'
                        : 'opacity-50 border border-dashed',
                    )}
                    style={{
                      backgroundColor: isEnabled ? `${color}15` : 'transparent',
                      borderColor: color,
                      color: isEnabled ? color : '#555',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isEnabled ? color : '#ccc' }}
                    />
                    {kw.keyword}
                  </button>
                );
              });
          })()}
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="date"
                stroke="#666"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="trends"
                stroke="#666"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                label={{ value: 'Trends', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
                formatter={(value: any, name: string) => {
                  return [value, name];
                }}
              />
              <Legend />
              {(() => {
                // Use the same sorting logic as labels to ensure consistent color assignment
                const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
                const seenKeywords = new Set<string>();
                
                // Filter and deduplicate keywords (same as labels)
                const filteredKeywordsForDisplay = safeFilteredKeywords.filter(kw => {
                  const isFound = foundKeywords.some(fk => 
                    normalizeKeyword(fk) === normalizeKeyword(kw.keyword)
                  );
                  if (!isFound) return false;
                  
                  const normalized = normalizeKeyword(kw.keyword);
                  if (seenKeywords.has(normalized)) return false;
                  seenKeywords.add(normalized);
                  return true;
                });
                
                // Sort keywords (same as labels)
                const sortedKeywords = (() => {
                  const normalize = (k: string) => k.replace(/\s+/g, '').toLowerCase();
                  const mainKeywords: typeof filteredKeywords = [];
                  const loginKeywords: typeof filteredKeywords = [];
                  const signUpKeywords: typeof filteredKeywords = [];
                  const otherKeywords: typeof filteredKeywords = [];
                  
                  filteredKeywordsForDisplay.forEach(kw => {
                    const norm = normalize(kw.keyword);
                    if (norm.includes('login') && !norm.includes('signup')) {
                      loginKeywords.push(kw);
                    } else if (norm.includes('signup')) {
                      signUpKeywords.push(kw);
                    } else {
                      mainKeywords.push(kw);
                    }
                  });
                  
                  mainKeywords.sort((a, b) => a.keyword.length - b.keyword.length);
                  
                  return [
                    ...mainKeywords,
                    ...loginKeywords,
                    ...signUpKeywords,
                    ...otherKeywords,
                  ];
                })();
                
                const trendLines = sortedKeywords.map((kw, idx) => {
                  // Only show lines for enabled keywords
                  if (!enabledKeywords.has(kw.keyword)) {
                    return null;
                  }
                  
                  const normalizedTickerKeyword = normalizeKeyword(kw.keyword);
                  // Find the API keyword (data key) that matches this tickerGroup keyword
                  const apiKeyword = foundKeywords.find(fk => normalizeKeyword(fk) === normalizedTickerKeyword);
                  if (!apiKeyword) return null;
                  
                  // Check if this keyword has data in filteredData
                  const hasData = filteredData.some(point => point[apiKeyword] !== undefined && point[apiKeyword] !== null);
                  if (!hasData) return null;
                  
                  // Use the same index as labels for consistent color
                  const color = LINE_COLORS[idx % LINE_COLORS.length];
                
                  return (
                    <Line
                      key={kw.keyword}
                      yAxisId="trends"
                      type="monotone"
                      dataKey={apiKeyword} // Use API keyword (no spaces) as dataKey
                      stroke={color}
                      strokeWidth={strokeWidth}
                      dot={false}
                      activeDot={{ r: 4, fill: color }}
                      name={kw.keyword} // Display name with spaces
                    />
                  );
                }).filter(Boolean);
                
                // If there are no trend lines, don't render the chart (even if price exists)
                if (trendLines.length === 0) {
                  return null;
                }
                
                return trendLines;
              })()}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default TickerTrendsCard;
