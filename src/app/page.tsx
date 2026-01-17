'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { TickerTrendsCard } from '@/components/ticker-trends-card';
import { ConfigDialog } from '@/components/config-dialog';
import { Button } from '@/components/ui/button';
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
  const [tickersWithData, setTickersWithData] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    setIsLocalhost(typeof window !== 'undefined' && window.location.hostname === 'localhost');
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

  const buildTimeDisplay = buildTime
    ? buildTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
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

  // Filter ticker groups based on selection and search term
  const filteredGroups = useMemo(() => {
    let groups = tickerGroups;
    
    // Filter by ticker dropdown
    if (filterTicker !== 'all') {
      groups = groups.filter(g => g.baseTicker === filterTicker);
    }
    
    // Filter by search term - only show tickers that have keywords matching the search
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      groups = groups.filter(g => 
        g.keywords.some(kw => kw.keyword.toLowerCase().includes(searchLower))
      );
    }
    
    return groups;
  }, [tickerGroups, filterTicker, searchTerm]);

  // Unique tickers for the dropdown
  const allTickers = useMemo(() => {
    return tickerGroups.map(g => g.baseTicker).sort();
  }, [tickerGroups]);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <TrendingUp className="h-6 w-6 text-[#FF6B35]" strokeWidth={2.5} />
                    <h1 className={cn(
                      "text-2xl font-bold tracking-tight leading-none",
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
                      {buildTime
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

              <div className="flex flex-wrap items-center gap-2 flex-nowrap sm:flex-wrap w-full justify-center">
                {/* Search box for filtering by keyword - wider and centered */}
                <div className="relative w-full max-w-md">
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
                
                <Select value={filterTicker} onValueChange={setFilterTicker}>
                  <SelectTrigger className="w-[200px] h-9">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <SelectValue placeholder="Filter by ticker" />
        </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
        <div className="flex items-center gap-2">
                        <span>All Tickers</span>
                        <span className="text-xs text-muted-foreground">
                          ({tickerGroups.length})
                        </span>
                      </div>
                    </SelectItem>
                    {allTickers.map((ticker) => (
                      <SelectItem key={ticker} value={ticker}>
                        {ticker}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <div className="h-6 w-px bg-border" />
                
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleLayoutMode} 
                      className="flex items-center gap-2"
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

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setConfigDialogOpen(true)} 
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Config</span>
                </Button>
              </div>
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

          {!isLoading && !error && filteredGroups.length === 0 && tickerGroups.length > 0 && searchTerm && (
            <div className="flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card/50">
              <Search className="h-10 w-10 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold tracking-tight">No matching trends</h2>
              <p className="text-muted-foreground">No tickers have trends matching "{searchTerm}"</p>
              <Button onClick={() => setSearchTerm('')} variant="outline" className="mt-4">
                Clear Search
              </Button>
            </div>
          )}

          {!isLoading && !error && filteredGroups.length > 0 && (
        <div className={cn(
          "grid gap-6",
          layoutMode === 'single' 
            ? "grid-cols-1" 
            : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        )}>
              {filteredGroups.map((group) => (
                <TickerTrendsCard
                  key={group.baseTicker}
                  tickerGroup={group}
              isWideLayout={layoutMode === 'single'}
                  searchTerm={searchTerm}
                  onDataFound={handleDataFound}
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
    </TooltipProvider>
  );
}
