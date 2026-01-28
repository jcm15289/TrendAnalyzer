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
  const [stockPriceData, setStockPriceData] = useState<Array<{ date: string; close: number }>>([]);
  const [hasStockData, setHasStockData] = useState(false);
  const [isPriceEnabled, setIsPriceEnabled] = useState(true);
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

  const fetchStockPrice = async (ticker: string) => {
    try {
      const response = await fetch(`/api/redis/stock?symbol=${ticker}`);
      if (!response.ok) return null;
      
      const result = await response.json();
      if (!result.success || !result.data || result.data.length === 0) return null;
      
      // Normalize stock price data to match trend data format
      // Stock data has { date, close } format
      return result.data.map((item: any) => ({
        date: item.date,
        close: item.close || item.price || 0,
      }));
    } catch (err) {
      console.warn(`Failed to fetch stock price for ${ticker}:`, err);
      return null;
    }
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

      let trendData = result.combinedData || [];
      
      // Fetch stock price data
      const stockData = await fetchStockPrice(tickerGroup.baseTicker);
      if (stockData && stockData.length > 0) {
        setStockPriceData(stockData);
        setHasStockData(true);
        
        // Normalize dates for matching (handle different formats)
        const normalizeDate = (dateStr: string | Date): string => {
          if (!dateStr) return '';
          // If already a Date object
          if (dateStr instanceof Date) {
            return dateStr.toISOString().split('T')[0];
          }
          // If already in YYYY-MM-DD format, return as-is
          if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr;
          }
          // Try to parse and format
          try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              return date.toISOString().split('T')[0];
            }
          } catch (e) {
            // If parsing fails, return original
          }
          return String(dateStr);
        };
        
        // Merge stock price data with trend data by date
        // Create a map with normalized dates as keys
        const priceMap = new Map<string, number>();
        stockData.forEach((item: { date: string; close: number }) => {
          const normalizedDate = normalizeDate(item.date);
          if (normalizedDate && item.close && !isNaN(item.close)) {
            priceMap.set(normalizedDate, item.close);
          }
        });
        
        console.log(`[TickerTrendsCard] ${tickerGroup.baseTicker}: Price map created with ${priceMap.size} entries`, {
          sampleStockDates: stockData.slice(0, 3).map((s: any) => ({ original: s.date, normalized: normalizeDate(s.date) })),
          sampleTrendDates: trendData.slice(0, 3).map((t: any) => ({ original: t.date, normalized: normalizeDate(t.date) })),
        });
        
        // Add price to each trend data point
        // Also try to find closest match if exact match fails (within 7 days)
        trendData = trendData.map((point: TrendDataPoint) => {
          const normalizedPointDate = normalizeDate(point.date);
          let price = priceMap.get(normalizedPointDate);
          
          // If no exact match, try to find closest date within 7 days
          if (price === undefined && normalizedPointDate) {
            try {
              const pointDate = new Date(normalizedPointDate);
              if (!isNaN(pointDate.getTime())) {
                // Check dates within ±7 days
                for (let daysOffset = 1; daysOffset <= 7; daysOffset++) {
                  // Check day before
                  const beforeDate = new Date(pointDate);
                  beforeDate.setDate(beforeDate.getDate() - daysOffset);
                  const beforeKey = normalizeDate(beforeDate);
                  if (priceMap.has(beforeKey)) {
                    price = priceMap.get(beforeKey);
                    break;
                  }
                  
                  // Check day after
                  const afterDate = new Date(pointDate);
                  afterDate.setDate(afterDate.getDate() + daysOffset);
                  const afterKey = normalizeDate(afterDate);
                  if (priceMap.has(afterKey)) {
                    price = priceMap.get(afterKey);
                    break;
                  }
                }
              }
            } catch (e) {
              // Ignore date matching errors
            }
          }
          
          return {
            ...point,
            Price: price !== undefined ? price : null,
          };
        });
        
        // Log for debugging
        const pricesWithData = trendData.filter(p => p.Price !== null && p.Price !== undefined);
        console.log(`[TickerTrendsCard] ${tickerGroup.baseTicker}: Merged ${pricesWithData.length} price points from ${stockData.length} stock data points`, {
          totalTrendPoints: trendData.length,
          priceCoverage: `${((pricesWithData.length / trendData.length) * 100).toFixed(1)}%`,
          priceRange: pricesWithData.length > 0 ? {
            min: Math.min(...pricesWithData.map(p => p.Price!)),
            max: Math.max(...pricesWithData.map(p => p.Price!)),
          } : null,
        });
      } else {
        setHasStockData(false);
        setStockPriceData([]);
        console.log(`[TickerTrendsCard] ${tickerGroup.baseTicker}: No stock data found`);
      }

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
        onDataFound(tickerGroup.baseTicker, found.length > 0 || hasStockData);
      }
      
      // Enable keywords based on pre-filtered keywords from the page
      const enabledDisplayKeywords = safeFilteredKeywords
        .map(kw => kw.keyword)
        .filter(displayKw => Array.from(apiToDisplayMap.values()).includes(displayKw));
      setEnabledKeywords(new Set(enabledDisplayKeywords));
      setIsPriceEnabled(true);
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
    if (!foundKeywords.length && !hasStockData) {
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
    setIsPriceEnabled(true);
  }, [safeFilteredKeywords, foundKeywords, hasStockData, tickerGroup.keywords]);

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
      return;
    }

    // Calculate window summaries (1m, 2m, 3m)
    const windowsToEvaluate = [1, 2, 3];
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
        if (date > lastWindowStart) {
          lastSum += value;
          lastValues.push(value);
          lastDates.push(date);
        } else if (date > prevWindowStart) {
          prevSum += value;
          prevValues.push(value);
          prevDates.push(date);
        }
      });

      const lastMax = lastValues.length > 0 ? Math.max(...lastValues) : 0;
      const prevMax = prevValues.length > 0 ? Math.max(...prevValues) : 0;
      
      // Find the dates where the max values occurred
      const lastMaxIndex = lastValues.indexOf(lastMax);
      const prevMaxIndex = prevValues.indexOf(prevMax);
      const lastMaxDate = lastMaxIndex >= 0 && lastDates.length > lastMaxIndex ? lastDates[lastMaxIndex] : undefined;
      const prevMaxDate = prevMaxIndex >= 0 && prevDates.length > prevMaxIndex ? prevDates[prevMaxIndex] : undefined;
      
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
    
    const allEnabled = enabledKeywords.size === allDisplayKeywords.length && (!hasStockData || isPriceEnabled);

    if (allEnabled) {
      // All enabled, disable all
      setEnabledKeywords(new Set());
      setIsPriceEnabled(false);
    } else {
      // Some or none enabled, enable all
      setEnabledKeywords(new Set(allDisplayKeywords));
      setIsPriceEnabled(true);
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
      
      // Include Price if enabled - always include it in filteredData even if null
      // This ensures the Price line can be rendered (it will handle nulls with connectNulls=false)
      if (hasStockData && isPriceEnabled) {
        if (point.Price !== undefined && point.Price !== null) {
          filtered.Price = point.Price;
          hasAnyLine = true;
        } else {
          // Include Price field even if null so the line component knows to render
          filtered.Price = null;
        }
      }
      
      // Include point if it has any data (trend keywords OR price)
      // This ensures Price-only points are included
      return hasAnyLine ? filtered : null;
    }).filter(Boolean) as TrendDataPoint[];
  }, [combinedData, foundKeywords, hasStockData, isPriceEnabled, safeFilteredKeywords]);
  
  // Calculate price range for Y-axis scaling from merged data
  const priceRange = useMemo(() => {
    if (!hasStockData || !isPriceEnabled || combinedData.length === 0) return null;
    const prices = combinedData
      .map((d: any) => d.Price)
      .filter((p: any) => p !== null && p !== undefined && !isNaN(p as number) && p > 0);
    if (prices.length === 0) {
      console.warn(`[TickerTrendsCard] ${tickerGroup.baseTicker}: No valid price data found in combinedData`, {
        combinedDataLength: combinedData.length,
        sampleData: combinedData.slice(0, 3).map((d: any) => ({ date: d.date, Price: d.Price })),
      });
      return null;
    }
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    // Add some padding to the min/max
    const padding = (max - min) * 0.1;
    const range = { min: Math.floor(Math.max(0, min - padding)), max: Math.ceil(max + padding) };
    console.log(`[TickerTrendsCard] ${tickerGroup.baseTicker}: Price range calculated`, {
      priceCount: prices.length,
      range,
      minPrice: min,
      maxPrice: max,
    });
    return range;
  }, [hasStockData, isPriceEnabled, combinedData, tickerGroup.baseTicker]);

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
  if (error || (foundKeywords.length === 0 && !hasStockData)) {
    return null;
  }

  if (foundKeywords.length === 0 && !hasStockData) {
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
  const hasFilteredKeywordData = safeFilteredKeywords.some(kw =>
    foundKeywords.some(fk => normalizeKeyword(fk) === normalizeKeyword(kw.keyword))
  );
  
  // Hide card if there are no trend keywords with data (only price data is not enough)
  if (!hasFilteredKeywordData && !hasStockData) {
    return null;
  }
  
  // Hide card if there are no trend keywords but only price data (no trends = no chart)
  if (!hasFilteredKeywordData && hasStockData) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[#FF6B35]" />
            {companyName}
            <Badge variant="secondary" className="text-xs">
              {foundKeywords.length + (hasStockData ? 1 : 0)} lines
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
                        <div className="flex flex-wrap gap-2 text-[10px]">
                          {growthDetails.windowSummaries.map((window) => (
                            <span key={`area-${window.label}`}>
                              {window.label}: {window.areaPercent !== null ? `${window.areaPercent >= 0 ? '+' : ''}${window.areaPercent.toFixed(1)}%` : 'N/A'}
                              <span className="text-muted-foreground"> (Σ {Math.round(window.lastSum)}/{Math.round(window.prevSum)})</span>
                            </span>
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
              {enabledKeywords.size === foundKeywords.length && (!hasStockData || isPriceEnabled) ? (
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
              }).concat(
                hasStockData ? (
                  <button
                    key="Price"
                    onClick={() => setIsPriceEnabled(prev => !prev)}
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
                      isPriceEnabled
                        ? 'shadow-sm border-2'
                        : 'opacity-50 border border-dashed',
                    )}
                    style={{
                      backgroundColor: isPriceEnabled ? `#66666615` : 'transparent',
                      borderColor: '#666',
                      color: isPriceEnabled ? '#666' : '#555',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isPriceEnabled ? '#666' : '#ccc' }}
                    />
                    Price
                  </button>
                ) : null
              ).filter(Boolean);
          })()}
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData} margin={{ top: 10, right: hasStockData && isPriceEnabled ? 50 : 30, left: 0, bottom: 0 }}>
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
              {hasStockData && isPriceEnabled && priceRange && (
                <YAxis
                  yAxisId="price"
                  orientation="right"
                  stroke="#888"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[priceRange.min, priceRange.max]}
                  label={{ value: 'Price ($)', angle: 90, position: 'insideRight' }}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'Price') {
                    return [`$${value.toFixed(2)}`, 'Price'];
                  }
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
                  // Always show lines for filtered keywords (they're already filtered by label)
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
              {hasStockData && isPriceEnabled && priceRange && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="Price"
                  stroke="#666"
                  strokeWidth={strokeWidth}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4, fill: '#666' }}
                  name="Price"
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default TickerTrendsCard;
