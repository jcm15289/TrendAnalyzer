type TimelinePoint = {
  time?: string | number | null;
  formattedTime?: string | null;
  formattedAxisTime?: string | null;
  value?: Array<number | string> | number | string | null;
  hasData?: boolean[];
  partial?: boolean;
  isPartial?: boolean;
};

export type PreparedTrendExplanation = {
  prompt: string;
  sanitisedTimeline: SanitisedPoint[];
  summaryLines: string;
  significantPoints: Array<{
    index: number;
    averageValue: number;
    formattedTime: string | null;
    values: number[];
  }>;
  timelineEntries: Array<Record<string, unknown>>;
  startDate: string | number | null;
  endDate: string | number | null;
  totals: number[];
  averages: number[];
  maxima: number[];
  firstValues: number[];
  lastValues: number[];
};

export type SanitisedPoint = {
  index: number;
  time: string | number | null;
  formattedTime: string | null;
  formattedAxisTime: string | null;
  values: number[];
  hasData?: boolean[];
  isPartial?: boolean;
};

const normaliseNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const averageOfValues = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const resolveDateString = (point: SanitisedPoint): string | number | null => {
  if (point.formattedTime) return point.formattedTime;
  if (point.formattedAxisTime) return point.formattedAxisTime;
  if (typeof point.time === 'string' || typeof point.time === 'number') {
    return point.time;
  }
  return null;
};

export function buildTrendExplanationPrompt(
  keywords: string[],
  trendData: { timelineData?: TimelinePoint[] },
): PreparedTrendExplanation {
  console.log('[GEMINI] prompt-builder: starting', {
    keywordCount: keywords.length,
    timelinePoints: trendData?.timelineData?.length ?? 0,
  });

  const rawTimeline = Array.isArray(trendData?.timelineData) ? trendData.timelineData : [];

  const sanitisedTimeline: SanitisedPoint[] = rawTimeline.map((point, index) => {
    const valuesArray = Array.isArray(point?.value)
      ? point.value.map((val) => normaliseNumber(val))
      : [normaliseNumber(point?.value)];

    return {
      index,
      time: point?.time ?? null,
      formattedTime: point?.formattedTime ?? null,
      formattedAxisTime: point?.formattedAxisTime ?? null,
      values: valuesArray,
      hasData: Array.isArray(point?.hasData) ? point?.hasData : undefined,
      isPartial: point?.partial || point?.isPartial || false,
    };
  });

  const totals = new Array(keywords.length).fill(0);
  const maxima = new Array(keywords.length).fill(0);
  const lastValues = new Array(keywords.length).fill(0);
  const firstValues = new Array(keywords.length).fill(0);

  sanitisedTimeline.forEach((point, index) => {
    point.values.forEach((value, valueIndex) => {
      totals[valueIndex] = (totals[valueIndex] || 0) + value;
      maxima[valueIndex] = Math.max(maxima[valueIndex] || 0, value);
      if (index === 0) {
        firstValues[valueIndex] = value;
      }
      if (index === sanitisedTimeline.length - 1) {
        lastValues[valueIndex] = value;
      }
    });
  });

  const averages = sanitisedTimeline.length
    ? totals.map((total) => total / sanitisedTimeline.length)
    : totals.map(() => 0);

  const summaryLines = keywords
    .map((keyword, idx) => {
      const total = totals[idx] ?? 0;
      const avg = averages[idx] ?? 0;
      const max = maxima[idx] ?? 0;
      const start = firstValues[idx] ?? 0;
      const end = lastValues[idx] ?? 0;
      return `${keyword}: total=${total.toFixed(2)}, avg=${avg.toFixed(
        2,
      )}, max=${max.toFixed(2)}, start=${start.toFixed(2)}, end=${end.toFixed(2)}`;
    })
    .join('\n');

  const significantPoints = sanitisedTimeline
    .map((point, index, array) => {
      const averageValue = averageOfValues(point.values);
      const resolvedDate = resolveDateString(point);

      if (!resolvedDate) {
        return null;
      }

      return {
        index,
        formattedTime: typeof resolvedDate === 'string' ? resolvedDate : String(resolvedDate),
        averageValue,
        values: point.values,
      };
    })
    .filter((point, index, array) => {
      if (!point) return false;
      if (index === 0 || index === array.length - 1) return true;

      const previousAverage = array[index - 1]?.averageValue ?? 0;
      const nextAverage = array[index + 1]?.averageValue ?? 0;

      const diffPrev = Math.abs(point.averageValue - previousAverage) / Math.max(previousAverage, 1);
      const diffNext = Math.abs(point.averageValue - nextAverage) / Math.max(nextAverage, 1);

      const hasChange = diffPrev > 0.2 || diffNext > 0.2;

      return hasChange && point.formattedTime !== null;
    })
    .filter((point): point is { index: number; formattedTime: string; averageValue: number; values: number[] } => {
      return point !== null && point.formattedTime !== null;
    });

  const startDate = sanitisedTimeline.length ? resolveDateString(sanitisedTimeline[0]) : null;
  const endDate = sanitisedTimeline.length ? resolveDateString(sanitisedTimeline[sanitisedTimeline.length - 1]) : null;

  const timelineEntries = sanitisedTimeline
    .map((point) => {
      const resolvedDate = resolveDateString(point);
      if (!resolvedDate) {
        console.log('[GEMINI] prompt-builder: skipping timeline point with no resolved date', {
          index: point.index,
          time: point.time,
          formattedTime: point.formattedTime,
          formattedAxisTime: point.formattedAxisTime,
        });
        return null;
      }

      const entry: Record<string, unknown> = {
        index: point.index,
        date: resolvedDate,
      };

      keywords.forEach((keyword, idx) => {
        entry[keyword] = point.values[idx] ?? 0;
      });

      if (point.isPartial) {
        entry.isPartial = true;
      }

      return entry;
    })
    .filter((entry): entry is Record<string, unknown> => entry !== null);

  const prompt = `You are an investigative analyst specialising in geopolitical search trends.
The user is exploring Google Trends data for the keywords: ${keywords.join(' vs ')}.

Date range: ${startDate ?? 'unknown'} → ${endDate ?? 'unknown'}
Total data points: ${sanitisedTimeline.length}
Keyword summaries (totals, averages, maximum values, beginning and ending values):
${summaryLines}

Significant inflection points (average across all keywords at each step):
${JSON.stringify(significantPoints, null, 2)}

Complete keyword timeline (chronological order). "date" uses the formatted time when available. Each entry lists the value for every keyword:
${JSON.stringify(timelineEntries, null, 2)}

Original Google Trends payload (as received by the front-end):
${JSON.stringify(trendData, null, 2)}

CRITICAL: You MUST use Google Search grounding NOW to find recent news and information about these keywords. Do not say "I will search" - actually execute the search immediately and include the results in your analysis. Search for:
- Recent news articles about: ${keywords.join(', ')}
- Events that occurred during the date range that relate to these keywords
- Breaking news or developments that explain spikes or drops in the trend data
- Current context and recent developments related to these keywords

After searching, provide a complete analysis that includes:
1. A concise overview of the long-term trajectory for each keyword.

2. PEAK EXPLANATIONS - For ONLY the peaks where you found a SPECIFIC themed event (political, social, etc.) in the Search Results, provide a section in this EXACT format:
   
   ### PEAK: [YYYY-MM-DD]
   EVENT: [One concise sentence describing the specific event that caused this peak, DIRECTLY FROM Search Results]
   SOURCE: [News outlet and headline from Search Results - MUST be from actual search results]
   
   Example:
   ### PEAK: 2021-10-30
   EVENT: Curtis Sliwa campaigned intensively in final days before NYC mayoral election against Eric Adams
   SOURCE: NY Times - "Sliwa Makes Final Push in Long-Shot Mayoral Bid"
   
   CRITICAL RULES for EVENT line:
   - MUST be DIRECTLY from Search Results - do not infer or guess
   - ONLY include if you found a SPECIFIC political/social/geopolitical event in Search Results
   - NEVER write "No specific event found" or "search volume" or "general news" - just SKIP that peak entirely
   - NEVER include peaks with generic language like "rise in interest", "search volume", "unclear", "not found"
   - Must be action-focused: elections, announcements, incidents, debates, campaigns, protests, crises, legislation, court rulings, conflicts, treaties, controversies
   - Must be based on ACTUAL news article from Search Results - cite the source
   - Maximum 10-12 words
   - The SOURCE line MUST reference an actual article you found in Search Results
   
   If you cannot find a specific themed event for a peak in the Search Results, DO NOT create a PEAK section for it.
   
3. Historical context and geopolitical developments from Search Results.

4. A short conclusion referencing the Search Results.

IMPORTANT: Execute the search NOW using Google Search grounding. Then provide your complete analysis with the structured PEAK sections above. Each peak MUST reference a specific event DIRECTLY from the Search Results, not generic "increased interest" language. Use the actual search results to find real news events that explain each peak.`;

  console.log('[GEMINI] prompt-builder: completed', {
    promptChars: prompt.length,
    promptLines: prompt.split('\n').length,
    timelineEntriesCount: timelineEntries.length,
    timelineSample: timelineEntries.slice(0, 2),
    significantPointsCount: significantPoints.length,
    significantSample: significantPoints.slice(0, 2),
    startDate,
    endDate,
  });

  return {
    prompt,
    sanitisedTimeline,
    summaryLines,
    significantPoints,
    timelineEntries,
    startDate,
    endDate,
    totals,
    averages,
    maxima,
    firstValues,
    lastValues,
  };
}


