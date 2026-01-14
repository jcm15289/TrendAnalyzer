'use client';

import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
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

interface AddKeywordDialogProps {
  onAddKeyword: (keywords: string[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddKeywordDialog({ onAddKeyword, open, onOpenChange }: AddKeywordDialogProps) {
  const [term1, setTerm1] = useState('');
  const [term2, setTerm2] = useState('');
  const [term3, setTerm3] = useState('');
  const [term4, setTerm4] = useState('');
  const [error, setError] = useState('');

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      // Reset form on close
      setTerm1('');
      setTerm2('');
      setTerm3('');
      setTerm4('');
      setError('');
    }
  };

  const handleSubmit = () => {
    const newKeywords = [term1, term2, term3, term4]
      .map((s) => s.trim())
      .filter(Boolean);
    if (newKeywords.length === 0) {
      setError('Please enter at least one keyword.');
      return;
    }
    onAddKeyword(newKeywords);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Keywords to Track</DialogTitle>
          <DialogDescription>
            Enter one or more keywords to track their trends over time.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="term1" className="text-right">
              Keyword 1
            </Label>
            <Input
              id="term1"
              value={term1}
              onChange={(e) => setTerm1(e.target.value)}
              className="col-span-3"
              placeholder='e.g., "Democrat"'
            />
          </div>
          {[
            { id: 'term2', label: 'Keyword 2', value: term2, setter: setTerm2, placeholder: '(Optional) e.g., "Republican"' },
            { id: 'term3', label: 'Keyword 3', value: term3, setter: setTerm3, placeholder: '(Optional) e.g., "Libertarian"' },
            { id: 'term4', label: 'Keyword 4', value: term4, setter: setTerm4, placeholder: '(Optional) e.g., "Green Party"' },
          ].map(({ id, label, value, setter, placeholder }) => (
            <div key={id} className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor={id} className="text-right">
                {label}
            </Label>
            <Input
                id={id}
                value={value}
                onChange={(e) => setter(e.target.value)}
              className="col-span-3"
                placeholder={placeholder}
            />
          </div>
          ))}
          {error && <p className="col-span-4 text-center text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            Add Keywords
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
