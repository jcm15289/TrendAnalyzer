'use client';

import { useState, useEffect } from 'react';
import { initialKeywords, type KeywordSet } from '@/lib/keywords';
import TrendsCard from '@/components/trends-card';
import { AddKeywordDialog } from '@/components/add-keyword-dialog';
import { CompareTrendsDialog } from '@/components/compare-trends-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, Scale, Command } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

export default function Home() {
  const [keywords, setKeywords] = useState<KeywordSet[]>(initialKeywords);
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [isCompareDialogOpen, setCompareDialogOpen] = useState(false);
  const [isCommandMenuOpen, setCommandMenuOpen] = useState(false);

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

  const handleAddKeyword = (newKeywordSet: KeywordSet) => {
    const isDuplicate = keywords.some(
      (set) => JSON.stringify(set.slice().sort()) === JSON.stringify(newKeywordSet.slice().sort())
    );
    if (!isDuplicate) {
      setKeywords((prev) => [newKeywordSet, ...prev]);
    }
    setAddDialogOpen(false);
  };

  const handleRemoveKeyword = (keywordSetToRemove: KeywordSet) => {
    setKeywords((prev) =>
      prev.filter(
        (set) => JSON.stringify(set.slice().sort()) !== JSON.stringify(keywordSetToRemove.slice().sort())
      )
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Trends Tracker</h1>
        <Button variant="outline" size="sm" onClick={() => setCommandMenuOpen(true)} className="flex items-center gap-2">
          <Command className="h-4 w-4" />
          <span>Actions...</span>
        </Button>
      </header>
      <main className="flex-1 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {keywords.map((keywordSet) => (
            <TrendsCard
              key={keywordSet.join('-')}
              keywords={keywordSet}
              onRemove={() => handleRemoveKeyword(keywordSet)}
            />
          ))}
          {keywords.length === 0 && (
            <div className="col-span-full flex h-[50vh] flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card/50">
              <h2 className="text-2xl font-bold tracking-tight">No topics to track</h2>
              <p className="text-muted-foreground">Add a new topic to get started.</p>
            </div>
          )}
        </div>
      </main>

      <p className="fixed bottom-4 right-4 text-sm text-muted-foreground">
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
                setAddDialogOpen(true);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>Add Topic</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandMenuOpen(false);
                setCompareDialogOpen(true);
              }}
            >
              <Scale className="mr-2 h-4 w-4" />
              <span>Compare Trends</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <AddKeywordDialog
        open={isAddDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAddKeyword={handleAddKeyword}
      />
      <CompareTrendsDialog
        open={isCompareDialogOpen}
        onOpenChange={setCompareDialogOpen}
      />
    </div>
  );
}
