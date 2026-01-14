
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
import { Bot, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { compareTrends, CompareTrendsOutput } from '@/ai/flows/compare-trends-flow';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface CompareTrendsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CompareTrendsDialog({ open, onOpenChange }: CompareTrendsDialogProps) {
  const [term1, setTerm1] = useState('');
  const [term2, setTerm2] = useState('');
  const [error, setError] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<CompareTrendsOutput | null>(null);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const keywords = [term1, term2].map((s) => s.trim()).filter(Boolean);
    if (keywords.length !== 2) {
      setError('Please enter two keywords to compare.');
      return;
    }
    setError('');
    setIsComparing(true);
    setComparisonResult(null);

    try {
      const result = await compareTrends({
        keyword1: keywords[0],
        keyword2: keywords[1],
      });
      setComparisonResult(result);
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to compare trends. Please try again.',
      });
    } finally {
      setIsComparing(false);
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
        // Reset state when dialog closes
        setTerm1('');
        setTerm2('');
        setError('');
        setComparisonResult(null);
        setIsComparing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compare Trend Growth</DialogTitle>
          <DialogDescription>
            Enter two keywords to see which has grown more in the last week, powered by AI.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="compare-term1" className="text-right">
              Keyword 1
            </Label>
            <Input
              id="compare-term1"
              value={term1}
              onChange={(e) => setTerm1(e.target.value)}
              className="col-span-3"
              placeholder='e.g., "AI startups"'
              disabled={isComparing}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="compare-term2" className="text-right">
              Keyword 2
            </Label>
            <Input
              id="compare-term2"
              value={term2}
              onChange={(e) => setTerm2(e.target.value)}
              className="col-span-3"
              placeholder='e.g., "Web3 jobs"'
              disabled={isComparing}
            />
          </div>
          {error && <p className="col-span-4 text-center text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={isComparing}>
            {isComparing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-2 h-4 w-4" />
            )}
            Compare Trends
          </Button>
        </DialogFooter>

        {(isComparing || comparisonResult) && (
            <div className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {isComparing && (
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p>Analyzing trends, this may take a moment...</p>
                    </div>
                  )}
                  {comparisonResult && (
                    <div className="space-y-4">
                        <div>
                            <p className="font-semibold text-base">Winning Trend:</p>
                            <p className="text-primary font-bold text-lg">{comparisonResult.winner}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-base">Analysis:</p>
                            <p className="leading-relaxed">{comparisonResult.analysis}</p>
                        </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

      </DialogContent>
    </Dialog>
  );
}
