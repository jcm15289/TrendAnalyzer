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
  searchTerm?: string;
  onDataFound?: (ticker: string, hasData: boolean) => void;
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

export function TickerTrendsCard({ tickerGroup, isWideLayout = false, searchTerm = '', onDataFound }: TickerTrendsCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [combinedData, setCombinedData] = useState<TrendDataPoint[]>([]);
  const [foundKeywords, setFoundKeywords] = useState<string[]>([]);
  const [enabledKeywords, setEnabledKeywords] = useState<Set<string>>(new Set());
  const [stockPriceData, setStockPriceData] = useState<Array<{ date: string; close: number }>>([]);
  const [hasStockData, setHasStockData] = useState(false);

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
        
        // Merge stock price data with trend data by date
        const priceMap = new Map<string, number>();
        stockData.forEach((item: { date: string; close: number }) => {
          priceMap.set(item.date, item.close);
        });
        
        // Add price to each trend data point
        trendData = trendData.map((point: TrendDataPoint) => {
          const price = priceMap.get(point.date);
          return {
            ...point,
            Price: price !== undefined ? price : null,
          };
        });
      } else {
        setHasStockData(false);
        setStockPriceData([]);
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
        onDataFound(tickerGroup.baseTicker, found.length > 0);
      }
      
      // Enable keywords based on search term
      let enabledDisplayKeywords: string[] = [];
      if (searchTerm.trim()) {
        // When searching, only enable keywords that match the search term
        const searchLower = searchTerm.toLowerCase().trim();
        enabledDisplayKeywords = Array.from(apiToDisplayMap.values()).filter(displayKw =>
          displayKw.toLowerCase().includes(searchLower)
        );
      } else {
        // No search term: enable all found keywords by default
        enabledDisplayKeywords = Array.from(apiToDisplayMap.values());
      }
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
  
  // Update enabled keywords when searchTerm changes
  useEffect(() => {
    if (!foundKeywords.length) return;
    
    const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
    const apiToDisplayMap = new Map<string, string>();
    tickerGroup.keywords.forEach(tk => {
      const normalized = normalizeKeyword(tk.keyword);
      const matchingApiKeyword = foundKeywords.find(fk => normalizeKeyword(fk) === normalized);
      if (matchingApiKeyword) {
        apiToDisplayMap.set(matchingApiKeyword, tk.keyword);
      }
    });
    
    let enabledDisplayKeywords: string[] = [];
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      enabledDisplayKeywords = Array.from(apiToDisplayMap.values()).filter(displayKw =>
        displayKw.toLowerCase().includes(searchLower)
      );
    } else {
      enabledDisplayKeywords = Array.from(apiToDisplayMap.values());
    }
    setEnabledKeywords(new Set(enabledDisplayKeywords));
  }, [searchTerm, foundKeywords, tickerGroup.keywords]);

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
    const allDisplayKeywords = Array.from(apiToDisplayMap.values());
    
    if (enabledKeywords.size === allDisplayKeywords.length) {
      // All enabled, disable all
      setEnabledKeywords(new Set());
    } else {
      // Some or none enabled, enable all
      setEnabledKeywords(new Set(allDisplayKeywords));
    }
  };

  // Filter data to only include enabled keywords, but always include Price
  const filteredData = useMemo(() => {
    // Create a mapping from display keywords (with spaces) to API keywords (no spaces)
    const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
    const displayToApiMap = new Map<string, string>();
    tickerGroup.keywords.forEach(tk => {
      const normalized = normalizeKeyword(tk.keyword);
      const matchingApiKeyword = foundKeywords.find(fk => normalizeKeyword(fk) === normalized);
      if (matchingApiKeyword) {
        displayToApiMap.set(tk.keyword, matchingApiKeyword);
      }
    });
    
    return combinedData.map(point => {
      const filtered: TrendDataPoint = { date: point.date };
      
      // Always include Price if available
      if (point.Price !== undefined && point.Price !== null) {
        filtered.Price = point.Price;
      }
      
      // Include enabled keywords
      enabledKeywords.forEach(displayKw => {
        const apiKw = displayToApiMap.get(displayKw);
        if (apiKw && point[apiKw] !== undefined) {
          filtered[apiKw] = point[apiKw];
        }
      });
      return filtered;
    });
  }, [combinedData, enabledKeywords, foundKeywords, tickerGroup.keywords]);
  
  // Calculate price range for Y-axis scaling
  const priceRange = useMemo(() => {
    if (!hasStockData || stockPriceData.length === 0) return null;
    const prices = stockPriceData.map(d => d.close).filter(p => p > 0);
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1; // 10% padding
    return { min: Math.max(0, min - padding), max: max + padding };
  }, [hasStockData, stockPriceData]);

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

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[#FF6B35]" />
            {companyName}
            <Badge variant="secondary" className="text-xs">
              {foundKeywords.length} trends
            </Badge>
          </CardTitle>
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
        
        {/* Keyword toggles - only show found keywords, deduplicated and sorted */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(() => {
            const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
            const seenKeywords = new Set<string>();
            
            // Filter and deduplicate keywords
            const filteredKeywords = tickerGroup.keywords.filter(kw => {
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
              
              filteredKeywords.forEach(kw => {
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
            
            let colorIdx = 0;
            return sortedKeywords.map((kw) => {
                const isEnabled = enabledKeywords.has(kw.keyword);
                const color = LINE_COLORS[colorIdx % LINE_COLORS.length];
                colorIdx++;

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
            <ComposedChart data={filteredData} margin={{ top: 10, right: hasStockData ? 50 : 30, left: 0, bottom: 0 }}>
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
              {hasStockData && priceRange && (
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
              {tickerGroup.keywords.map((kw, idx) => {
                if (!enabledKeywords.has(kw.keyword)) return null;
                const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
                const normalizedTickerKeyword = normalizeKeyword(kw.keyword);
                // Find the API keyword (data key) that matches this tickerGroup keyword
                const apiKeyword = foundKeywords.find(fk => normalizeKeyword(fk) === normalizedTickerKeyword);
                if (!apiKeyword) return null;
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
              })}
              {hasStockData && (
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
