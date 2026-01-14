'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { initialKeywords, type KeywordSet } from '@/lib/keywords';
import { 
  KeywordList, 
  DEFAULT_LISTS, 
  getKeywordsForList, 
  addKeywordToList,
  removeKeywordFromList,
  createNewList,
  deleteList,
  updateList,
  getAllKeywordsFromLists
} from '@/lib/lists';
import TrendsCard from '@/components/trends-card';
import { ConfigDialog } from '@/components/config-dialog';
import StateOfWorld from '@/components/state-of-world';
import { Button } from '@/components/ui/button';
import { Command, Settings, LayoutGrid, Rows3, List, ChevronDown } from 'lucide-react';
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

export default function Home() {
  const [keywords, setKeywords] = useState<KeywordSet[]>([]);
  const [lists, setLists] = useState<KeywordList[]>(DEFAULT_LISTS);
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [isConfigDialogOpen, setConfigDialogOpen] = useState(false);
  const [isCommandMenuOpen, setCommandMenuOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'single' | 'multi'>('single');
  const [growthMetrics, setGrowthMetrics] = useState<Record<string, number>>({});
  const [growthMode, setGrowthMode] = useState<'area' | 'peak' | 'both' | 'intelpeak'>('intelpeak');
  const [growthDebug, setGrowthDebug] = useState(false);
  const [savedOrder, setSavedOrder] = useState<string[] | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);
  
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

  // Load all trends from Redis cache-trends:Trends.* instead of keywords
  useEffect(() => {
    const loadAllTrends = async () => {
      try {
        // Fetch all trends from Redis cache
        const response = await fetch('/api/trends/all');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.trends && result.trends.length > 0) {
            // Convert trends to keyword sets (each trend becomes a single-keyword set)
            const keywordSets = result.trends.map((trend: any) => [trend.keyword]);
            setKeywords(keywordSets);
            console.log('Loaded trends from Redis cache:', {
              count: keywordSets.length,
              keywords: keywordSets.slice(0, 10).map((ks: string[]) => ks[0]),
            });
            return;
          }
      }
    } catch (error) {
        console.error('Could not load trends from Redis:', error);
      }

      // Fallback: try to load from keywords API if no trends found
      try {
        const response = await fetch('/api/keywords/read');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            if (result.keywordSets && result.keywordSets.length > 0) {
              setKeywords(result.keywordSets);
              return;
            } else if (result.keywords && result.keywords.length > 0) {
              const keywordSets = result.keywords.map((keyword: string) => [keyword]);
              setKeywords(keywordSets);
              return;
            }
          }
        }
      } catch (error) {
        console.log('Could not load from keywords API:', error);
      }

      // Final fallback: use empty array (no keywords)
      setKeywords([]);
    };

    loadAllTrends();

  // Load layout preference from localStorage
    const savedLayout = localStorage.getItem('geopol-layout-mode');
    if (savedLayout === 'multi' || savedLayout === 'single') {
      setLayoutMode(savedLayout);
    }
    
    // Load lists from localStorage FIRST (to preserve existing data), then sync to Redis
    const loadLists = async () => {
      let listsToUse = null;
      
      // FIRST: Check localStorage for existing lists (this is where the data is!)
      const savedLists = localStorage.getItem('geopol-lists');
      if (savedLists) {
        try {
          const parsedLists = JSON.parse(savedLists);
          if (parsedLists && parsedLists.length > 0) {
            console.log('Found lists in localStorage, using and syncing to Redis:', parsedLists);
            listsToUse = parsedLists;
            setLists(parsedLists);
            
            // Sync these lists to Redis so all instances use them
            try {
              await fetch('/api/lists/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lists: parsedLists })
              });
              console.log('Successfully synced localStorage lists to Redis');
            } catch (syncError) {
              console.error('Failed to sync lists to Redis:', syncError);
            }
            return;
          }
        } catch (error) {
          console.error('Error parsing saved lists:', error);
        }
      }

      // SECOND: If no localStorage, try Redis
      try {
        const response = await fetch('/api/lists/read');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.lists && result.lists.length > 0) {
            console.log('Loaded lists from Redis:', result.lists);
            setLists(result.lists);
            localStorage.setItem('geopol-lists', JSON.stringify(result.lists));
            return;
          }
        }
      } catch (error) {
        console.log('Could not load lists from Redis:', error);
      }

      // THIRD: Use defaults only if nothing else exists
      console.log('No lists found, using defaults');
      setLists(DEFAULT_LISTS);
    };
    
    loadLists();
    
    // Load saved chart order from localStorage
    const savedOrderStr = localStorage.getItem('geopol-chart-order');
    if (savedOrderStr) {
      try {
        const parsedOrder = JSON.parse(savedOrderStr);
        if (Array.isArray(parsedOrder)) {
          setSavedOrder(parsedOrder);
        }
      } catch (error) {
        console.error('Error parsing saved chart order:', error);
      }
    }
    
    // Load selected list
    const savedSelectedList = localStorage.getItem('geopol-selected-list');
    if (savedSelectedList) {
      setSelectedListId(savedSelectedList);
    }
  }, []);

  // Save keywords to localStorage and sync with Keywords file whenever they change
  useEffect(() => {
    if (keywords.length > 0) {
      localStorage.setItem('geopol-keywords', JSON.stringify(keywords));
      
      // Sync with Keywords file
      const syncWithFile = async () => {
        try {
          await fetch('/api/keywords/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords })
          });
        } catch (error) {
          console.error('Failed to sync keywords with file:', error);
        }
      };
      
      syncWithFile();
    }
  }, [keywords]);
  
  // Update the 'All' list with all keywords whenever keywords change
  useEffect(() => {
    setLists(prevLists => {
      return prevLists.map(list => {
        if (list.id === 'all') {
          return {
            ...list,
            keywords: keywords,
            updatedAt: new Date()
          };
        }
        return list;
      });
    });
  }, [keywords]);
  
  // Save lists to localStorage and sync to Redis whenever they change
  useEffect(() => {
    if (lists.length > 0) {
      localStorage.setItem('geopol-lists', JSON.stringify(lists));
      
      // Sync with Redis
      const syncLists = async () => {
        try {
          await fetch('/api/lists/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lists })
          });
        } catch (error) {
          console.error('Failed to sync lists to Redis:', error);
        }
      };
      
      syncLists();
    }
  }, [lists]);
  
  // Save selected list to localStorage
  useEffect(() => {
    localStorage.setItem('geopol-selected-list', selectedListId);
  }, [selectedListId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandMenuOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const normalizeKeywordSet = (set: KeywordSet) =>
    JSON.stringify(
      set
        .map((keyword) => keyword.trim().toLowerCase())
        .filter((keyword) => keyword.length > 0)
        .sort()
    );

  const handleAddKeyword = (newKeywordSet: KeywordSet, listId?: string) => {
    // Disabled - trends are now loaded automatically from Redis cache
    console.log('Add keyword disabled - trends are loaded from Redis cache');
  };

  const handleRemoveKeyword = (keywordSetToRemove: KeywordSet) => {
    setKeywords((prev) =>
      prev.filter(
        (set) => JSON.stringify(set.slice().sort()) !== JSON.stringify(keywordSetToRemove.slice().sort())
      )
    );
  };
  const handleUpdateKeywordSet = (previous: KeywordSet, updated: KeywordSet) => {
    const cleanedUpdated = updated.map((keyword) => keyword.trim()).filter((keyword) => keyword.length > 0);

    if (cleanedUpdated.length === 0) {
      return { success: false, error: 'Please enter at least one keyword.' };
    }

    const normalizedPrevious = normalizeKeywordSet(previous);
    const normalizedUpdated = normalizeKeywordSet(cleanedUpdated);

    let duplicate = false;
    setKeywords((prev) => {
      duplicate = prev.some(
        (set) =>
          normalizeKeywordSet(set) === normalizedUpdated &&
          normalizeKeywordSet(set) !== normalizedPrevious
      );

      if (duplicate) {
        return prev;
      }

      return prev.map((set) =>
        normalizeKeywordSet(set) === normalizedPrevious ? cleanedUpdated : set
      );
    });

    if (duplicate) {
      return { success: false, error: 'Those keywords already exist in another chart.' };
    }

    setLists((prevLists) =>
      prevLists.map((list) => {
        let changed = false;
        const updatedKeywords = list.keywords.map((set) => {
          if (normalizeKeywordSet(set) === normalizedPrevious) {
            changed = true;
            return cleanedUpdated;
          }
          return set;
        });

        if (!changed) {
          return list;
        }

        return {
          ...list,
          keywords: updatedKeywords,
          updatedAt: new Date(),
        };
      })
    );

    return { success: true };
  };
  
  const handleAddKeywordToList = (listId: string, keywordSet: KeywordSet) => {
    setLists((prevLists) => {
      const targetList = prevLists.find((list) => list.id === listId);
      if (!targetList) {
        return prevLists;
      }

      const setKey = JSON.stringify(keywordSet.slice().sort());
      const alreadyInList = targetList.keywords.some(
        (ks) => JSON.stringify(ks.slice().sort()) === setKey,
      );

      return alreadyInList
        ? removeKeywordFromList(prevLists, listId, keywordSet)
        : addKeywordToList(prevLists, listId, keywordSet);
    });
  };
  
  const handleCreateListAndAdd = (name: string, keywordSet?: KeywordSet) => {
    const newList = createNewList(name, `Custom list: ${name}`);
    // If keywords are provided, add them to the new list
    if (keywordSet) {
      newList.keywords = [keywordSet];
    }
    setLists(prevLists => [...prevLists, newList]);
  };

  const toggleLayoutMode = () => {
    const newMode = layoutMode === 'single' ? 'multi' : 'single';
    setLayoutMode(newMode);
    localStorage.setItem('geopol-layout-mode', newMode);
  };
  
  // Get filtered keywords based on selected list
  const getFilteredKeywords = () => {
    if (selectedListId === 'all') {
      return keywords;
    }
    
    const selectedList = lists.find(l => l.id === selectedListId);
    if (!selectedList) {
      return keywords;
    }
    
    // Filter keywords that are in the selected list
    return keywords.filter(keywordSet => {
      return selectedList.keywords.some(
        listKeywordSet => JSON.stringify(listKeywordSet.slice().sort()) === JSON.stringify(keywordSet.slice().sort())
      );
    });
  };
  
  const keywordSetKey = useCallback((set: KeywordSet) => {
    return JSON.stringify([...set].slice().sort());
  }, []);

  const handleGrowthComputed = useCallback(
    (
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
      } | null
    ) => {
      setGrowthMetrics((prev) => {
        const key = keywordSetKey(keywordSet);
        // Use IntelPeak if available, otherwise fall back to bestPercent
        const metricValue = summary?.intelPeak !== null && summary?.intelPeak !== undefined 
          ? summary.intelPeak 
          : (summary?.bestPercent ?? null);
        
        if (metricValue === null || Number.isNaN(metricValue)) {
          if (!(key in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[key];
          return next;
        }

        const currentValue = prev[key];
        if (currentValue === metricValue) {
          return prev;
        }

        return {
          ...prev,
          [key]: metricValue,
        };
      });
    },
    [keywordSetKey]
  );

  const filteredKeywords = getFilteredKeywords();
  
  // Sort keywords: first apply saved order if available, then sort by growth
  const sortedKeywords = useMemo(() => {
    const keywordsCopy = [...filteredKeywords];
    
    // If we have a saved order, use it as the base order
    if (savedOrder && savedOrder.length > 0) {
      // Create a map of keyword sets by their key for quick lookup
      const keywordMap = new Map<string, KeywordSet>();
      filteredKeywords.forEach(kw => {
        keywordMap.set(keywordSetKey(kw), kw);
      });
      
      // Build ordered array from saved order, then add any new keywords not in saved order
      const ordered: KeywordSet[] = [];
      const seen = new Set<string>();
      
      // Add keywords in saved order
      savedOrder.forEach(key => {
        const kw = keywordMap.get(key);
        if (kw) {
          ordered.push(kw);
          seen.add(key);
        }
      });
      
      // Add any new keywords not in saved order
      filteredKeywords.forEach(kw => {
        const key = keywordSetKey(kw);
        if (!seen.has(key)) {
          ordered.push(kw);
        }
      });
      
      // Now sort by growth metrics while preserving relative order for items with same score
      return ordered.sort((a, b) => {
        const keyA = keywordSetKey(a);
        const keyB = keywordSetKey(b);
        const scoreA = keyA in growthMetrics ? growthMetrics[keyA] : -Infinity;
        const scoreB = keyB in growthMetrics ? growthMetrics[keyB] : -Infinity;
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        // If scores are equal, maintain relative order from saved order
        const indexA = ordered.indexOf(a);
        const indexB = ordered.indexOf(b);
        return indexA - indexB;
      });
    }
    
    // No saved order: sort by growth metrics
    return keywordsCopy.sort((a, b) => {
    const keyA = keywordSetKey(a);
    const keyB = keywordSetKey(b);
    const scoreA = keyA in growthMetrics ? growthMetrics[keyA] : -Infinity;
    const scoreB = keyB in growthMetrics ? growthMetrics[keyB] : -Infinity;
    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }
    return b.length - a.length;
  });
  }, [filteredKeywords, growthMetrics, savedOrder, keywordSetKey]);
  
  // Track previous order to detect changes
  const prevOrderRef = useRef<string[] | null>(null);
  
  // Save the order whenever it changes (after growth metrics update)
  useEffect(() => {
    if (sortedKeywords.length === 0) return;
    
    const currentOrder = sortedKeywords.map(kw => keywordSetKey(kw));
    const prevOrder = prevOrderRef.current;
    
    // Only save if order has actually changed from previous render
    if (!prevOrder || JSON.stringify(currentOrder) !== JSON.stringify(prevOrder)) {
      localStorage.setItem('geopol-chart-order', JSON.stringify(currentOrder));
      setSavedOrder(currentOrder);
      prevOrderRef.current = currentOrder;
    }
  }, [sortedKeywords, keywordSetKey]);

    return (
    <TooltipProvider>
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <h1 className={cn(
                      "text-2xl font-bold tracking-tight leading-none",
                      isLocalhost ? "text-red-600" : "text-primary"
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
                    <div className="font-semibold">TrendsAnalyzer v2.1.0 - Admin</div>
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
                    <div className="text-xs text-muted-foreground">Redis-Only Architecture</div>
          </div>
                </TooltipContent>
              </Tooltip>
            <div className="flex flex-wrap items-center gap-2 flex-nowrap sm:flex-wrap">
                <Select value={selectedListId} onValueChange={setSelectedListId}>
                  <SelectTrigger className="w-[280px] h-9">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <SelectValue placeholder="Select a list" />
          </div>
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: list.color || '#6B7280' }}
                          />
                          <span>{list.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({list.keywords.length})
                          </span>
      </div>
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
                <Button variant="outline" size="sm" onClick={() => setConfigDialogOpen(true)} className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Config</span>
                  <span className="sm:hidden">Config</span>
                </Button>
                <div className="flex items-center gap-1 rounded-md border border-input bg-background px-1 py-1 text-xs font-medium text-muted-foreground">
                  {[
                    { value: 'intelpeak' as const, label: 'IntelPeak' },
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
                <button
                  type="button"
                  onClick={() => setGrowthDebug((prev) => !prev)}
                  className={cn(
                    'px-2 py-1 rounded-md border text-xs font-medium transition-colors whitespace-nowrap',
                    growthDebug
                      ? 'border-amber-300 bg-amber-500/10 text-amber-700 shadow-sm'
                      : 'border-input text-muted-foreground hover:text-foreground',
                  )}
                  aria-pressed={growthDebug}
                >
                  Debug {growthDebug ? 'On' : 'Off'}
                </button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <StateOfWorld keywords={sortedKeywords} growthMetrics={growthMetrics} />
        <div className={
          layoutMode === 'single' 
            ? "grid grid-cols-1 gap-6" 
            : "grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3"
        }>
          {sortedKeywords.map((keywordSet) => (
            <TrendsCard
              key={keywordSet.join('-')}
              keywords={keywordSet}
              onRemove={handleRemoveKeyword}
              isWideLayout={layoutMode === 'single'}
              lists={lists}
              onAddToList={handleAddKeywordToList}
              onCreateNewList={handleCreateListAndAdd}
              onUpdateKeywords={handleUpdateKeywordSet}
              growthMode={growthMode}
              showGrowthDetails={growthDebug}
              onGrowthComputed={handleGrowthComputed}
            />
          ))}
            {sortedKeywords.length === 0 && (
            <div className="col-span-full flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card/50">
                <h2 className="text-2xl font-bold tracking-tight">
                  {selectedListId !== 'all' ? 'No keywords in this list' : 'No keywords to track'}
                </h2>
                <p className="text-muted-foreground">
                  {selectedListId !== 'all' ? 'Add keywords to this list or select a different list.' : 'Add new keywords to get started.'}
                </p>
            </div>
          )}
        </div>
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
        </CommandList>
      </CommandDialog>


        <ConfigDialog
          open={isConfigDialogOpen}
          onOpenChange={setConfigDialogOpen}
          keywords={keywords}
          onRemoveKeyword={handleRemoveKeyword}
        />
    </div>
    </TooltipProvider>
  );
}

