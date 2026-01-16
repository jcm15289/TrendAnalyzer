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

export function TickerTrendsCard({ tickerGroup, isWideLayout = false }: TickerTrendsCardProps) {
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
      
      // Enable all found keywords by default (using tickerGroup format for display)
      const enabledDisplayKeywords = Array.from(apiToDisplayMap.values());
      setEnabledKeywords(new Set(enabledDisplayKeywords));
    } catch (err) {
      console.error('Error fetching ticker trends:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [tickerGroup.baseTicker]);

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
    if (enabledKeywords.size === foundKeywords.length) {
      // All enabled, disable all
      setEnabledKeywords(new Set());
    } else {
      // Some or none enabled, enable all
      setEnabledKeywords(new Set(foundKeywords));
    }
  };

  // Filter data to only include enabled keywords
  const filteredData = useMemo(() => {
    if (enabledKeywords.size === foundKeywords.length) {
      return combinedData;
    }
    
    return combinedData.map(point => {
      const filtered: TrendDataPoint = { date: point.date };
      enabledKeywords.forEach(kw => {
        if (point[kw] !== undefined) {
          filtered[kw] = point[kw];
        }
      });
      return filtered;
    });
  }, [combinedData, enabledKeywords, foundKeywords.length]);

  const strokeWidth = isWideLayout ? 3 : 2;

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

  if (error) {
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
            <div className="text-center text-red-600">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Error loading trends</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchTrends} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
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
            const isFound = foundKeywords.some(fk => normalizeKeyword(fk) === normalizedTickerKeyword);
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
                  color: isEnabled ? color : '#888',
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
