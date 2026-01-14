'use client';

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GoogleTrendsChartProps {
  keywords: string[];
}

interface TrendData {
  date: string;
  [key: string]: string | number;
}

const GoogleTrendsChartReal: React.FC<GoogleTrendsChartProps> = ({ keywords }) => {
  const [data, setData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Combine trend data from multiple keywords
  const combineTrendData = (results: { keyword: string; data: any[] }[]): TrendData[] => {
    if (results.length === 0) return [];
    
    // Create a map to store all unique dates
    const dateMap = new Map<string, TrendData>();
    
    // Process each keyword's data
    results.forEach(({ keyword, data }) => {
      data.forEach((item: any) => {
        const dateKey = item.date;
        
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { 
            date: new Date(dateKey).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          });
        }
        
        // Add this keyword's value to the date entry
        const entry = dateMap.get(dateKey)!;
        entry[keyword] = item[keyword] || 0;
      });
    });
    
    // Convert map to array and sort by date
    return Array.from(dateMap.values()).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  };


  useEffect(() => {
    const fetchTrendData = async (retryCount = 0) => {
      setLoading(true);
      setError(null);
      
      try {
        // For comparison queries, fetch each keyword separately
        const fetchPromises = keywords.map(async (keyword) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          const response = await fetch(`/api/trends?keywords=${encodeURIComponent(keyword)}&t=${Date.now()}`, {
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`API request failed for ${keyword}: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (!result.success) {
            throw new Error(`Failed to fetch trend data for ${keyword}: ${result.error}`);
          }
          
          return { keyword, data: result.data };
        });
        
        // Wait for all API calls to complete
        const results = await Promise.all(fetchPromises);
        
        // Combine the data from all keywords
        const combinedData = combineTrendData(results);
        
        setData(combinedData);
      } catch (err) {
        console.error('Error fetching trend data:', err);
        
        let errorMessage = 'Failed to load trend data';
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            errorMessage = 'Request timed out - Google Trends API is taking longer than expected';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);

            // Retry logic for network errors
            if (retryCount < 2 && (err instanceof Error && (err.name === 'TypeError' || err.message.includes('Failed to fetch')))) {
              console.log(`Retrying API call (attempt ${retryCount + 1}/3)...`);
              setTimeout(() => fetchTrendData(retryCount + 1), 2000 * (retryCount + 1)); // Exponential backoff
              return;
            }

            // No fallback - only show real data from API or cache
      } finally {
        if (retryCount === 0) { // Only set loading to false on final attempt
          setLoading(false);
        }
      }
    };

    fetchTrendData();
  }, [keywords]);

  if (loading) {
    return (
      <div className="h-[300px] w-full bg-gray-50 rounded-lg border flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading trend data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] w-full bg-red-50 rounded-lg border border-red-200 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p>❌ {error}</p>
        </div>
      </div>
    );
  }

  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

  return (
    <div className="h-[300px] w-full">
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">
            Search Interest Over Time
          </h4>
        </div>
        <p className="text-xs text-gray-500">
          Keywords: {keywords.join(', ')}
        </p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            fontSize={12}
          />
          <YAxis 
            stroke="#666"
            fontSize={12}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #ccc',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Legend />
          {keywords.map((keyword, index) => (
            <Line
              key={keyword}
              type="monotone"
              dataKey={keyword}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={false}
              activeDot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GoogleTrendsChartReal;
