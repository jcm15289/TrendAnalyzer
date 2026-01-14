'use client';

import React from 'react';

interface GoogleTrendsChartProps {
  keywords: string[];
}

const GoogleTrendsChartSimple: React.FC<GoogleTrendsChartProps> = ({ keywords }) => {
  return (
    <div className="h-[300px] w-full bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg border-2 border-dashed border-blue-200 flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Google Trends Chart</h3>
        <p className="text-sm text-gray-600 mb-4">
          Keywords: <span className="font-medium">{keywords.join(', ')}</span>
        </p>
        <div className="text-xs text-gray-500">
          Chart would display trend data here
        </div>
      </div>
    </div>
  );
};

export default GoogleTrendsChartSimple;
