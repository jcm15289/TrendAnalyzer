'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Clock, Trash2, FolderPlus, Plus, Check, Database, PenSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import GoogleTrendsChartRedis from './google-trends-chart-redis';
import CacheViewer from './cache-viewer';
import { KeywordSet } from '@/lib/keywords';
import { KeywordList } from '@/lib/lists';
import { Badge } from '@/components/ui/badge';
import { calculateIntelPeak } from '@/lib/intel-peak';

interface TrendsCardProps {
  keywords: KeywordSet;
  onRemove?: (keywords: KeywordSet) => void;
  isWideLayout?: boolean;
  lists?: KeywordList[];
  onAddToList?: (listId: string, keywords: KeywordSet) => void;
  onCreateNewList?: (name: string, keywords?: KeywordSet) => void;
  onUpdateKeywords?: (
    previous: KeywordSet,
    updated: KeywordSet
  ) => { success: boolean; error?: string };
  onGrowthComputed?: (
    keywordSet: KeywordSet,
    summary: {
      bestLabel: string;
      bestPercent: number | null;
      windows: Array<{
        label: string;
        months: number;
        percent: number | null;
        lastSum: number;
        prevSum: number;
        sampleCount: number;
      }>;
      intelPeak: number | null;
    } | null
  ) => void;
  growthMode?: 'area' | 'peak' | 'both' | 'intelpeak';
  showGrowthDetails?: boolean;
  hideMenu?: boolean;
}

export default function TrendsCard({
  keywords,
  onRemove,
  isWideLayout = false,
  lists = [],
  onAddToList,
  onCreateNewList,
  onUpdateKeywords,
  onGrowthComputed,
  growthMode = 'area',
  showGrowthDetails = true,
  hideMenu = false,
}: TrendsCardProps) {
  const [isCacheViewerOpen, setIsCacheViewerOpen] = useState(false);
  const [isChartPreviewOpen, setIsChartPreviewOpen] = useState(false);
  const [isEditKeywordsOpen, setIsEditKeywordsOpen] = useState(false);
  const [editKeywordsForm, setEditKeywordsForm] = useState(() => [
    keywords[0] ?? '',
    keywords[1] ?? '',
    keywords[2] ?? '',
    keywords[3] ?? '',
  ]);
  const [editKeywordsError, setEditKeywordsError] = useState<string | null>(null);
  const [trendGrowthSummary, setTrendGrowthSummary] = useState<{
    windows: Array<{
      label: string;
      months: number;
      sampleCount: number;
      lastSum: number;
      prevSum: number;
      areaPercent: number | null;
      lastValues: number[];
      prevValues: number[];
      lastMax: number;
      prevMax: number;
      peakPercent: number | null;
    }>;
    areaBest: { label: string; percent: number | null };
    peakBest: { label: string; percent: number | null };
    intelPeak: number | null;
    intelPeakDetails?: {
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
    };
  } | null>(null);
  const [cacheTime, setCacheTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const [trendData, setTrendData] = useState<any>(null);
  const [newListName, setNewListName] = useState('');
  const [showNewListInput, setShowNewListInput] = useState(false);
  
  // Memoize keywords string to avoid unnecessary re-renders
  const keywordsKey = useMemo(() => keywords.join('|'), [keywords]);
  
  // Check which lists this keyword set belongs to
  const isInList = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return false;
    return list.keywords.some(
      ks => JSON.stringify(ks.slice().sort()) === JSON.stringify(keywords.slice().sort())
    );
  };

  const formatKeyword = (keyword: string) =>
    keyword
      .split(' ')
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
      .join(' ');

  // Format number with commas for thousands (no decimals)
  const formatNumberWithCommas = (num: number): string => {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const title = keywords.map(formatKeyword).join(' vs ');
  const description = '';

  const assignedLists = React.useMemo(() => {
    if (!lists?.length) return [] as KeywordList[];
    return lists
      .filter(list => list.id !== 'all')
      .filter(list => list.keywords.some(
        ks => JSON.stringify(ks.slice().sort()) === JSON.stringify(keywords.slice().sort())
      ));
  }, [lists, keywords]);

  const activeWindows = trendGrowthSummary?.windows ?? [];
  const metricPrefix = (mode: 'area' | 'peak') => (mode === 'area' ? 'Σ' : 'Peak');
  const modeLabel = (mode: 'area' | 'peak') => (mode === 'area' ? 'Area' : 'Peak');
  const areaBest = trendGrowthSummary?.areaBest ?? { label: 'n/a', percent: null };
  const peakBest = trendGrowthSummary?.peakBest ?? { label: 'n/a', percent: null };
  const combinedBest =
    growthMode === 'both'
      ? (() => {
          const candidates = [
            { ...areaBest, mode: 'area' as const },
            { ...peakBest, mode: 'peak' as const },
          ].filter((candidate) => candidate.percent !== null && !Number.isNaN(candidate.percent as number));
          if (candidates.length === 0) {
            return { label: 'n/a', percent: null, mode: 'area' as const };
          }
          return candidates.reduce((best, current) =>
            (current.percent as number) > (best.percent as number) ? current : best,
          );
        })()
      : null;

  // Calculate delta time since cache was created - simplified format (d, h, m, s)
  const getDeltaTime = () => {
    if (!cacheTime) return null;
    
    const diffMs = currentTime.getTime() - cacheTime.getTime();
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (days > 0) {
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  // Fetch cache time from API
  const fetchCacheTime = async () => {
    setIsLoadingCache(true);
    try {
      // For comparison queries, get the most recent cache time from individual keywords
      const fetchPromises = keywords.map(async (keyword) => {
        try {
          const response = await fetch(
            `/api/cache?keywords=${encodeURIComponent(keyword)}`
          );
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.cacheInfo) {
              return new Date(result.cacheInfo.lastModified);
            }
          }
        } catch (err) {
          console.warn('Cache metadata fetch failed for keyword:', keyword, err);
        }
        return null;
      });
      
      const cacheTimes = await Promise.all(fetchPromises);
      const validTimes = cacheTimes.filter(time => time !== null);
      
      if (validTimes.length > 0) {
        // Use the most recent cache time
        const mostRecent = new Date(Math.max(...validTimes.map(time => time!.getTime())));
        setCacheTime(mostRecent);
      }
    } catch (error) {
      console.error('Error fetching cache time:', error);
    } finally {
      setIsLoadingCache(false);
    }
  };

  // Fetch cache time when component mounts or keywords change
  React.useEffect(() => {
    fetchCacheTime();
  }, [keywords]);

  // Update current time every 30 seconds to keep delta time accurate
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    setEditKeywordsForm([
      keywords[0] ?? '',
      keywords[1] ?? '',
      keywords[2] ?? '',
      keywords[3] ?? '',
    ]);
  }, [keywords]);

  React.useEffect(() => {
    if (!trendData || keywords.length !== 1) {
      setTrendGrowthSummary(null);
      onGrowthComputed?.(keywords, null);
      return;
    }

    const keyword = keywords[0];
    const timelineSource =
      Array.isArray(trendData?.timelineData) && trendData.timelineData.length > 0
        ? trendData.timelineData
        : Array.isArray(trendData?.results?.[0]?.data)
          ? trendData.results[0].data
          : Array.isArray(trendData)
            ? trendData
            : [];

    console.log('[TrendGrowth] Starting evaluation', {
      keyword,
      timelineLength: timelineSource.length ?? 0,
      rawSample: timelineSource.slice(0, 5),
    });

    if (!Array.isArray(timelineSource) || timelineSource.length === 0) {
      console.log('[TrendGrowth] No timeline data available for growth calculation.');
      setTrendGrowthSummary(null);
      onGrowthComputed?.(keywords, null);
      return;
    }

    const parsed = timelineSource
      .map((row: any) => {
        const date = row?.date ? new Date(row.date) : null;
        let value: number | null = null;
        if (row && typeof row === 'object') {
          if (row[keyword] != null) {
            value = Number(row[keyword]);
          } else {
            const valueKey = Object.keys(row).find((k) => k !== 'date');
            if (valueKey) {
              value = Number(row[valueKey]);
            }
          }
        }
        return date && !Number.isNaN(date.getTime()) && typeof value === 'number' && !Number.isNaN(value)
          ? { date, value }
          : null;
      })
      .filter((entry): entry is { date: Date; value: number } => entry !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (parsed.length === 0) {
      console.log('[TrendGrowth] Parsed timeline is empty after filtering invalid entries.');
      setTrendGrowthSummary(null);
      onGrowthComputed?.(keywords, null);
      return;
    }

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
      parsed.forEach(({ date, value }) => {
        if (date > lastWindowStart) {
          lastSum += value;
          lastValues.push(value);
        } else if (date > prevWindowStart) {
          prevSum += value;
          prevValues.push(value);
        }
      });

      const lastMax = lastValues.length > 0 ? Math.max(...lastValues) : 0;
      const prevMax = prevValues.length > 0 ? Math.max(...prevValues) : 0;

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

      console.log('[TrendGrowth] Window summary', {
        keyword,
        months,
        lastWindowStart: lastWindowStart.toISOString(),
        prevWindowStart: prevWindowStart.toISOString(),
        lastSum,
        prevSum,
        lastMax,
        prevMax,
        areaPercent,
        peakPercent,
        sampleCount: parsed.length,
        lastValues,
        prevValues,
      });

      console.log('[DIFF]', {
        keyword,
        window: `${months}m`,
        months,
        lastValues,
        prevValues,
        lastSum,
        prevSum,
        areaPercent,
        lastMax,
        prevMax,
        peakPercent,
      });

      return {
        label: `${months}m`,
        months,
        lastSum,
        prevSum,
        sampleCount: parsed.length,
        areaPercent,
        lastValues,
        prevValues,
        lastMax,
        prevMax,
        peakPercent,
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

    // Calculate IntelPeak metric
    console.log('[TrendGrowth] Calculating IntelPeak for', keyword, {
      parsedLength: parsed.length,
      firstDate: parsed[0]?.date?.toISOString(),
      lastDate: parsed[parsed.length - 1]?.date?.toISOString(),
    });
    let intelPeakResult;
    try {
      intelPeakResult = calculateIntelPeak(parsed);
      console.log('[TrendGrowth] ✅ IntelPeak calculation completed', { keyword, intelPeak: intelPeakResult.intelPeak });
    } catch (error) {
      console.error('[TrendGrowth] ❌ Error calculating IntelPeak:', error);
      intelPeakResult = {
        intelPeak: null,
        peakDate: null,
        peakDuration: 0,
        peakArea: 0,
        baselineArea: 0,
        ratio: null,
        peakStartDate: null,
        peakEndDate: null,
        baselineStartDate: null,
        baselineEndDate: null,
      };
    }

    const summary = {
      windows: windowSummaries,
      areaBest: {
        label: bestAreaWindow ? bestAreaWindow.label : 'n/a',
        percent: bestAreaWindow?.areaPercent ?? null,
      },
      peakBest: {
        label: bestPeakWindow ? bestPeakWindow.label : 'n/a',
        percent: bestPeakWindow?.peakPercent ?? null,
      },
      intelPeak: intelPeakResult.intelPeak,
      intelPeakDetails: {
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
      },
    };

    console.log('[DIFF] Summary', { keyword, summary });

    setTrendGrowthSummary(summary);
  }, [keywords, trendData, onGrowthComputed]);

  React.useEffect(() => {
    if (!onGrowthComputed) {
      return;
    }

    if (!trendGrowthSummary) {
      onGrowthComputed(keywords, null);
      return;
    }

    const windowsForMode = (mode: 'area' | 'peak') =>
      trendGrowthSummary.windows.map((window) => ({
        label: window.label,
        months: window.months,
        percent: mode === 'area' ? window.areaPercent : window.peakPercent,
        lastSum: mode === 'area' ? window.lastSum : window.lastMax,
        prevSum: mode === 'area' ? window.prevSum : window.prevMax,
        sampleCount: window.sampleCount,
      }));

    const areaWindows = windowsForMode('area');
    const peakWindows = windowsForMode('peak');

    if (growthMode === 'both') {
      const areaCandidate = trendGrowthSummary.areaBest;
      const peakCandidate = trendGrowthSummary.peakBest;
      const candidates = [
        { ...areaCandidate, mode: 'area' as const, windows: areaWindows },
        { ...peakCandidate, mode: 'peak' as const, windows: peakWindows },
      ].filter((candidate) => candidate.percent !== null && !Number.isNaN(candidate.percent as number));

      if (candidates.length === 0) {
        onGrowthComputed(keywords, null);
        return;
      }

      const best = candidates.reduce((best, current) =>
        (current.percent as number) > (best.percent as number) ? current : best,
      );

      onGrowthComputed(keywords, {
        bestLabel: best.label ?? 'n/a',
        bestPercent: best.percent ?? null,
        windows: best.windows,
        intelPeak: trendGrowthSummary.intelPeak ?? null,
      });
      return;
    }

    // Handle IntelPeak mode
    if (growthMode === 'intelpeak') {
      const intelPeak = trendGrowthSummary.intelPeak;
      if (intelPeak === null || Number.isNaN(intelPeak)) {
        onGrowthComputed(keywords, null);
        return;
      }
      onGrowthComputed(keywords, {
        bestLabel: 'IntelPeak',
        bestPercent: intelPeak,
        windows: areaWindows, // Use area windows as fallback structure
        intelPeak: intelPeak,
      });
      return;
    }

    const activeBest = growthMode === 'area' ? trendGrowthSummary.areaBest : trendGrowthSummary.peakBest;

    if (!activeBest || activeBest.percent === null || Number.isNaN(activeBest.percent)) {
      onGrowthComputed(keywords, null);
      return;
    }

    onGrowthComputed(keywords, {
      bestLabel: activeBest.label ?? 'n/a',
      bestPercent: activeBest.percent ?? null,
      windows: growthMode === 'area' ? areaWindows : peakWindows,
      intelPeak: trendGrowthSummary.intelPeak ?? null,
    });
  }, [growthMode, keywords, onGrowthComputed, trendGrowthSummary]);

  const handleChartClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isWideLayout) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, a, [role="menuitem"]')) return;
    setIsChartPreviewOpen(true);
  };

  const handleChartKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isWideLayout) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsChartPreviewOpen(true);
    }
  };

  const updateEditKeyword = (index: number, value: string) => {
    setEditKeywordsForm((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSaveEditedKeywords = () => {
    const parsed = editKeywordsForm
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    if (parsed.length === 0) {
      setEditKeywordsError('Enter at least one keyword.');
      return;
    }

    if (onUpdateKeywords) {
      const result = onUpdateKeywords(keywords, parsed);
      if (!result?.success) {
        setEditKeywordsError(result?.error ?? 'Unable to update keywords.');
        return;
      }
    }

    setIsEditKeywordsOpen(false);
    setEditKeywordsError(null);
  };

  return (
    <>
      <Card className="flex flex-col animate-fade-in shadow-md hover:shadow-xl transition-shadow duration-300">
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-xl flex flex-wrap gap-2 items-center">
                <span>{title}</span>
                {!hideMenu && assignedLists.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {assignedLists.map(list => (
                      <Badge
                        key={list.id}
                        variant="outline"
                        className="text-[10px] font-medium border-0 px-1.5 py-0"
                        style={{
                          backgroundColor: `${list.color || '#E5E7EB'}1a`,
                          color: list.color || '#374151',
                        }}
                      >
                        {list.name}
                      </Badge>
                    ))}
                  </span>
                )}
              </CardTitle>
              {keywords.length === 1 && trendGrowthSummary && (
                <span className="text-xl font-semibold text-emerald-600 shrink-0">
                  {(() => {
                    if (growthMode === 'both') {
                      if (!combinedBest || combinedBest.percent === null) {
                        return 'N/A';
                      }
                      return `${combinedBest.percent >= 0 ? '+' : ''}${formatNumberWithCommas(combinedBest.percent)}%`;
                    }
                    // Handle IntelPeak mode
                    if (growthMode === 'intelpeak') {
                      const intelPeak = trendGrowthSummary.intelPeak;
                      if (intelPeak === null || Number.isNaN(intelPeak)) {
                        return 'N/A';
                      }
                      return `${intelPeak >= 0 ? '+' : ''}${formatNumberWithCommas(intelPeak)}%`;
                    }
                    const activeBest =
                      growthMode === 'area' ? trendGrowthSummary.areaBest : trendGrowthSummary.peakBest;
                    if (!activeBest || activeBest.percent === null) {
                      return 'N/A';
                    }
                    return `${activeBest.percent >= 0 ? '+' : ''}${formatNumberWithCommas(activeBest.percent)}%`;
                  })()}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {growthMode === 'intelpeak'
                      ? 'IntelPeak'
                      : growthMode === 'both'
                      ? combinedBest
                        ? `${modeLabel(combinedBest.mode)} vs previous ${combinedBest.label}`
                        : 'Area/Peak comparison'
                      : `${modeLabel(growthMode)} vs previous ${
                          growthMode === 'area'
                            ? trendGrowthSummary.areaBest.label
                            : trendGrowthSummary.peakBest.label
                        }`}
                  </span>
                </span>
              )}
            </div>
          <CardDescription>{description}</CardDescription>
          {keywords.length === 1 && trendGrowthSummary && showGrowthDetails && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {/* Show IntelPeak in debug mode */}
              {trendGrowthSummary.intelPeak !== null && trendGrowthSummary.intelPeak !== undefined && trendGrowthSummary.intelPeakDetails && (
                <div className="flex flex-col gap-1">
                  <div className="uppercase tracking-wide text-[10px] font-semibold text-purple-700">
                    INTELPEAK COMPARISON
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">IntelPeak:</span>
                      <span className={trendGrowthSummary.intelPeak >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                        {trendGrowthSummary.intelPeak !== null && !Number.isNaN(trendGrowthSummary.intelPeak)
                          ? `${trendGrowthSummary.intelPeak >= 0 ? '+' : ''}${trendGrowthSummary.intelPeak.toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                    {trendGrowthSummary.intelPeakDetails.peakDate && (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Peak date:</span>
                          <span>{trendGrowthSummary.intelPeakDetails.peakDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                        {trendGrowthSummary.intelPeakDetails.peakStartDate && trendGrowthSummary.intelPeakDetails.peakEndDate && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Peak period:</span>
                            <span>
                              {trendGrowthSummary.intelPeakDetails.peakStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {trendGrowthSummary.intelPeakDetails.peakEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                        {trendGrowthSummary.intelPeakDetails.baselineStartDate && trendGrowthSummary.intelPeakDetails.baselineEndDate && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Baseline period:</span>
                            <span>
                              {trendGrowthSummary.intelPeakDetails.baselineStartDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} - {trendGrowthSummary.intelPeakDetails.baselineEndDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                        {trendGrowthSummary.intelPeakDetails.baselineArea === 0 && (
                          <div className="flex items-center gap-1 text-amber-600">
                            <span className="font-medium">⚠️ Baseline area is 0 - insufficient data before peak</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Duration:</span>
                          <span>
                            {trendGrowthSummary.intelPeakDetails.peakDuration} day{trendGrowthSummary.intelPeakDetails.peakDuration !== 1 ? 's' : ''} 
                            ({Math.round(trendGrowthSummary.intelPeakDetails.peakDuration / 7)} week{Math.round(trendGrowthSummary.intelPeakDetails.peakDuration / 7) !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Peak area:</span>
                          <span>{trendGrowthSummary.intelPeakDetails.peakArea.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">Baseline area:</span>
                          <span>{trendGrowthSummary.intelPeakDetails.baselineArea.toFixed(1)}</span>
                        </div>
                        {trendGrowthSummary.intelPeakDetails.ratio && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Ratio:</span>
                            <span>{trendGrowthSummary.intelPeakDetails.ratio.toFixed(2)}x</span>
                          </div>
                        )}
                        {trendGrowthSummary.intelPeakDetails.higherPeaksCount !== undefined && trendGrowthSummary.intelPeakDetails.higherPeaksCount > 0 && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <span className="font-medium">Higher peaks found:</span>
                            <span>{trendGrowthSummary.intelPeakDetails.higherPeaksCount} (IntelPeak divided by {trendGrowthSummary.intelPeakDetails.higherPeaksCount})</span>
                          </div>
                        )}
                        {trendGrowthSummary.intelPeakDetails.higherPeaksCount !== undefined && trendGrowthSummary.intelPeakDetails.higherPeaksCount === 0 && (
                          <div className="flex items-center gap-1 text-gray-500">
                            <span className="font-medium">Higher peaks found:</span>
                            <span>0 (no adjustment applied)</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {['area', 'peak'].map((mode) => {
                if (growthMode !== 'both' && growthMode !== mode && growthMode !== 'intelpeak') {
                  return null;
                }
                const modeWindows = activeWindows.map((window) => ({
                  label: window.label,
                  percent: mode === 'area' ? window.areaPercent : window.peakPercent,
                  lastMetric: mode === 'area' ? window.lastSum : window.lastMax,
                  prevMetric: mode === 'area' ? window.prevSum : window.prevMax,
                }));
                return (
                  <div key={mode} className="flex flex-col gap-1">
                    <div className="uppercase tracking-wide text-[10px] font-semibold">
                      {modeLabel(mode as 'area' | 'peak')} comparison
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {modeWindows.map(({ label, percent, lastMetric, prevMetric }) => (
                        <div key={`${mode}-${label}`} className="flex items-center gap-1">
                          <span className="font-medium">{label}:</span>
                          <span
                            className={
                              percent !== null && percent >= 0 ? 'text-emerald-600' : 'text-red-500'
                            }
                          >
                            {percent !== null
                              ? `${percent >= 0 ? '+' : ''}${formatNumberWithCommas(percent)}%`
                              : 'N/A'}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {metricPrefix(mode as 'area' | 'peak')} last {Math.round(lastMetric)} / prev{' '}
                            {Math.round(prevMetric)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
          {!hideMenu && (
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onSelect={() => {
                  setEditKeywordsError(null);
                  setEditKeywordsForm([
                    keywords[0] ?? '',
                    keywords[1] ?? '',
                    keywords[2] ?? '',
                    keywords[3] ?? '',
                  ]);
                  setIsEditKeywordsOpen(true);
                }}
              >
                <PenSquare className="mr-2 h-4 w-4" />
                <span>Edit Keywords</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setIsCacheViewerOpen(true);
                  fetchCacheTime();
                }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center">
                <Database className="mr-2 h-4 w-4" />
                <span>View Redis File</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsCacheViewerOpen(true);
                    fetchCacheTime();
                  }}
                  className="flex items-center gap-1 bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 h-6 px-2"
                >
                  <Clock className="h-3 w-3" />
                  <span className="text-xs font-medium">
                    {isLoadingCache ? '...' : (getDeltaTime() || 'N/A')}
                  </span>
                </Button>
              </DropdownMenuItem>
              
              {/* Add to List submenu */}
              {lists && lists.length > 0 && onAddToList && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    <span>Add to List</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {lists
                      .filter(list => list.id !== 'all')  // Don't show "All" list
                      .map((list) => (
                        <DropdownMenuItem
                          key={list.id}
                          onSelect={() => onAddToList(list.id, keywords)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: list.color || '#6B7280' }}
                              />
                              <span>{list.name}</span>
                            </div>
                            {isInList(list.id) && (
                              <Check className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setShowNewListInput(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      <span>Create New List</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              
              {onRemove && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onRemove(keywords)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Chart</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          )}
        </CardHeader>
        <CardContent className="flex-grow">
          <div
            className={!isWideLayout ? 'cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg' : ''}
            role={!isWideLayout ? 'button' : undefined}
            tabIndex={!isWideLayout ? 0 : undefined}
            onClick={handleChartClick}
            onKeyDown={handleChartKey}
            aria-label={!isWideLayout ? `Expand ${title} chart` : undefined}
          >
            <GoogleTrendsChartRedis 
              keywords={keywords} 
              onDataLoad={(data) => setTrendData(data)}
              isWideLayout={isWideLayout}
            />
          </div>
              
        </CardContent>
      </Card>

          <CacheViewer
            keywords={keywords}
            open={isCacheViewerOpen}
            onOpenChange={setIsCacheViewerOpen}
          />

          <Dialog
            open={isEditKeywordsOpen}
            onOpenChange={(open) => {
              setIsEditKeywordsOpen(open);
              if (!open) {
                setEditKeywordsError(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Keywords</DialogTitle>
                <DialogDescription>
                  Update the keywords for this chart. You can track up to four terms per comparison.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-keyword-1" className="text-right">
                    Keyword 1
                  </Label>
                  <Input
                    id="edit-keyword-1"
                    value={editKeywordsForm[0]}
                    onChange={(event) => updateEditKeyword(0, event.target.value)}
                    className="col-span-3"
                    placeholder='e.g., "Democrat"'
                  />
                </div>
                {[1, 2, 3].map((index) => (
                  <div key={index} className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor={`edit-keyword-${index + 1}`} className="text-right">
                      Keyword {index + 1}
                    </Label>
                    <Input
                      id={`edit-keyword-${index + 1}`}
                      value={editKeywordsForm[index]}
                      onChange={(event) => updateEditKeyword(index, event.target.value)}
                      className="col-span-3"
                      placeholder={
                        index === 0
                          ? '(Optional) e.g., "Republican"'
                          : index === 1
                          ? '(Optional) e.g., "Libertarian"'
                          : '(Optional) e.g., "Green Party"'
                      }
                    />
                  </div>
                ))}
                {editKeywordsError && (
                  <p className="text-sm text-red-600 text-center">{editKeywordsError}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditKeywordsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEditedKeywords}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isChartPreviewOpen} onOpenChange={setIsChartPreviewOpen}>
            <DialogContent className="max-w-6xl w-full">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
              </DialogHeader>
              <div className="h-[420px]">
                <GoogleTrendsChartRedis
                  keywords={keywords}
                  onDataLoad={(data) => setTrendData(data)}
                  isWideLayout
                />
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Create New List Dialog */}
          <Dialog open={showNewListInput} onOpenChange={setShowNewListInput}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New List</DialogTitle>
                <DialogDescription>
                  Create a new list and add this chart to it.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="list-name">List Name</Label>
                  <Input
                    id="list-name"
                    placeholder="e.g., Elections 2024"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newListName.trim() && onCreateNewList) {
                        onCreateNewList(newListName.trim(), keywords);
                        setNewListName('');
                        setShowNewListInput(false);
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewListName('');
                    setShowNewListInput(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (newListName.trim() && onCreateNewList) {
                      // Pass both the list name and the keywords to add
                      onCreateNewList(newListName.trim(), keywords);
                      setNewListName('');
                      setShowNewListInput(false);
                    }
                  }}
                  disabled={!newListName.trim()}
                >
                  Create & Add Chart
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }
