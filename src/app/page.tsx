'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TickerTrendsCard } from '@/components/ticker-trends-card';
import { ConfigDialog } from '@/components/config-dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Command, Settings, LayoutGrid, Rows3, List, ChevronDown, TrendingUp, Loader2, Search, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getCompanyName } from '@/lib/ticker-names';
import { Input } from '@/components/ui/input';

interface TickerKeyword {
  ticker: string;
  keyword: string;
  trendKey: string;
}

interface TickerGroup {
  baseTicker: string;
  keywords: TickerKeyword[];
}

interface FilteredGroup {
  group: TickerGroup;
  filteredKeywords: TickerKeyword[];
}

export default function Home() {
  const [tickerGroups, setTickerGroups] = useState<TickerGroup[]>([]);
  const [isConfigDialogOpen, setConfigDialogOpen] = useState(false);
  const [isCommandMenuOpen, setCommandMenuOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'single' | 'multi'>('multi');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [filterTicker, setFilterTicker] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [tickersWithData, setTickersWithData] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [growthMode, setGrowthMode] = useState<'area' | 'peak' | 'both'>('area');
  const [growthDebug, setGrowthDebug] = useState(false);
  const [growthMetrics, setGrowthMetrics] = useState<Record<string, number>>({});
  
  useEffect(() => {
    setIsLocalhost(typeof window !== 'undefined' && window.location.hostname === 'localhost');
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const parseBuildTimestamp = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const [buildTime, setBuildTime] = useState<Date | null>(() =>
    parseBuildTimestamp(
      process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || process.env.BUILD_TIMESTAMP || null
    )
  );
  const [buildVersion] = useState<string>(
    () => process.env.NEXT_PUBLIC_BUILD_VERSION || '0.1.0'
  );

  useEffect(() => {
    const globalTimestamp =
      (window as any).__BUILD_TIMESTAMP ||
      (window as any).__NEXT_DATA__?.props?.buildTimestamp ||
      document.querySelector<HTMLMetaElement>('meta[name="geo-build-timestamp"]')?.content;

    const parsed = parseBuildTimestamp(globalTimestamp);
    if (parsed) {
      setBuildTime(parsed);
    }
  }, []);

  const buildTimeDisplay = hasMounted && buildTime
    ? buildTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Los_Angeles',
      })
    : null;

  // Load ticker groups from ALLSYMS
  useEffect(() => {
    const loadTickerGroups = async () => {
      setIsLoading(true);
      setError(null);
      console.log('🚦 Page: Loading ticker groups from ALLSYMS...');
      
      try {
        const response = await fetch('/api/redis/tickers');
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🚦 Page: API response not OK:', response.status, errorText);
          setError(`Failed to load tickers: ${response.status}`);
          setTickerGroups([]);
              return;
        }
        
        const result = await response.json();
        console.log('🚦 Page: API response:', {
          success: result.success,
          totalGroups: result.totalGroups,
          totalLines: result.totalLines,
          sample: result.groups?.slice(0, 3).map((g: TickerGroup) => ({
            ticker: g.baseTicker,
            keywords: g.keywords.length
          })),
        });
        
        if (result.success && result.groups && result.groups.length > 0) {
          setTickerGroups(result.groups);
          console.log('✅ Page: Loaded ticker groups from ALLSYMS:', {
            count: result.groups.length,
            tickers: result.groups.slice(0, 10).map((g: TickerGroup) => g.baseTicker),
          });
        } else {
          console.warn('🚦 Page: No ticker groups found');
          setTickerGroups([]);
        }
      } catch (err) {
        console.error('❌ Page: Could not load ticker groups:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setTickerGroups([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTickerGroups();

    // Load layout preference
    const savedLayout = localStorage.getItem('trends-layout-mode');
    if (savedLayout === 'multi' || savedLayout === 'single') {
      setLayoutMode(savedLayout);
    }
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // "/" key to focus search (unless already typing in an input)
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // "Esc" key to clear search
      if (e.key === 'Escape' && searchTerm && searchInputRef.current === document.activeElement) {
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
      // Cmd/Ctrl + "/" for command menu
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandMenuOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [searchTerm]);

  const toggleLayoutMode = () => {
    const newMode = layoutMode === 'single' ? 'multi' : 'single';
    setLayoutMode(newMode);
    localStorage.setItem('trends-layout-mode', newMode);
  };

  // Callback when a ticker card reports its data availability
  const handleDataFound = useCallback((ticker: string, hasData: boolean) => {
    setTickersWithData(prev => {
      const next = new Set(prev);
      if (hasData) {
        next.add(ticker);
      } else {
        next.delete(ticker);
      }
      return next;
    });
  }, []);

  const normalizeLabel = useCallback((label: string) => {
    const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    if (normalized === 'signup' || normalized === 'sign-up') return 'sign up';
    return normalized;
  }, []);

  const extractLabel = useCallback((group: TickerGroup, keyword: string) => {
    const keywordLower = keyword.toLowerCase().trim();
    const companyName = getCompanyName(group.baseTicker, group.keywords.map(k => k.keyword));
    const companyLower = companyName.toLowerCase().trim();

    if (!companyLower || !keywordLower.startsWith(companyLower)) {
      return '';
    }

    const remainder = keyword.slice(companyLower.length).trim();
    return normalizeLabel(remainder);
  }, [normalizeLabel]);

  // Filter ticker groups based on selection, search term, and label filter
  const filteredGroups = useMemo<FilteredGroup[]>(() => {
    let groups = tickerGroups;

    if (filterTicker !== 'all') {
      groups = groups.filter(g => g.baseTicker === filterTicker);
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const labelLower = labelFilter === 'all' ? '' : normalizeLabel(labelFilter);

    return groups
      .map(group => {
        const filteredKeywords = group.keywords.filter(kw => {
          const matchesSearch = !searchLower || kw.keyword.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;

          if (!labelLower) return true;
          const label = extractLabel(group, kw.keyword);
          return label && normalizeLabel(label) === labelLower;
        });

        return { group, filteredKeywords };
      })
      .filter(entry => entry.filteredKeywords.length > 0);
  }, [tickerGroups, filterTicker, searchTerm, labelFilter, normalizeLabel, extractLabel]);

  const availableLabels = useMemo(() => {
    const labelCounts = new Map<string, number>();
    const groups = filterTicker === 'all'
      ? tickerGroups
      : tickerGroups.filter(g => g.baseTicker === filterTicker);

    groups.forEach(group => {
      group.keywords.forEach(kw => {
        const label = extractLabel(group, kw.keyword);
        if (label) {
          const normalized = normalizeLabel(label);
          labelCounts.set(normalized, (labelCounts.get(normalized) || 0) + 1);
        }
      });
    });

    // Sort by count (descending), then alphabetically for ties
    return Array.from(labelCounts.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]; // Sort by count descending
        return a[0].localeCompare(b[0]); // Then alphabetically
      });
  }, [tickerGroups, filterTicker, extractLabel, normalizeLabel]);

  // Unique tickers for the dropdown
  const allTickers = useMemo(() => {
    return tickerGroups.map(g => g.baseTicker).sort();
  }, [tickerGroups]);

  // Handle growth metrics computed from cards
  const handleGrowthComputed = useCallback((ticker: string, summary: {
    bestLabel?: string;
    bestPercent?: number | null;
    sixMonthValue?: number | null;
  } | null) => {
    setGrowthMetrics((prev) => {
      if (!summary) {
        const next = { ...prev };
        delete next[ticker];
        return next;
      }

      // Always use 6m value for sorting
      // If null (invalid), exclude from metrics (card will be hidden)
      const metricValue = summary.sixMonthValue;

      if (metricValue === null || metricValue === undefined || Number.isNaN(metricValue)) {
        const next = { ...prev };
        delete next[ticker];
        return next;
      }

      const currentValue = prev[ticker];
      if (currentValue === metricValue) {
        return prev;
      }

      return {
        ...prev,
        [ticker]: metricValue,
      };
    });
  }, []);

  // Sort filtered groups by growth metrics ONLY when a label is selected
  const sortedFilteredGroups = useMemo(() => {
    // Only sort when a label is selected (not 'all')
    if (labelFilter === 'all') {
      return filteredGroups;
    }
    
    const sorted = [...filteredGroups].sort((a, b) => {
      const scoreA = growthMetrics[a.group.baseTicker] ?? -Infinity;
      const scoreB = growthMetrics[b.group.baseTicker] ?? -Infinity;
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending order
      }
      return a.group.baseTicker.localeCompare(b.group.baseTicker);
    });
    return sorted;
  }, [filteredGroups, growthMetrics, labelFilter]);

    return (
    <TooltipProvider>
      {!hasMounted ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-3 md:px-6">
            {/* All elements in one line */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Logo */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help h-9">
                    <TrendingUp className="h-5 w-5 text-[#FF6B35]" strokeWidth={2.5} />
                    <h1 className={cn(
                      "text-xl font-bold tracking-tight leading-none",
                      isLocalhost ? "text-red-600" : "text-[#FF6B35]"
                    )}>TrendsAnalyzer</h1>
                    {buildTimeDisplay && (
                      <span
                        className="text-[11px] font-medium text-muted-foreground leading-none whitespace-nowrap"
                        title={`Build time: ${buildTimeDisplay}`}
                      >
                        {buildTimeDisplay}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-semibold">TrendsAnalyzer v{buildVersion}</div>
                    <div className="text-xs text-muted-foreground">
                      {hasMounted && buildTime
                        ? `Build time: ${buildTime.toLocaleString('en-US', {
                            timeZone: 'America/Los_Angeles',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZoneName: 'short',
                          })}`
                        : 'Build time unavailable'}
                    </div>
                    <div className="text-xs text-muted-foreground">ALLSYMS-Based Architecture</div>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Search box - half width */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search trends... (Press / to focus)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-8 pr-8"
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
                
              {/* Label filter dropdown */}
              <Select value={labelFilter} onValueChange={setLabelFilter}>
                <SelectTrigger className="w-[200px] h-9">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    <SelectValue placeholder="Filter by label" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <span>All Labels</span>
                      <span className="text-xs text-muted-foreground">
                        ({availableLabels.length})
                      </span>
                    </div>
                  </SelectItem>
                  {availableLabels.map(([label, count]) => (
                    <SelectItem key={label} value={label}>
                      <div className="flex items-center justify-between w-full">
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground ml-2">({count})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
                
              <div className="h-9 w-px bg-border" />
                
              {/* Peak measurement mode selector */}
              <div className="flex items-center gap-1 rounded-md border border-input bg-background px-1 py-1 text-xs font-medium text-muted-foreground">
                {[
                  { value: 'area' as const, label: 'Area' },
                  { value: 'peak' as const, label: 'Peak' },
                  { value: 'both' as const, label: 'Both' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGrowthMode(value)}
                    className={cn(
                      'px-3 py-1 rounded-sm transition-colors',
                      growthMode === value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              
              {/* Debug toggle */}
              <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-input h-9">
                <label htmlFor="debug-toggle" className="text-xs font-medium text-muted-foreground cursor-pointer">
                  Debug
                </label>
                <Switch
                  id="debug-toggle"
                  checked={growthDebug}
                  onCheckedChange={setGrowthDebug}
                />
              </div>
                
              {/* Grid button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={toggleLayoutMode} 
                    className="flex items-center gap-2 h-9"
                  >
                    {layoutMode === 'single' ? (
                      <LayoutGrid className="h-4 w-4" />
                    ) : (
                      <Rows3 className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">
                      {layoutMode === 'single' ? 'Grid' : 'Single'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {layoutMode === 'single' ? 'Switch to grid layout' : 'Switch to single column layout'}
                </TooltipContent>
              </Tooltip>

              {/* Config button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setConfigDialogOpen(true)} 
                className="flex items-center gap-2 h-9"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Config</span>
              </Button>
            </div>
          </div>
      </header>
      
      <main className="flex-1 p-4 md:p-6">
          {isLoading && (
            <div className="flex h-[50vh] flex-col items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-[#FF6B35] mb-4" />
              <h2 className="text-xl font-semibold">Loading ALLSYMS...</h2>
              <p className="text-muted-foreground">Fetching ticker groups from Redis</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex h-[50vh] flex-col items-center justify-center">
              <div className="text-center text-red-600">
                <p className="text-xl font-semibold mb-2">Error Loading Data</p>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !error && filteredGroups.length === 0 && tickerGroups.length === 0 && (
            <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card/50">
              <h2 className="text-2xl font-bold tracking-tight">No ticker groups found</h2>
              <p className="text-muted-foreground">Check if ALLSYMS file exists in Redis</p>
            </div>
          )}

          {!isLoading && !error && filteredGroups.length === 0 && tickerGroups.length > 0 && (searchTerm || labelFilter !== 'all') && (
            <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card/50">
              <Search className="h-10 w-10 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold tracking-tight">No matching trends</h2>
              <p className="text-muted-foreground">
                No tickers match the current filters.
              </p>
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setLabelFilter('all');
                }}
                variant="outline"
                className="mt-4"
              >
                Clear Filters
              </Button>
            </div>
          )}

          {!isLoading && !error && sortedFilteredGroups.length > 0 && (
        <div className={cn(
          "grid gap-6",
          layoutMode === 'single' 
            ? "grid-cols-1" 
            : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        )}>
              {sortedFilteredGroups.map(({ group, filteredKeywords }) => (
                <TickerTrendsCard
                  key={group.baseTicker}
                  tickerGroup={group}
              isWideLayout={layoutMode === 'single'}
                  filteredKeywords={filteredKeywords}
                  onDataFound={handleDataFound}
                  onGrowthComputed={(ticker, summary) => handleGrowthComputed(ticker, summary)}
                  growthMode={growthMode}
                  showGrowthPercentage={labelFilter !== 'all'}
                  showGrowthDetails={growthDebug}
            />
          ))}
            </div>
          )}
      </main>

        <p className="fixed bottom-4 left-4 text-sm text-muted-foreground">
          Press{' '}
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>/
          </kbd>{' '}
          to open actions.
        </p>

        <CommandDialog open={isCommandMenuOpen} onOpenChange={setCommandMenuOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem
                onSelect={() => {
                  setCommandMenuOpen(false);
                  toggleLayoutMode();
                }}
              >
                {layoutMode === 'single' ? (
                  <LayoutGrid className="mr-2 h-4 w-4" />
                ) : (
                  <Rows3 className="mr-2 h-4 w-4" />
                )}
                <span>Switch to {layoutMode === 'single' ? 'Grid' : 'Single Column'} Layout</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setCommandMenuOpen(false);
                  setConfigDialogOpen(true);
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuration</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Tickers">
              {allTickers.slice(0, 10).map(ticker => (
                <CommandItem
                  key={ticker}
                  onSelect={() => {
                    setCommandMenuOpen(false);
                    setFilterTicker(ticker);
                  }}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  <span>{ticker}</span>
                </CommandItem>
              ))}
              {allTickers.length > 10 && (
                <CommandItem disabled>
                  <span className="text-muted-foreground">...and {allTickers.length - 10} more</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <ConfigDialog
          open={isConfigDialogOpen}
          onOpenChange={setConfigDialogOpen}
          keywords={[]}
          onRemoveKeyword={() => {}}
        />
    </div>
      )}
    </TooltipProvider>
  );
}
