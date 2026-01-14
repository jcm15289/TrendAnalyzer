'use client';

import { useState, useEffect, useMemo } from 'react';
import { type KeywordSet } from '@/lib/keywords';
import { 
  KeywordList, 
  getKeywordsForList
} from '@/lib/lists';
import TrendsCard from '@/components/trends-card';
import StateOfWorld from '@/components/state-of-world';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Rows3 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Note: export const dynamic doesn't work in 'use client' components
// Using isMounted pattern instead to prevent SSR issues

export default function AlexonPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [keywords, setKeywords] = useState<KeywordSet[]>([]);
  const [lists, setLists] = useState<KeywordList[]>([]);
  const [growthMetrics, setGrowthMetrics] = useState<Record<string, number>>({});
  const [growthMode] = useState<'area' | 'peak' | 'both' | 'intelpeak'>('both');
  const [layoutMode, setLayoutMode] = useState<'single' | 'multi'>('multi');

  // Find or create "Interesting" list
  const interestingListId = useMemo(() => {
    // Early return during SSR
    if (typeof window === 'undefined') {
      return 'all';
    }
    if (!lists || !Array.isArray(lists)) {
      return 'all'; // Fallback if lists is not available
    }
    
    try {
      let interestingList = lists.find(list => 
        list && list.name && typeof list.name === 'string' && list.name.toLowerCase() === 'interesting'
      );
      
      // If "Interesting" list doesn't exist, return 'all' (we'll create it in useEffect)
      if (!interestingList) {
        return 'all'; // Return 'all' initially, will be updated in useEffect
      }
      
      return interestingList.id || 'all';
    } catch (error) {
      return 'all';
    }
  }, [lists]);
  
  // Create "Interesting" list if it doesn't exist (run only once after lists are loaded)
  useEffect(() => {
    if (!isMounted || !lists || !Array.isArray(lists) || lists.length === 0) return;
    
    try {
      const interestingList = lists.find(list => 
        list && list.name && typeof list.name === 'string' && list.name.toLowerCase() === 'interesting'
      );
      
      // Only create if it doesn't exist and we haven't already added it
      if (!interestingList) {
        const newInterestingList: KeywordList = {
          id: 'interesting',
          name: 'Interesting',
          description: 'Interesting trends',
          keywords: [],
          color: '#8B5CF6',
          icon: 'star',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setLists(prev => {
          // Double-check it doesn't exist before adding
          const exists = prev.some(l => l && l.name && l.name.toLowerCase() === 'interesting');
          if (exists) return prev;
          return [...prev, newInterestingList];
        });
      }
    } catch (error) {
      console.error('Error creating Interesting list:', error);
    }
    // Only depend on isMounted, not lists, to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  // Load keywords from Redis via API on component mount
  useEffect(() => {
    if (!isMounted) return; // Wait for mount
    
    const loadKeywords = async () => {
      try {
        const response = await fetch('/api/keywords/read');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            if (result.keywordSets && result.keywordSets.length > 0) {
              setKeywords(result.keywordSets);
              // Also save to localStorage as backup
              if (typeof window !== 'undefined') {
                localStorage.setItem('geopol-keywords', JSON.stringify(result.keywordSets));
              }
              return;
            } else if (result.keywords && result.keywords.length > 0) {
              // Convert single keywords to keyword sets
              const keywordSets = result.keywords.map((kw: string) => [kw]);
              setKeywords(keywordSets);
              if (typeof window !== 'undefined') {
                localStorage.setItem('geopol-keywords', JSON.stringify(keywordSets));
              }
              return;
            }
          }
        }
      } catch (error) {
        console.log('Could not load from API, falling back to localStorage:', error);
      }

      // Fallback to localStorage
      if (typeof window !== 'undefined') {
        const savedKeywords = localStorage.getItem('geopol-keywords');
        if (savedKeywords) {
          try {
            const parsed = JSON.parse(savedKeywords);
            setKeywords(parsed);
          } catch (error) {
            console.error('Error parsing saved keywords:', error);
          }
        }
      }
    };

    loadKeywords();
  }, [isMounted]);

  // Mark component as mounted to prevent SSR issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load layout preference from localStorage
  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return;
    const savedLayout = localStorage.getItem('geopol-layout-mode');
    if (savedLayout === 'multi' || savedLayout === 'single') {
      setLayoutMode(savedLayout);
    }
  }, [isMounted]);

  const toggleLayoutMode = () => {
    const newMode = layoutMode === 'single' ? 'multi' : 'single';
    setLayoutMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('geopol-layout-mode', newMode);
    }
  };

  // Load lists from Redis (only on client side)
  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return; // Skip during SSR
    
    const loadLists = async () => {
      try {
        const response = await fetch('/api/lists/read');
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.lists && result.lists.length > 0) {
            const listsWithDates = result.lists.map((list: any) => ({
              ...list,
              createdAt: list.createdAt ? new Date(list.createdAt) : new Date(),
              updatedAt: list.updatedAt ? new Date(list.updatedAt) : new Date(),
            }));
            setLists(listsWithDates);
            localStorage.setItem('geopol-lists', JSON.stringify(listsWithDates));
            return;
          }
        }
      } catch (error) {
        console.log('Could not load lists from Redis:', error);
      }

      // If Redis is empty, use minimal defaults
      const defaultLists: KeywordList[] = [
        {
          id: 'all',
          name: 'All Keywords',
          description: 'All keywords in the system',
          keywords: [],
          color: '#6B7280',
          icon: 'list',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'interesting',
          name: 'Interesting',
          description: 'Interesting trends',
          keywords: [],
          color: '#8B5CF6',
          icon: 'star',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      setLists(defaultLists);
    };
    
    loadLists();
  }, [isMounted]);

  // Filter keywords to only show "Interesting" category
  const filteredKeywords = useMemo(() => {
    try {
      // Guard against SSR and ensure mounted
      if (typeof window === 'undefined' || !isMounted) {
        return []; // Return empty during SSR
      }
      if (!keywords || !Array.isArray(keywords)) {
        return [];
      }
      if (!lists || !Array.isArray(lists)) {
        return [];
      }
      if (interestingListId === 'all') {
        // If no "Interesting" list exists, return empty array
        return [];
      }
      const listKeywords = getKeywordsForList(lists, interestingListId);
      if (!listKeywords || !Array.isArray(listKeywords) || listKeywords.length === 0) {
        // If Interesting list is empty, return empty array (don't show all keywords)
        return [];
      }
      // Filter keywords to only include those in the Interesting list
      const filtered = keywords.filter(keywordSet => {
        if (!keywordSet || !Array.isArray(keywordSet)) {
          return false;
        }
        try {
          const keywordSetStr = JSON.stringify(keywordSet.slice().sort());
          return listKeywords.some(listKw => {
            if (!listKw || !Array.isArray(listKw)) {
              return false;
            }
            return JSON.stringify(listKw.slice().sort()) === keywordSetStr;
          });
        } catch (e) {
          return false;
        }
      });
      // Return filtered keywords (even if empty - only show keywords in Interesting list)
      return filtered;
    } catch (error) {
      console.error('[Alexon] Error filtering keywords:', error);
      return []; // Return empty array on error
    }
  }, [keywords, lists, interestingListId, isMounted]);

  // Sort keywords by growth metric
  const sortedKeywords = useMemo(() => {
    try {
      // Guard against SSR
      if (typeof window === 'undefined' || !isMounted) {
        return [];
      }
      if (!filteredKeywords || !Array.isArray(filteredKeywords)) {
        return [];
      }
      const sorted = [...filteredKeywords].sort((a, b) => {
        if (!a || !Array.isArray(a) || !b || !Array.isArray(b)) {
          return 0;
        }
        try {
          const keyA = a.join('-');
          const keyB = b.join('-');
          
          const metricA = growthMetrics[keyA] || 0;
          const metricB = growthMetrics[keyB] || 0;
          
          return metricB - metricA;
        } catch (e) {
          return 0;
        }
      });
      
      return sorted;
    } catch (error) {
      console.error('Error sorting keywords:', error);
      return []; // Return empty array on error
    }
  }, [filteredKeywords, growthMetrics, isMounted]);

  // Don't render during SSR
  if (!isMounted) {
    return (
      <div className="flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-blue-700 overflow-hidden flex-shrink-0 bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              <Image 
                src="/alexon-photo.jpg" 
                alt="AG" 
                width={40} 
                height={40}
                className="object-cover w-full h-full"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.textContent) {
                    parent.textContent = 'AG';
                  }
                }}
              />
            </div>
            <h1 className={cn("text-2xl font-bold tracking-tight text-blue-600")}>
              AlexonGeoPolitics
            </h1>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <div className="flex h-[50vh] items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  // Ensure sortedKeywords is always an array
  const safeSortedKeywords = Array.isArray(sortedKeywords) ? sortedKeywords : [];

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full border border-gray-300 overflow-hidden flex-shrink-0 bg-blue-600 flex items-center justify-center">
            <Image 
              src="/alexon-photo.jpg" 
              alt="Alexon" 
              width={40} 
              height={40}
              className="object-cover w-full h-full"
              priority
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.textContent) {
                  parent.textContent = 'AG';
                  parent.className = 'h-10 w-10 rounded-full border border-gray-300 flex-shrink-0 bg-blue-600 flex items-center justify-center text-white font-bold text-sm';
                }
              }}
            />
          </div>
          <h1 className={cn("text-2xl font-bold tracking-tight text-blue-600")}>
            AlexonGeoPolitics
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleLayoutMode} 
                  className="flex items-center gap-2 min-w-[140px]"
                >
                  {layoutMode === 'single' ? (
                    <LayoutGrid className="h-4 w-4" />
                  ) : (
                    <Rows3 className="h-4 w-4" />
                  )}
                  <span>
                    {layoutMode === 'single' ? 'Grid View' : 'Single Chart View'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {layoutMode === 'single' ? 'Switch to grid layout' : 'Switch to single column layout'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>
      
      <main className="flex-1 p-4 md:p-6">
        <StateOfWorld keywords={safeSortedKeywords} growthMetrics={growthMetrics} />
        
        <div className={cn(
          "grid gap-6",
          layoutMode === 'single' 
            ? "grid-cols-1" 
            : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
        )}>
          {safeSortedKeywords.map((keywordSet) => (
            <TrendsCard
              key={keywordSet.join('-')}
              keywords={keywordSet}
              growthMode={growthMode}
              showGrowthDetails={false}
              isWideLayout={layoutMode === 'single'}
              hideMenu={true}
              onGrowthComputed={(keywordSet, summary) => {
                if (summary) {
                  const key = keywordSet.join('-');
                  setGrowthMetrics(prev => {
                    // Use bestPercent for 'both' mode instead of intelPeak
                    const newValue = summary.bestPercent ?? 0;
                    // Only update if value actually changed to prevent unnecessary re-renders
                    if (prev[key] === newValue) {
                      return prev;
                    }
                    return {
                      ...prev,
                      [key]: newValue,
                    };
                  });
                }
              }}
            />
          ))}
          
          {safeSortedKeywords.length === 0 && (
            <div className="col-span-full flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card/50">
              <h2 className="text-2xl font-bold tracking-tight">No keywords to track</h2>
              <p className="text-muted-foreground">Add new keywords to get started.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

