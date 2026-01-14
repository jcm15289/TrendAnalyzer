'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import type { KeywordSet } from '@/lib/keywords';

interface StateOfWorldProps {
  keywords: KeywordSet[];
  growthMetrics: Record<string, number>;
}

export default function StateOfWorld({ keywords, growthMetrics }: StateOfWorldProps) {
  const [superconclusion, setSuperconclusion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywordsAnalyzed, setKeywordsAnalyzed] = useState<Array<{ keywords: string[]; growth: number }>>([]);

  const generateSuperconclusion = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('[StateOfWorld] Generating superconclusion', {
        keywordCount: keywords.length,
        growthMetricsCount: Object.keys(growthMetrics).length,
        sampleGrowthMetrics: Object.entries(growthMetrics).slice(0, 5)
      });
      
      const response = await fetch('/api/state-of-world', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keywordSets: keywords,
          growthMetrics,
        }),
      });
      
      const result = await response.json();
      console.log('[StateOfWorld] API response:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate superconclusion');
      }
      
      if (result.success) {
        if (result.superconclusion) {
          setSuperconclusion(result.superconclusion);
          setKeywordsAnalyzed(result.keywordsAnalyzed || []);
        } else {
          setError(result.message || 'No superconclusion available');
        }
      } else {
        throw new Error(result.error || 'Failed to generate superconclusion');
      }
    } catch (err) {
      console.error('[StateOfWorld] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't auto-generate - let user click the button when ready
  // This prevents premature attempts before conclusions are generated

  const highGrowthCount = keywords.filter((ks) => {
    const key = JSON.stringify([...ks].slice().sort());
    const growth = growthMetrics[key];
    return growth !== undefined && growth !== null && growth > 50;
  }).length;

  if (highGrowthCount === 0) {
    return null; // Don't show if no high-growth keywords
  }

  return (
    <Card className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">State of the World</h2>
            <p className="text-sm text-gray-600">
              Synthesized analysis of {keywordsAnalyzed.length > 0 ? keywordsAnalyzed.length : highGrowthCount} high-growth trends (&gt;50%)
            </p>
          </div>
          <Button
            onClick={generateSuperconclusion}
            disabled={isLoading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>{superconclusion ? 'Regenerate' : 'Generate'}</span>
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-sm font-medium mb-2">{error}</p>
            <p className="text-yellow-700 text-xs">
              {error.includes('No conclusions found') 
                ? 'Try clicking "Explain" on individual keyword cards first to generate their conclusions, then regenerate this analysis.'
                : 'Check the browser console for more details.'}
            </p>
          </div>
        )}

        {isLoading && !superconclusion && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Generating superconclusion...</span>
          </div>
        )}

        {superconclusion && (
          <div className="bg-white border border-blue-200 rounded-lg p-6">
            <div className="prose prose-sm max-w-none">
              <p className="text-base text-gray-900 leading-relaxed whitespace-pre-wrap">
                {superconclusion}
              </p>
            </div>
          </div>
        )}

        {keywordsAnalyzed.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Analyzed keywords:</p>
            <div className="flex flex-wrap gap-2">
              {keywordsAnalyzed.map((item, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium"
                >
                  {item.keywords.join(', ')} (+{item.growth.toFixed(1)}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

