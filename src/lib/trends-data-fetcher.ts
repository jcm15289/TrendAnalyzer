// Real Google Trends API implementation
// Based on the original Python script that fetches actual Google Trends data
export const fetchFreshTrendsData = async (keywords: string[]) => {
  try {
    console.log(`Fetching real Google Trends data for: ${keywords.join(', ')}`);
    
    // Step 1: Build payload for token request
    const tokenPayload = {
      hl: 'en-US',
      tz: '0',
      req: JSON.stringify({
        comparisonItem: keywords.map(keyword => ({
          keyword: keyword,
          time: 'today 5-y',
          geo: ''
        })),
        category: 0,
        property: ''
      })
    };
    
    // Step 2: Get cookies and fetch token
    const tokenUrl = 'https://trends.google.com/trends/api/explore';
    const tokenParams = new URLSearchParams(tokenPayload);
    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://trends.google.com/',
        'Origin': 'https://trends.google.com'
      },
      // Add timeout and retry logic
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
    }
    
    const tokenText = await tokenResponse.text();
    const tokenData = JSON.parse(tokenText.substring(4)); // Remove ')]}\n' prefix
    
    // Extract token and request data
    const widgets = tokenData.widgets;
    let timeseriesToken = null;
    let timeseriesRequest = null;
    
    for (const widget of widgets) {
      if (widget.id === 'TIMESERIES') {
        timeseriesToken = widget.token;
        timeseriesRequest = widget.request;
        break;
      }
    }
    
    if (!timeseriesToken || !timeseriesRequest) {
      throw new Error('Could not extract timeseries token from Google Trends API');
    }
    
    // Step 3: Fetch actual trends data
    const trendsUrl = 'https://trends.google.com/trends/api/widgetdata/multiline';
    const trendsParams = new URLSearchParams({
      hl: 'en-US',
      tz: '0',
      req: JSON.stringify(timeseriesRequest),
      token: timeseriesToken,
      tz: '0'
    });
    
    const trendsResponse = await fetch(`${trendsUrl}?${trendsParams}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://trends.google.com/',
        'Origin': 'https://trends.google.com'
      },
      // Add timeout
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    if (!trendsResponse.ok) {
      throw new Error(`Trends data request failed: ${trendsResponse.status} ${trendsResponse.statusText}`);
    }
    
    const trendsText = await trendsResponse.text();
    const trendsData = JSON.parse(trendsText.substring(5)); // Remove ')]}\n' prefix
    
    // Step 4: Convert to our format
    const data = [];
    const timelineData = trendsData.default?.timelineData || [];
    
    for (const entry of timelineData) {
      const timestamp = parseInt(entry.time);
      const date = new Date(timestamp * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const row: any = { date: dateStr };
      
      // Add each keyword's value
      keywords.forEach((keyword, index) => {
        const value = entry.value?.[index] || 0;
        row[keyword] = parseInt(value);
      });
      
      data.push(row);
    }
    
    // Sort by date
    data.sort((a, b) => a.date.localeCompare(b.date));
    
    const result = {
      success: true,
      data: data,
      keywords: keywords,
      note: `Real data fetched from Google Trends API - Generated at ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString(),
      fetchId: `real_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    console.log(`Successfully fetched real Google Trends data: ${data.length} data points`);
    return result;
    
  } catch (error) {
    console.error('Error fetching real Google Trends data:', error);
    
    let errorMessage = 'Failed to fetch real Google Trends data';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Google Trends API request timed out. Please try again.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network error connecting to Google Trends API. This may be due to CORS restrictions in the serverless environment.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Invalid response from Google Trends API. The API may have changed or blocked the request.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return {
      success: false,
      error: errorMessage,
      data: [],
      keywords: keywords,
      timestamp: new Date().toISOString(),
      note: 'Google Trends API integration may require server-side proxy or different approach for serverless deployment'
    };
  }
};

