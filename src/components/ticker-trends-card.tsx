'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
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
  '#EF4444', // Red
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

      setCombinedData(result.combinedData || []);
      
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

  // Filter data to only include enabled keywords
  const filteredData = useMemo(() => {
    if (enabledKeywords.size === foundKeywords.length) {
      return combinedData;
    }
    
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
      enabledKeywords.forEach(displayKw => {
        const apiKw = displayToApiMap.get(displayKw);
        if (apiKw && point[apiKw] !== undefined) {
          filtered[apiKw] = point[apiKw];
        }
      });
      return filtered;
    });
  }, [combinedData, enabledKeywords, foundKeywords, tickerGroup.keywords]);

  const strokeWidth = isWideLayout ? 2 : 1.5;

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-[#FF6B35]" />
            {tickerGroup.baseTicker}
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
            {tickerGroup.baseTicker}
            <Badge variant="secondary" className="text-xs">
              {foundKeywords.length} / {tickerGroup.keywords.length} trends
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
        
        {/* Keyword toggles */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tickerGroup.keywords.map((kw, idx) => {
            const normalizeKeyword = (k: string) => k.replace(/\s+/g, '').toLowerCase();
            const normalizedTickerKeyword = normalizeKeyword(kw.keyword);
            const isFound = foundKeywords.some(fk => {
              const normalizedFound = normalizeKeyword(fk);
              return normalizedFound === normalizedTickerKeyword;
            });
            const isEnabled = enabledKeywords.has(kw.keyword);
            const color = LINE_COLORS[idx % LINE_COLORS.length];

            return (
              <button
                key={kw.trendKey}
                onClick={() => isFound && toggleKeyword(kw.keyword)}
                disabled={!isFound}
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5',
                  isFound && isEnabled
                    ? 'shadow-sm border-2'
                    : isFound
                    ? 'opacity-50 border border-dashed'
                    : 'opacity-30 cursor-not-allowed border border-dashed',
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
                {!isFound && <span className="text-[10px]">(N/A)</span>}
              </button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis
                dataKey="date"
                stroke="#666"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#666"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
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
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default TickerTrendsCard;
