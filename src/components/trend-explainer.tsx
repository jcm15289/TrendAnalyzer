'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { KeywordSet } from '@/lib/keywords';
import GoogleTrendsChartRedis from './google-trends-chart-redis';

interface TrendExplainerProps {
  keywords: KeywordSet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trendData?: any;
  regenerateOnOpen?: boolean;
  hideRegenerate?: boolean;
}

interface PeakSummary {
  date: string;
  keyword: string;
  value: number;
  summary: string;
}

export default function TrendExplainer({ keywords, open, onOpenChange, trendData, regenerateOnOpen = false, hideRegenerate = false }: TrendExplainerProps) {
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [peakSummaries, setPeakSummaries] = useState<PeakSummary[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Sanitize data to remove circular references and non-serializable values
  const sanitizeData = (data: any, visited = new WeakSet(), depth = 0): any => {
    if (depth === 0) {
      console.log('[SANITIZE] Starting sanitization, type:', typeof data, 'isArray:', Array.isArray(data));
    }
    
    if (data === null || data === undefined) {
      return data;
    }
    
    // Handle primitives
    if (typeof data !== 'object') {
      return data;
    }
    
    // Handle Date objects
    if (data instanceof Date) {
      return data.toISOString();
    }
    
    // Skip React elements, DOM nodes, and functions
    if (data.$$typeof || data.nodeType || typeof data === 'function') {
      return undefined;
    }
    
    // Check for circular references
    if (visited.has(data)) {
      if (depth === 0) {
        console.warn('[SANITIZE] Circular reference detected at root level');
      }
      return undefined;
    }
    
    visited.add(data);
    
    try {
      // Handle arrays
      if (Array.isArray(data)) {
        if (depth === 0) {
          console.log('[SANITIZE] Processing array, length:', data.length);
        }
        const result = data.map(item => sanitizeData(item, visited, depth + 1));
        if (depth === 0) {
          console.log('[SANITIZE] Array processed, result length:', result.length);
        }
        return result;
      }
      
      // Handle plain objects
      if (depth === 0) {
        console.log('[SANITIZE] Processing object, keys:', Object.keys(data).slice(0, 10).join(', '));
      }
      const sanitized: any = {};
      let processedKeys = 0;
      let skippedKeys = 0;
      
      for (const key in data) {
        // Skip internal React/private properties
        if (key.startsWith('_') || key.startsWith('$') || key === 'ref' || key === 'key') {
          skippedKeys++;
          continue;
        }
        // Skip 'results' property as it may contain circular references from React components
        if (key === 'results') {
          if (depth === 0) {
            console.log('[SANITIZE] Skipping "results" property to avoid circular references');
          }
          skippedKeys++;
          continue;
        }
        try {
          const value = sanitizeData(data[key], visited, depth + 1);
          if (value !== undefined) {
            sanitized[key] = value;
            processedKeys++;
          } else {
            skippedKeys++;
          }
        } catch (err) {
          if (depth === 0) {
            console.warn('[SANITIZE] Error processing key', key, ':', err);
          }
          skippedKeys++;
          continue;
        }
      }
      if (depth === 0) {
        console.log('[SANITIZE] Object processed, processed:', processedKeys, 'skipped:', skippedKeys);
      }
      return sanitized;
    } catch (err) {
      console.error('[SANITIZE] Error processing object:', err);
      return undefined;
    }
  };

  const generateExplanation = async (regenerate: boolean | Event = false) => {
    console.log('[EXPLAIN] ========== START generateExplanation ==========');
    console.log('[EXPLAIN] regenerate param type:', typeof regenerate);
    console.log('[EXPLAIN] regenerate param:', regenerate);
    
    // Handle event object being passed instead of boolean
    const shouldRegenerate = typeof regenerate === 'boolean' ? regenerate : false;
    console.log('[EXPLAIN] shouldRegenerate:', shouldRegenerate);
    
    // Use chartData if trendData is not available
    const dataToUse = trendData || chartData;
    console.log('[EXPLAIN] trendData exists:', !!trendData);
    console.log('[EXPLAIN] chartData exists:', !!chartData);
    console.log('[EXPLAIN] dataToUse exists:', !!dataToUse);
    console.log('[EXPLAIN] dataToUse type:', typeof dataToUse);
    
    if (!dataToUse) {
      console.error('[EXPLAIN] ❌ No trend data available');
      console.error('[EXPLAIN] trendData:', trendData);
      console.error('[EXPLAIN] chartData:', chartData);
      console.error('[EXPLAIN] This might mean the chart has not loaded data yet');
      setError('No trend data available for analysis. Please wait for the chart to load.');
      return;
    }

    setIsLoading(true);
    setError('');
    if (shouldRegenerate) {
      setExplanation(''); // Clear explanation when regenerating
    }

    try {
      console.log('[EXPLAIN] ========== STEP 1: Initial Data Inspection ==========');
      console.log('[EXPLAIN] Keywords:', JSON.stringify(keywords));
      console.log('[EXPLAIN] Keywords type:', typeof keywords);
      console.log('[EXPLAIN] Keywords isArray:', Array.isArray(keywords));
      console.log('[EXPLAIN] DataToUse type:', typeof dataToUse);
      console.log('[EXPLAIN] DataToUse is null:', dataToUse === null);
      console.log('[EXPLAIN] DataToUse is undefined:', dataToUse === undefined);
      console.log('[EXPLAIN] DataToUse keys:', dataToUse ? Object.keys(dataToUse) : 'null');
      console.log('[EXPLAIN] DataToUse.timelineData exists:', !!dataToUse?.timelineData);
      console.log('[EXPLAIN] TrendData.timelineData type:', typeof trendData?.timelineData);
      console.log('[EXPLAIN] TrendData.timelineData isArray:', Array.isArray(trendData?.timelineData));
      console.log('[EXPLAIN] TrendData.timelineData length:', trendData?.timelineData?.length);
      console.log('[EXPLAIN] TrendData.results exists:', !!trendData?.results);
      console.log('[EXPLAIN] TrendData.results type:', typeof trendData?.results);
      console.log('[EXPLAIN] TrendData.results isArray:', Array.isArray(trendData?.results));
      
      // Sanitize trendData before sending
      console.log('[EXPLAIN] ========== STEP 2: Sanitization ==========');
      console.log('[EXPLAIN] Calling sanitizeData...');
      let sanitizedTrendData: any;
      try {
        sanitizedTrendData = sanitizeData(dataToUse);
        console.log('[EXPLAIN] ✅ Sanitization complete');
        console.log('[EXPLAIN] Sanitized data type:', typeof sanitizedTrendData);
        console.log('[EXPLAIN] Sanitized data is null:', sanitizedTrendData === null);
        console.log('[EXPLAIN] Sanitized data is undefined:', sanitizedTrendData === undefined);
        console.log('[EXPLAIN] Sanitized data keys:', sanitizedTrendData ? Object.keys(sanitizedTrendData) : 'null');
        console.log('[EXPLAIN] Sanitized timelineData exists:', !!sanitizedTrendData?.timelineData);
        console.log('[EXPLAIN] Sanitized timelineData type:', typeof sanitizedTrendData?.timelineData);
        console.log('[EXPLAIN] Sanitized timelineData isArray:', Array.isArray(sanitizedTrendData?.timelineData));
        console.log('[EXPLAIN] Sanitized timelineData length:', sanitizedTrendData?.timelineData?.length);
        console.log('[EXPLAIN] Sanitized results exists:', !!sanitizedTrendData?.results);
      } catch (sanitizeError) {
        console.error('[EXPLAIN] ❌ Sanitization failed:', sanitizeError);
        console.error('[EXPLAIN] Sanitization error type:', typeof sanitizeError);
        console.error('[EXPLAIN] Sanitization error details:', {
          message: sanitizeError instanceof Error ? sanitizeError.message : 'Unknown',
          name: sanitizeError instanceof Error ? sanitizeError.name : 'Unknown',
          stack: sanitizeError instanceof Error ? sanitizeError.stack : 'No stack',
        });
        setError('Failed to prepare data for analysis. Sanitization error.');
        return;
      }
      
      console.log('[EXPLAIN] ========== STEP 3: Validation ==========');
      if (!sanitizedTrendData) {
        console.error('[EXPLAIN] ❌ Sanitized data is null/undefined');
        setError('Invalid trend data structure. Please try again.');
        return;
      }
      
      if (!sanitizedTrendData.timelineData) {
        console.error('[EXPLAIN] ❌ Sanitized data is missing timelineData');
        console.error('[EXPLAIN] Available keys:', Object.keys(sanitizedTrendData));
        try {
          const preview = JSON.stringify(sanitizedTrendData, null, 2).substring(0, 500);
          console.error('[EXPLAIN] Sanitized data preview:', preview);
        } catch (e) {
          console.error('[EXPLAIN] Cannot preview sanitized data:', e);
        }
        setError('Invalid trend data structure. Please try again.');
        return;
      }
      
      console.log('[EXPLAIN] ✅ Validation passed');
      
      // Create a clean data structure without the 'results' property which may contain circular references
      // Only include what's needed for the API
      console.log('[EXPLAIN] ========== STEP 4: Create Clean Data Structure ==========');
      const cleanTrendData: any = {
        timelineData: sanitizedTrendData.timelineData,
      };
      
      // Only add keywords if they exist and are valid
      if (sanitizedTrendData.keywords && Array.isArray(sanitizedTrendData.keywords)) {
        cleanTrendData.keywords = sanitizedTrendData.keywords;
        console.log('[EXPLAIN] Added keywords from sanitized data');
      } else if (keywords && Array.isArray(keywords)) {
        cleanTrendData.keywords = keywords;
        console.log('[EXPLAIN] Added keywords from prop');
      }
      
      console.log('[EXPLAIN] Clean trendData keys:', Object.keys(cleanTrendData));
      console.log('[EXPLAIN] Clean trendData.timelineData length:', cleanTrendData.timelineData?.length);
      console.log('[EXPLAIN] Clean trendData.keywords:', cleanTrendData.keywords);
      
      // Test if clean data can be stringified before creating full payload
      console.log('[EXPLAIN] ========== STEP 5: Test Clean Data Serialization ==========');
      try {
        const testString = JSON.stringify(cleanTrendData);
        console.log('[EXPLAIN] ✅ Clean data serialization test passed, length:', testString.length);
      } catch (testError) {
        console.error('[EXPLAIN] ❌ Clean data cannot be serialized:', testError);
        console.error('[EXPLAIN] Test error type:', typeof testError);
        console.error('[EXPLAIN] Test error message:', testError instanceof Error ? testError.message : 'Unknown');
        console.error('[EXPLAIN] Test error stack:', testError instanceof Error ? testError.stack : 'No stack');
        
        // Try to create an even more minimal version
        console.log('[EXPLAIN] Attempting with minimal data structure (timelineData only)...');
        const minimalData: any = {
          timelineData: sanitizedTrendData.timelineData,
        };
        
        try {
          JSON.stringify(minimalData);
          console.log('[EXPLAIN] ✅ Minimal data is serializable');
          Object.assign(cleanTrendData, minimalData);
        } catch (minError) {
          console.error('[EXPLAIN] ❌ Even minimal data cannot be serialized:', minError);
          setError('Failed to prepare data for analysis. Data serialization error.');
          return;
        }
      }
      
      console.log('[EXPLAIN] ========== STEP 6: Create Full Payload ==========');
      const requestPayload: any = {
        keywords: keywords,
        trendData: cleanTrendData,
        regenerate: shouldRegenerate,
      };
      
      console.log('[EXPLAIN] Payload keys:', Object.keys(requestPayload));
      console.log('[EXPLAIN] Payload.keywords:', requestPayload.keywords);
      console.log('[EXPLAIN] Payload.trendData keys:', Object.keys(requestPayload.trendData));
      console.log('[EXPLAIN] Payload.regenerate:', requestPayload.regenerate);
      
      // Test each part individually
      console.log('[EXPLAIN] ========== STEP 7: Test Individual Payload Parts ==========');
      try {
        JSON.stringify({ keywords });
        console.log('[EXPLAIN] ✅ Keywords are serializable');
      } catch (e) {
        console.error('[EXPLAIN] ❌ Keywords are NOT serializable:', e);
      }
      
      try {
        JSON.stringify({ trendData: cleanTrendData });
        console.log('[EXPLAIN] ✅ trendData alone is serializable');
      } catch (e) {
        console.error('[EXPLAIN] ❌ trendData alone is NOT serializable:', e);
        console.error('[EXPLAIN] trendData error details:', {
          message: e instanceof Error ? e.message : 'Unknown',
          stack: e instanceof Error ? e.stack : 'No stack',
        });
      }
      
      try {
        JSON.stringify({ regenerate });
        console.log('[EXPLAIN] ✅ regenerate is serializable');
      } catch (e) {
        console.error('[EXPLAIN] ❌ regenerate is NOT serializable:', e);
      }
      
      console.log('[EXPLAIN] ========== STEP 8: Serialize Full Payload ==========');
      let requestBody: string;
      try {
        requestBody = JSON.stringify(requestPayload);
        console.log('[EXPLAIN] ✅ JSON.stringify successful');
        console.log('[EXPLAIN] Request body length:', requestBody.length);
        console.log('[EXPLAIN] Request body preview (first 200 chars):', requestBody.substring(0, 200));
      } catch (stringifyError) {
        console.error('[EXPLAIN] ❌ JSON.stringify failed on full payload');
        console.error('[EXPLAIN] Stringify error type:', typeof stringifyError);
        console.error('[EXPLAIN] Stringify error:', stringifyError);
        console.error('[EXPLAIN] Error details:', {
          message: stringifyError instanceof Error ? stringifyError.message : 'Unknown',
          name: stringifyError instanceof Error ? stringifyError.name : 'Unknown',
          stack: stringifyError instanceof Error ? stringifyError.stack : 'No stack',
        });
        setError('Failed to prepare data for analysis. Please try again.');
        return;
      }
      
      console.log('[EXPLAIN] ========== STEP 9: Send API Request ==========');
      console.log('[EXPLAIN] Sending fetch request to /api/explain-trend...');
      console.log('[EXPLAIN] Request body size:', requestBody.length, 'bytes');
      
      const response = await fetch('/api/explain-trend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      console.log('[EXPLAIN] ========== STEP 10: Process Response ==========');
      console.log('[EXPLAIN] Response received');
      console.log('[EXPLAIN] Response status:', response.status);
      console.log('[EXPLAIN] Response statusText:', response.statusText);
      console.log('[EXPLAIN] Response ok:', response.ok);
      console.log('[EXPLAIN] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorMessage = `HTTP error: ${response.status}`;
        try {
          const errorText = await response.text();
          console.error('[EXPLAIN] Error response text:', errorText);
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorData.details || errorMessage;
            console.error('[EXPLAIN] Parsed error data:', errorData);
          } catch {
            errorMessage = errorText || response.statusText || errorMessage;
          }
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        console.error('[EXPLAIN] Setting error:', errorMessage);
        setError(errorMessage);
        return;
      }

      console.log('[EXPLAIN] Parsing response JSON...');
      const result = await response.json();
      console.log('[EXPLAIN] Response parsed, success:', result.success);
      console.log('[EXPLAIN] Has explanation:', !!result.explanation);
      console.log('[EXPLAIN] Explanation length:', result.explanation?.length || 0);
      console.log('[EXPLAIN] Cached:', result.cached);

      if (result.success) {
      setExplanation(result.explanation);
        // Extract peak summaries if available
        console.log('[EXPLAIN] ========== PEAK SUMMARIES CHECK ==========');
        console.log('[EXPLAIN] Full response keys:', Object.keys(result));
        console.log('[EXPLAIN] Checking for peak summaries in response:', {
          hasPeakSummaries: !!result.peakSummaries,
          isArray: Array.isArray(result.peakSummaries),
          count: result.peakSummaries?.length || 0,
          peakSummariesCount: result.peakSummariesCount,
          peakSummaries: result.peakSummaries,
          responseKeys: Object.keys(result),
        });
        
        if (result.peakSummaries && Array.isArray(result.peakSummaries) && result.peakSummaries.length > 0) {
          console.log('[EXPLAIN] ✅ Found peak summaries in response, setting state:', result.peakSummaries.length);
          console.log('[EXPLAIN] Peak summaries data:', JSON.stringify(result.peakSummaries, null, 2));
          setPeakSummaries(result.peakSummaries);
          console.log('[EXPLAIN] ✅ Peak summaries state set, count:', result.peakSummaries.length);
        } else {
          console.log('[EXPLAIN] ⚠️ No peak summaries in API response');
          console.log('[EXPLAIN] peakSummaries value:', result.peakSummaries);
          console.log('[EXPLAIN] peakSummariesCount value:', result.peakSummariesCount);
          console.log('[EXPLAIN] Will try to extract from explanation text instead');
          setPeakSummaries([]);
        }
        
        // Also check if explanation contains summaries that we can extract
        if (result.explanation && result.explanation.includes('SUMMARIES')) {
          console.log('[EXPLAIN] ✅ Explanation contains SUMMARIES keyword, will parse');
        }
        console.log('[EXPLAIN] ========== END PEAK SUMMARIES CHECK ==========');
        if (result.cached) {
          console.log('[EXPLAIN] ✅ Explanation loaded from cache');
        } else {
          console.log('[EXPLAIN] ✅ Explanation generated successfully');
        }
      } else {
        console.error('[EXPLAIN] API returned success=false:', result.error);
        console.error('[EXPLAIN] Error details:', result.details);
        // Show more detailed error message if available
        const errorMessage = result.error || 'Failed to generate explanation';
        const errorDetails = result.details ? `\n\nDetails: ${result.details}` : '';
        setError(errorMessage + errorDetails);
        setPeakSummaries([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error while generating explanation';
      setError(errorMessage);
      console.error('Error generating explanation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate explanation when dialog opens with regenerateOnOpen flag
  useEffect(() => {
    if (open && regenerateOnOpen && (trendData || chartData)) {
      // Small delay to ensure dialog is fully open
      const timer = setTimeout(() => {
        console.log('[EXPLAIN] Auto-regenerating explanation on dialog open (Generate AI Analysis)');
        generateExplanation(true);
        setHasGenerated(true); // Mark as generated to prevent duplicate calls
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open, regenerateOnOpen, trendData, chartData]);

  // Auto-generate explanation when dialog opens (normal flow)
  useEffect(() => {
    if (open && !regenerateOnOpen && !hasGenerated && chartData && !isLoading && !explanation) {
      console.log('[EXPLAIN] Auto-generating explanation on dialog open');
      generateExplanation(false);
      setHasGenerated(true);
    }
  }, [open, regenerateOnOpen, chartData, hasGenerated, isLoading, explanation]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      // Reset state when dialog closes
      setExplanation('');
      setError('');
      setIsLoading(false);
      setPeakSummaries([]);
      setHasGenerated(false);
      setChartData(null);
    }
  };

  // Parse explanation to extract summaries section and main content
  const parseExplanation = (text: string) => {
    if (!text) return { mainContent: '', summaries: [] };
    
    console.log('[EXPLAIN] Parsing explanation, length:', text.length);
    console.log('[EXPLAIN] Explanation preview:', text.substring(0, 500));
    
    // Try multiple patterns to find summaries
    let summariesMatch = text.match(/##\s*SUMMARIES\s*\n\n([\s\S]*)$/i);
    if (!summariesMatch) {
      summariesMatch = text.match(/##\s*SUMMARIES\s*([\s\S]*)$/i);
    }
    if (!summariesMatch) {
      summariesMatch = text.match(/SUMMARIES\s*\n\n([\s\S]*)$/i);
    }
    if (!summariesMatch) {
      // Try to find numbered list at the end that might be summaries
      const lines = text.split('\n');
      const numberedLines = lines.filter((line, idx) => {
        const trimmed = line.trim();
        return trimmed.match(/^\d+\./) && idx > lines.length - 10; // Last 10 lines
      });
      if (numberedLines.length >= 2) {
        summariesMatch = [null, numberedLines.join('\n')];
      }
    }
    
    if (summariesMatch) {
      const mainContent = text.replace(/##?\s*SUMMARIES\s*\n?\n?[\s\S]*$/i, '').trim();
      const summariesText = summariesMatch[1].trim();
      
      console.log('[EXPLAIN] ✅ Found summaries section:', summariesText.substring(0, 300));
      
      // Parse summaries from the text - try multiple formats
      const summaries = summariesText.split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed.match(/^\d+\./) || trimmed.match(/^[-*•]/) || (trimmed.length > 15 && trimmed.match(/\d{4}/));
        })
        .map(line => {
          const trimmed = line.trim();
          // Format: "1. Date (Value: 100): summary"
          let match = trimmed.match(/^\d+\.\s*(.+?)\s*\(Value:\s*(\d+)\):\s*(.+)$/);
          if (match) {
            return {
              date: match[1].trim(),
              value: parseInt(match[2]),
              summary: match[3].trim(),
            };
          }
          // Format: "1. Date: summary"
          match = trimmed.match(/^\d+\.\s*(.+?):\s*(.+)$/);
          if (match) {
            return {
              date: match[1].trim(),
              value: 0,
              summary: match[2].trim(),
            };
          }
          // Format: "1. Date summary" (no colon)
          match = trimmed.match(/^\d+\.\s*(.+?)\s+(.+)$/);
          if (match && match[1].match(/\d{4}/)) {
            return {
              date: match[1].trim(),
              value: 0,
              summary: match[2].trim(),
            };
          }
          // Format: "- Date - summary" or "* Date - summary"
          match = trimmed.match(/^[-*•]\s*(.+?)\s*[-–]\s*(.+)$/);
          if (match) {
            return {
              date: match[1].trim(),
              value: 0,
              summary: match[2].trim(),
            };
          }
          // Extract date from line if it contains a date pattern
          const dateMatch = trimmed.match(/(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/);
          if (dateMatch && trimmed.length > 20) {
            const dateStr = dateMatch[1];
            const summaryText = trimmed.replace(/^\d+\.\s*/, '').replace(dateStr, '').trim().replace(/^[-–:]\s*/, '');
            return {
              date: dateStr,
              value: 0,
              summary: summaryText || trimmed,
            };
          }
          // Just use the line as summary if it's substantial
          if (trimmed.length > 15) {
            return {
              date: '',
              value: 0,
              summary: trimmed.replace(/^\d+\.\s*/, '').replace(/^[-*•]\s*/, ''),
            };
          }
          return null;
        })
        .filter((s): s is { date: string; value: number; summary: string } => s !== null && s.summary.length > 0);
      
      console.log('[EXPLAIN] ✅ Parsed summaries:', summaries.length, summaries);
      return { mainContent, summaries };
    }
    
    console.log('[EXPLAIN] ❌ No summaries section found in explanation');
    return { mainContent: text, summaries: [] };
  };

  const { mainContent, summaries: parsedSummaries } = parseExplanation(explanation);
  const displaySummaries = peakSummaries.length > 0 ? peakSummaries : parsedSummaries;
  
  console.log('[EXPLAIN] Display summaries:', {
    peakSummariesCount: peakSummaries.length,
    parsedSummariesCount: parsedSummaries.length,
    displaySummariesCount: displaySummaries.length,
    peakSummaries: peakSummaries.slice(0, 3), // Show first 3 for debugging
    parsedSummaries: parsedSummaries.slice(0, 3), // Show first 3 for debugging
    displaySummaries: displaySummaries.slice(0, 3), // Show first 3 for debugging
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-blue-500" />
            Trend Explanation: {keywords.join(' vs ')}
          </DialogTitle>
          <DialogDescription className="text-base">
            AI-powered analysis of search trends with historical context
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 bg-white">
          {/* Chart at the top - always show if we have keywords */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Trend Chart</h3>
            <div className="h-[300px]">
              <GoogleTrendsChartRedis 
                keywords={keywords} 
                onDataLoad={(data) => {
                  console.log('[EXPLAIN] Chart data loaded:', !!data);
                  setChartData(data);
                  // Use the chart data for explanation generation
                  if (data && !trendData) {
                    // Store for later use
                  }
                }}
                isWideLayout={true}
                peakSummaries={displaySummaries}
              />
            </div>
          </div>

          {/* Show loading state while generating explanation */}
          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-muted-foreground">
                Analyzing trend data and generating explanation...
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <Button 
                  onClick={() => generateExplanation(false)} 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
                    </div>
                  )}

          {explanation && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">AI Analysis</h3>
                  {!hideRegenerate && (
                    <Button 
                      onClick={() => generateExplanation(true)} 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                  )}
                </div>
                <div className="prose prose-lg max-w-none text-gray-700">
                  {mainContent.split('\n').map((paragraph, index) => {
                    let trimmed = paragraph.trim();
                    if (!trimmed) return null;
                    
                    // Remove all markdown header syntax (####, ###, etc.) from anywhere in the text
                    // Handle both with and without spaces: "#### " or "####"
                    trimmed = trimmed.replace(/^#{1,6}\s*/g, '').replace(/#{1,6}\s*/g, '');
                    
                    // Handle markdown headers - convert to nice title (after removing ####)
                    // Check if it was originally a header by looking for common header patterns
                    const originalParagraph = paragraph.trim();
                    if (originalParagraph.match(/^#{1,6}\s*/)) {
                      const level = originalParagraph.match(/^(#{1,6})/)?.[1].length || 1;
                      let text = trimmed;
                      // Clean up bold markers in headers
                      text = text.replace(/\*\*/g, '');
                      const HeadingTag = `h${Math.min(level + 1, 6)}` as keyof JSX.IntrinsicElements;
                      return (
                        <HeadingTag 
                          key={index} 
                          className={`font-bold text-gray-900 mt-8 mb-4 ${
                            level === 1 ? 'text-2xl border-b-2 border-gray-200 pb-2' : 
                            level === 2 ? 'text-xl border-b border-gray-200 pb-2' : 
                            level === 3 ? 'text-lg' : 'text-base'
                          }`}
                        >
                          {text}
                        </HeadingTag>
                      );
                    }
                    // Handle bold-only lines (like "**Sources**") - convert to nice section header
                    if (trimmed.match(/^\*\*[^*]+\*\*$/) && !trimmed.includes(':')) {
                      const text = trimmed.replace(/\*\*/g, '');
                      return (
                        <h3 
                          key={index} 
                          className="text-lg font-bold text-gray-900 mt-6 mb-3 border-b border-gray-200 pb-2"
                        >
                          {text}
                        </h3>
                      );
                    }
                    // Handle bullet points
                    if (trimmed.match(/^[\*\-\+]\s+/)) {
                      let text = trimmed.replace(/^[\*\-\+]\s+/, '');
                      // Clean up bold markers
                      text = text.replace(/\*\*/g, '');
                      return (
                        <div key={index} className="flex items-start gap-3 mb-3 ml-2">
                          <span className="text-blue-500 mt-2 text-lg">•</span>
                          <span className="flex-1 leading-relaxed">{text}</span>
                        </div>
                      );
                    }
                    // Handle bold text within paragraphs
                    if (trimmed.match(/\*\*.*\*\*/)) {
                      const parts = trimmed.split(/(\*\*.*?\*\*)/g);
                      return (
                        <p key={index} className="mb-4 last:mb-0 leading-relaxed">
                          {parts.map((part, i) => {
                            // Remove markdown headers from each part
                            const cleanedPart = part.replace(/^#{1,6}\s*/g, '').replace(/#{1,6}\s*/g, '');
                            return cleanedPart.match(/\*\*(.*?)\*\*/) ? (
                              <strong key={i} className="font-semibold text-gray-900">
                                {cleanedPart.replace(/\*\*/g, '')}
                              </strong>
                            ) : (
                              <span key={i}>{cleanedPart}</span>
                            );
                          })}
                        </p>
                      );
                    }
                    // Regular paragraphs - ensure no markdown headers remain anywhere
                    const cleanedText = trimmed.replace(/^#{1,6}\s*/g, '').replace(/#{1,6}\s*/g, '');
                    return (
                      <p key={index} className="mb-4 last:mb-0 leading-relaxed">
                        {cleanedText}
                      </p>
                    );
                  })}
                </div>
              </div>
              
              {/* Summaries Section - Always show if we have summaries or explanation */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Summaries
                </h3>
                {displaySummaries.length > 0 ? (
                  <>
                    <div className="space-y-3 mb-6">
                      {displaySummaries.map((peak, index) => {
                        let peakDate = peak.date;
                        if (peak.date && !peak.date.includes(',')) {
                          try {
                            const dateObj = new Date(peak.date);
                            if (!isNaN(dateObj.getTime())) {
                              peakDate = dateObj.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              });
                            }
                          } catch (e) {
                            // Keep original date if parsing fails
                          }
                        }
                        return (
                          <div 
                            key={`peak-${peak.date || index}-${index}`}
                            className="flex items-start gap-4 p-4 bg-white rounded-lg border border-purple-100 shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="flex-shrink-0 w-3 h-3 rounded-full bg-purple-500 mt-1.5"></div>
                            <div className="flex-1 min-w-0">
                              {peakDate && (
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-sm font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded">
                                    {peakDate}
                                  </span>
                                  {peak.value > 0 && (
                                    <span className="text-xs font-semibold text-purple-600 bg-gray-100 px-2 py-1 rounded">
                                      Value: {peak.value}
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className="text-base text-gray-800 font-medium leading-relaxed">
                                {peak.summary}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Second chart with peak annotations */}
                    {keywords.length === 1 && displaySummaries.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-purple-200">
                        <h4 className="text-lg font-semibold text-purple-900 mb-3">Chart with Peak Annotations</h4>
                        <div className="h-[300px]">
                          <GoogleTrendsChartRedis 
                            keywords={keywords} 
                            onDataLoad={() => {}}
                            isWideLayout={true}
                            peakSummaries={displaySummaries}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-sm">No summaries available yet. Summaries will appear here once the explanation is generated.</p>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-500 text-center pt-4 border-t border-gray-200">
                Generated by Gemini AI • Analysis based on Google Trends data and historical events
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}