'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useId } from 'react';

interface GoogleTrendsChartProps {
  keywords: string[];
}

const GoogleTrendsChart: React.FC<GoogleTrendsChartProps> = ({ keywords }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const container = containerRef.current;

    const renderChart = () => {
      if (typeof window.trends !== 'undefined' && window.trends.embed) {
        setIsLoading(false);
        if (container) {
          container.innerHTML = '';
          try {
            window.trends.embed.renderExploreWidget(
              'TIMESERIES',
              {
                comparisonItem: keywords.map((kw) => ({
                  keyword: kw,
                  geo: '',
                  time: 'today 5-y',
                })),
                category: 0,
                property: '',
              },
              {
                exploreQuery: `q=${encodeURIComponent(keywords.join(','))}&date=today 5-y`,
                guestPath: 'https://trends.google.com:443/trends/embed/',
              }
            );
          } catch (error) {
            console.error('Error rendering Google Trends widget:', error);
          }
        }
        if (intervalId) clearInterval(intervalId);
      }
    };
    
    // Set a timeout to avoid infinite loop if the script fails to load
    const loadTimeout = setTimeout(() => {
        if(isLoading) {
            setIsLoading(false); // Stop loading to show an error or empty state
            console.error("Google Trends script failed to load in time.");
        }
        if (intervalId) clearInterval(intervalId);
    }, 5000);


    if (typeof window !== 'undefined') {
      intervalId = setInterval(renderChart, 100);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (loadTimeout) clearTimeout(loadTimeout);
      if (container) {
        // Simple cleanup. The script itself might not offer a destroy method.
        container.innerHTML = '';
      }
    };
  }, [keywords]);

  return (
    <div className="relative h-96 w-full animate-fade-in">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/50">
          <Skeleton className="h-full w-full" />
        </div>
      )}
      <div id={`google-trends-${uniqueId}`} ref={containerRef} className="h-full w-full" />
    </div>
  );
};

export default GoogleTrendsChart;
