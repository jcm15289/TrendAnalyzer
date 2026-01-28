/**
 * IntelPeak metric calculation
 * 
 * Measures the importance of the most recent peak by:
 * 1. Finding the last relevant peak (within 2 months)
 * 2. Measuring the duration of that peak
 * 3. Calculating the area under the curve for the peak period
 * 4. Calculating the area under the curve for the same duration before the peak
 * 5. Comparing them to determine importance
 */

export interface IntelPeakResult {
  intelPeak: number | null;
  peakDate: Date | null;
  peakDuration: number; // in days
  peakArea: number;
  baselineArea: number;
  ratio: number | null;
  peakStartDate: Date | null;
  peakEndDate: Date | null;
  baselineStartDate: Date | null;
  baselineEndDate: Date | null;
  higherPeaksCount?: number; // Number of higher peaks found in the past
}

interface DataPoint {
  date: Date;
  value: number;
}

/**
 * Calculate the area under the curve using trapezoidal rule
 */
function calculateArea(points: DataPoint[]): number {
  if (points.length < 2) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const timeDiff = (points[i + 1].date.getTime() - points[i].date.getTime()) / (1000 * 60 * 60 * 24); // days
    const avgValue = (points[i].value + points[i + 1].value) / 2;
    area += avgValue * timeDiff;
  }
  return area;
}

/**
 * Detect peaks in the data using a simple threshold-based approach
 * Also detects sustained high periods (plateaus) as peaks
 */
function detectPeaks(data: DataPoint[], threshold: number = 10): Array<{ date: Date; value: number; index: number }> {
  const peaks: Array<{ date: Date; value: number; index: number }> = [];
  
  // First, detect sharp peaks (local maxima)
  for (let i = 1; i < data.length - 1; i++) {
    const prevValue = data[i - 1].value;
    const currValue = data[i].value;
    const nextValue = data[i + 1].value;
    
    // A peak is a local maximum above threshold
    if (currValue >= threshold && currValue > prevValue && currValue > nextValue) {
      peaks.push({
        date: data[i].date,
        value: currValue,
        index: i,
      });
    }
  }
  
  // Also detect sustained high periods (plateaus) - periods where values stay high
  // Look for sequences of 3+ consecutive points above threshold
  // Use a slightly lower threshold for plateaus to catch more sustained periods
  const plateauThreshold = Math.max(threshold * 0.8, 8); // 80% of threshold or minimum 8
  let plateauStart: number | null = null;
  let plateauMaxValue = 0;
  let plateauMaxIndex = -1;
  
  for (let i = 0; i < data.length; i++) {
    const currValue = data[i].value;
    
    if (currValue >= plateauThreshold) {
      if (plateauStart === null) {
        plateauStart = i;
        plateauMaxValue = currValue;
        plateauMaxIndex = i;
      } else {
        // Continue plateau
        if (currValue > plateauMaxValue) {
          plateauMaxValue = currValue;
          plateauMaxIndex = i;
        }
      }
    } else {
      // End of plateau
      if (plateauStart !== null && i - plateauStart >= 3) {
        // Found a sustained high period (3+ days)
        // Use the point with maximum value in the plateau
        const existingPeak = peaks.find(p => p.index === plateauMaxIndex);
        if (!existingPeak) {
          peaks.push({
            date: data[plateauMaxIndex].date,
            value: plateauMaxValue,
            index: plateauMaxIndex,
          });
        }
      }
      plateauStart = null;
      plateauMaxValue = 0;
      plateauMaxIndex = -1;
    }
  }
  
  // Check if we ended with a plateau
  if (plateauStart !== null && data.length - plateauStart >= 3) {
    const existingPeak = peaks.find(p => p.index === plateauMaxIndex);
    if (!existingPeak) {
      peaks.push({
        date: data[plateauMaxIndex].date,
        value: plateauMaxValue,
        index: plateauMaxIndex,
      });
    }
  }
  
  // Sort by index to maintain chronological order
  peaks.sort((a, b) => a.index - b.index);
  
  // Log detected peaks for debugging
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  console.log('[IntelPeak] detectPeaks result', {
    totalPeaks: peaks.length,
    threshold,
    plateauThreshold,
    last5Peaks: peaks.slice(-5).map(p => ({ date: p.date.toISOString(), value: p.value, index: p.index })),
    peaksInLast6Months: peaks.filter(p => p.date >= sixMonthsAgo).map(p => ({ date: p.date.toISOString(), value: p.value, index: p.index })),
  });
  
  return peaks;
}

/**
 * Find the duration of a peak by detecting when it starts and ends
 * A peak starts when values rise above baseline and ends when they return to baseline
 * Improved to detect when peak actually ends (values drop), not just extend to chart end
 */
function findPeakDuration(
  data: DataPoint[],
  peakIndex: number,
  baselineThreshold: number = 0.4 // Peak ends when value drops to 40% of peak value
): { startIndex: number; endIndex: number; durationDays: number } {
  const peakValue = data[peakIndex].value;
  const threshold = peakValue * baselineThreshold;
  
  // Find start: go backwards until value drops below threshold or we hit a local minimum
  let startIndex = peakIndex;
  for (let i = peakIndex - 1; i >= 0; i--) {
    // Stop if value drops significantly below threshold
    if (data[i].value < threshold) {
      startIndex = i + 1;
      break;
    }
    // Also check if we hit a local minimum (value lower than neighbors)
    if (i > 0 && i < data.length - 1) {
      if (data[i].value < data[i - 1].value && data[i].value < data[i + 1].value && data[i].value < threshold * 1.2) {
        startIndex = i + 1;
        break;
      }
    }
    startIndex = i;
  }
  
  // Find end: go forwards until value drops below threshold or we hit a sustained decline
  let endIndex = peakIndex;
  let consecutiveLow = 0;
  const maxConsecutiveLow = 2; // Allow 2 consecutive low values before ending
  
  for (let i = peakIndex + 1; i < data.length; i++) {
    const currentValue = data[i].value;
    
    // If value drops below threshold, count it
    if (currentValue < threshold) {
      consecutiveLow++;
      // If we have enough consecutive low values, end the peak
      if (consecutiveLow >= maxConsecutiveLow) {
        endIndex = i - maxConsecutiveLow; // End before the low values
        break;
      }
    } else {
      // Reset counter if value goes back up
      consecutiveLow = 0;
    }
    
    // Also check if we hit a local minimum that's significantly lower
    if (i > 0 && i < data.length - 1) {
      const isLocalMin = currentValue < data[i - 1].value && currentValue < data[i + 1].value;
      if (isLocalMin && currentValue < threshold * 1.2) {
        endIndex = i - 1;
        break;
      }
    }
    
    // Update end index as we go, but don't extend past significant drops
    // Also, if we hit a zero value after a high peak, end immediately (sparse peak)
    if (currentValue >= threshold) {
      endIndex = i;
    } else if (currentValue === 0 && peakValue >= 50) {
      // For high peaks (>=50), if we hit zero, end the peak immediately
      // This prevents extending sparse peaks unnecessarily
      endIndex = i - 1;
      break;
    }
  }
  
  // Calculate duration in days
  const durationMs = data[endIndex].date.getTime() - data[startIndex].date.getTime();
  let durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
  
  // Maximum duration: 3 months (approximately 90 days)
  const maxDurationDays = 90;
  if (durationDays > maxDurationDays) {
    // Cap the duration and adjust end index
    const maxEndDate = new Date(data[startIndex].date);
    maxEndDate.setDate(maxEndDate.getDate() + maxDurationDays);
    
    // Find the closest data point to this date
    for (let i = startIndex; i < data.length; i++) {
      if (data[i].date.getTime() >= maxEndDate.getTime()) {
        endIndex = i;
        break;
      }
      endIndex = i;
    }
    durationDays = maxDurationDays;
  }
  
  return {
    startIndex,
    endIndex,
    durationDays: Math.max(1, durationDays), // At least 1 day, max 90 days
  };
}

/**
 * Calculate IntelPeak metric for a trend
 */
export function calculateIntelPeak(data: DataPoint[]): IntelPeakResult {
  console.log('[IntelPeak] ========== START calculateIntelPeak ==========');
  console.log('[IntelPeak] Input data:', {
    dataLength: data.length,
    firstDate: data[0]?.date?.toISOString(),
    lastDate: data[data.length - 1]?.date?.toISOString(),
    sampleValues: data.slice(0, 5).map(d => ({ date: d.date.toISOString(), value: d.value })),
  });
  
  if (data.length < 7) {
    // Need at least a week of data
    console.log('[IntelPeak] ❌ Insufficient data: need at least 7 days, got', data.length);
    return {
      intelPeak: null,
      peakDate: null,
      peakDuration: 0,
      peakArea: 0,
      baselineArea: 0,
      ratio: null,
      peakStartDate: null,
      peakEndDate: null,
      baselineStartDate: null,
      baselineEndDate: null,
    };
  }
  
  // Sort data by date (should already be sorted, but ensure it)
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Get current date (most recent date in data)
  const currentDate = sortedData[sortedData.length - 1].date;
  const threeMonthsAgo = new Date(currentDate);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  // Detect peaks with lower threshold to catch more significant periods
  // Lower threshold helps catch peaks that might be part of sustained high periods
  // Also detect very high peaks (value >= 50) regardless of threshold
  const peaks = detectPeaks(sortedData, 10);
  
  // Also add any very high value points as peaks (even if not local maxima)
  // This ensures we catch significant spikes like value 100
  for (let i = 0; i < sortedData.length; i++) {
    const value = sortedData[i].value;
    if (value >= 50) {
      // Check if this is already in peaks
      const existingPeak = peaks.find(p => p.index === i);
      if (!existingPeak) {
        // Check if it's a significant point (higher than neighbors or part of high period)
        const isSignificant = 
          (i > 0 && i < sortedData.length - 1 && value > sortedData[i - 1].value && value > sortedData[i + 1].value) ||
          (i === 0 && value > sortedData[i + 1].value) ||
          (i === sortedData.length - 1 && value > sortedData[i - 1].value) ||
          (value >= 80); // Very high values are always significant
        
        if (isSignificant) {
          peaks.push({
            date: sortedData[i].date,
            value: value,
            index: i,
          });
        }
      }
    }
  }
  
  // Sort peaks by index to maintain chronological order
  peaks.sort((a, b) => a.index - b.index);
  
  // Find peaks within 3 months of the peak date
  // Also filter peaks where the peak start would be more than 3 months from today
  const threeMonthsFromStart = new Date(currentDate);
  threeMonthsFromStart.setMonth(threeMonthsFromStart.getMonth() - 3);
  
  const recentPeaks = peaks.filter(p => {
    // Peak date must be within 3 months
    // Use a more lenient comparison (compare dates, not times)
    const peakDateOnly = new Date(p.date.getFullYear(), p.date.getMonth(), p.date.getDate());
    const threeMonthsAgoOnly = new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), threeMonthsAgo.getDate());
    
    const isRecent = peakDateOnly >= threeMonthsAgoOnly;
    
    // Log peaks near the boundary for debugging
    if (!isRecent && peakDateOnly >= new Date(threeMonthsAgoOnly.getTime() - 7 * 24 * 60 * 60 * 1000)) {
      console.log('[IntelPeak] Peak just outside 3-month window', {
        peakDate: p.date.toISOString(),
        peakDateOnly: peakDateOnly.toISOString(),
        threeMonthsAgoOnly: threeMonthsAgoOnly.toISOString(),
        daysDiff: Math.round((peakDateOnly.getTime() - threeMonthsAgoOnly.getTime()) / (24 * 60 * 60 * 1000)),
        peakValue: p.value,
      });
    }
    
    return isRecent;
  });
  
  // Log all peaks from the last 6 months to debug
  const sixMonthsAgo = new Date(currentDate);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentPeaksForLog = peaks.filter(p => p.date >= sixMonthsAgo);
  
  console.log('[IntelPeak] Recent peaks filter', {
    totalPeaks: peaks.length,
    recentPeaksCount: recentPeaks.length,
    threeMonthsAgo: threeMonthsAgo.toISOString(),
    currentDate: currentDate.toISOString(),
    sixMonthsAgo: sixMonthsAgo.toISOString(),
    recentPeakDates: recentPeaks.map(p => ({ date: p.date.toISOString(), value: p.value })),
    last10Peaks: peaks.slice(-10).map(p => ({ date: p.date.toISOString(), value: p.value, isRecent: p.date >= threeMonthsAgo })),
    peaksInLast6Months: recentPeaksForLog.map(p => ({ date: p.date.toISOString(), value: p.value, isRecent: p.date >= threeMonthsAgo })),
  });
  
  if (recentPeaks.length === 0) {
    // No peaks in the last 3 months
    console.log('[IntelPeak] No peaks found in the last 3 months', {
      totalPeaks: peaks.length,
      threeMonthsAgo: threeMonthsAgo.toISOString(),
      currentDate: currentDate.toISOString(),
    });
    return {
      intelPeak: null,
      peakDate: null,
      peakDuration: 0,
      peakArea: 0,
      baselineArea: 0,
      ratio: null,
      peakStartDate: null,
      peakEndDate: null,
      baselineStartDate: null,
      baselineEndDate: null,
    };
  }
  
  // Instead of just taking the most recent peak, evaluate all recent peaks
  // and find the one with the highest IntelPeak score (most significant)
  let bestPeakResult: IntelPeakResult | null = null;
  let bestScore = -Infinity;
  let selectedPeakValue = 0; // Store the maximum value of the selected peak period
  let selectedPeakPeriod: DataPoint[] = []; // Store the peak period for comparison
  
  for (const peak of recentPeaks) {
    const peakIndex = peak.index;
    
    // Find peak duration with start and end indices
    const durationResult = findPeakDuration(sortedData, peakIndex);
    const peakStartIndex = durationResult.startIndex;
    const peakEndIndex = durationResult.endIndex;
    const durationDays = durationResult.durationDays;
    
    // Use the actual detected peak period
    // Check if this is a sparse peak (mostly zeros with one spike) BEFORE extending
    let effectiveStartIndex = peakStartIndex;
    let effectiveEndIndex = peakEndIndex;
    
    const initialPeakPeriod = sortedData.slice(peakStartIndex, peakEndIndex + 1);
    const nonZeroPoints = initialPeakPeriod.filter(p => p.value > 0).length;
    const totalPoints = initialPeakPeriod.length;
    const peakValue = sortedData[peakIndex].value;
    
    // Detect sparse peaks: very few non-zero points relative to total, or single high spike
    const isSparsePeak = (nonZeroPoints <= 2 && totalPoints > 3) || 
                         (nonZeroPoints === 1 && peakValue >= 50 && durationDays > 7);
    
    // Only extend if not sparse and duration is too short
    // For sparse peaks, use the actual detected duration (don't artificially extend)
    if (!isSparsePeak && durationDays < 7) {
      // Extend symmetrically around the peak
      const extension = Math.ceil((7 - durationDays) / 2);
      effectiveStartIndex = Math.max(0, peakStartIndex - extension);
      effectiveEndIndex = Math.min(sortedData.length - 1, peakEndIndex + extension);
    }
    
    // Cap at 90 days (3 months) maximum, but only for non-sparse peaks
    const maxDurationDays = isSparsePeak ? Math.min(30, durationDays + 3) : 90; // Limit sparse peaks to 30 days max
    const currentDuration = Math.ceil((sortedData[effectiveEndIndex].date.getTime() - sortedData[effectiveStartIndex].date.getTime()) / (1000 * 60 * 60 * 24));
    if (currentDuration > maxDurationDays) {
      // Cap the end index to maxDurationDays from start
      const maxEndDate = new Date(sortedData[effectiveStartIndex].date);
      maxEndDate.setDate(maxEndDate.getDate() + maxDurationDays);
      
      // Find the closest data point to this date
      for (let i = effectiveStartIndex; i < sortedData.length; i++) {
        if (sortedData[i].date.getTime() >= maxEndDate.getTime()) {
          effectiveEndIndex = i;
          break;
        }
        effectiveEndIndex = i;
      }
    }
    
    // Recalculate peak period with effective indices (in case we extended it)
    const peakPeriod = sortedData.slice(effectiveStartIndex, effectiveEndIndex + 1);
    const peakPeriodLength = peakPeriod.length; // Actual number of data points
    
    // Calculate baseline period (EXACTLY same length as peak period)
    // Try to find a baseline period that's NOT part of high activity
    // Start by looking immediately before the peak, but skip periods that are also high
    let baselineEndIndex = effectiveStartIndex;
    let baselineStartIndex = Math.max(0, baselineEndIndex - peakPeriodLength);
    
    // Calculate average value in peak period to determine what "high activity" means
    const peakAvg = peakPeriod.reduce((sum, p) => sum + p.value, 0) / peakPeriod.length;
    const highActivityThreshold = peakAvg * 0.5; // 50% of peak average is considered "high"
    
    // Try to find a baseline period that's not high activity
    // Look backwards from peak start, skipping high-activity periods
    let attempts = 0;
    const maxAttempts = 5; // Try up to 5 different baseline periods
    let baselinePeriod = sortedData.slice(baselineStartIndex, baselineEndIndex);
    
    // Check if baseline period is high activity - if so, look further back
    // But ensure we always have enough data points
    while (attempts < maxAttempts && baselinePeriod.length >= peakPeriodLength) {
      const baselineAvg = baselinePeriod.reduce((sum, p) => sum + p.value, 0) / baselinePeriod.length;
      if (baselineAvg < highActivityThreshold && baselineAvg >= 0.1) {
        // Found a good baseline period (not high activity and has meaningful data)
        break;
      }
      // Baseline is also high activity or too low - look further back
      baselineEndIndex = baselineStartIndex;
      baselineStartIndex = Math.max(0, baselineEndIndex - peakPeriodLength);
      baselinePeriod = sortedData.slice(baselineStartIndex, baselineEndIndex);
      attempts++;
      
      // If we've run out of data, stop trying
      if (baselineStartIndex === 0 && baselinePeriod.length < peakPeriodLength) {
        break;
      }
    }
    
    // If baseline period is shorter than peak period, try to use what we have
    // But ensure we have at least 7 days of baseline data (minimum for meaningful comparison)
    if (baselinePeriod.length < Math.max(peakPeriodLength, 7)) {
      // Not enough data before peak - try looking further back
      const sixMonthsAgo = new Date(currentDate);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      let furtherBackAttempts = 0;
      let tempBaselineEndIndex = baselineEndIndex;
      let tempBaselineStartIndex = baselineStartIndex;
      const minBaselineLength = Math.max(peakPeriodLength, 7);
      
      while (baselinePeriod.length < minBaselineLength && furtherBackAttempts < 10 && tempBaselineStartIndex > 0) {
        tempBaselineEndIndex = tempBaselineStartIndex;
        tempBaselineStartIndex = Math.max(0, tempBaselineEndIndex - minBaselineLength);
        const tempBaselinePeriod = sortedData.slice(tempBaselineStartIndex, tempBaselineEndIndex);
        
        // Check if we've gone too far back (more than 6 months) or don't have enough data
        if (tempBaselinePeriod.length < minBaselineLength || 
            (tempBaselinePeriod.length > 0 && tempBaselinePeriod[0].date < sixMonthsAgo)) {
          break;
        }
        
        baselinePeriod = tempBaselinePeriod;
        baselineStartIndex = tempBaselineStartIndex;
        baselineEndIndex = tempBaselineEndIndex;
        furtherBackAttempts++;
      }
      
      // If still not enough baseline data, skip this peak
      if (baselinePeriod.length < minBaselineLength) {
        console.log('[IntelPeak] ⚠️ Skipping peak: insufficient baseline data even after looking further back', {
          peakDate: peak.date.toISOString(),
          peakPeriodLength,
          baselinePeriodLength: baselinePeriod.length,
          minBaselineLength,
          peakValue: peak.value,
        });
        continue;
      }
    }
    
    // Verify baseline period has meaningful data (not all zeros or very low values)
    let baselineSum = baselinePeriod.reduce((sum, p) => sum + p.value, 0);
    let baselineAvg = baselineSum / baselinePeriod.length;
    
    // If baseline is too low, try looking even further back (up to 6 months total)
    if (baselineAvg < 0.1) {
      const sixMonthsAgo = new Date(currentDate);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Try to find a baseline period further back that has meaningful data
      let furtherBackAttempts = 0;
      let tempBaselineEndIndex = baselineEndIndex;
      let tempBaselineStartIndex = baselineStartIndex;
      
      while (baselineAvg < 0.1 && furtherBackAttempts < 5 && tempBaselineStartIndex > 0) {
        tempBaselineEndIndex = tempBaselineStartIndex;
        tempBaselineStartIndex = Math.max(0, tempBaselineEndIndex - peakPeriodLength);
        const tempBaselinePeriod = sortedData.slice(tempBaselineStartIndex, tempBaselineEndIndex);
        
        // Check if we've gone too far back (more than 6 months) or don't have enough data
        if (tempBaselinePeriod.length < peakPeriodLength || 
            (tempBaselinePeriod.length > 0 && tempBaselinePeriod[0].date < sixMonthsAgo)) {
          break;
        }
        
        const newBaselineSum = tempBaselinePeriod.reduce((sum, p) => sum + p.value, 0);
        const newBaselineAvg = newBaselineSum / tempBaselinePeriod.length;
        
        if (newBaselineAvg >= 0.1) {
          // Found a better baseline further back
          baselinePeriod = tempBaselinePeriod;
          baselineStartIndex = tempBaselineStartIndex;
          baselineEndIndex = tempBaselineEndIndex;
          baselineSum = newBaselineSum;
          baselineAvg = newBaselineAvg;
          break;
        }
        
        furtherBackAttempts++;
      }
      
      // If still no good baseline found, skip this peak
      if (baselineAvg < 0.1) {
        console.log('[IntelPeak] ⚠️ Skipping peak: baseline too low even after looking further back', {
          peakDate: peak.date.toISOString(),
          baselineAvg,
          baselineSum,
          baselinePeriodLength: baselinePeriod.length,
          peakValue: peak.value,
        });
        continue;
      }
    }
    
    // Get dates for display
    const peakStartDate = peakPeriod.length > 0 ? peakPeriod[0].date : null;
    const peakEndDate = peakPeriod.length > 0 ? peakPeriod[peakPeriod.length - 1].date : null;
    const baselineStartDate = baselinePeriod.length > 0 ? baselinePeriod[0].date : null;
    const baselineEndDate = baselinePeriod.length > 0 ? baselinePeriod[baselinePeriod.length - 1].date : null;
    
    // Don't filter by peak start date - only filter by peak date (which we already did)
    // Long peaks that started earlier but are still active should be included
    
    // Calculate areas
    const peakArea = calculateArea(peakPeriod);
    const baselineArea = baselinePeriod.length > 0 ? calculateArea(baselinePeriod) : 0;
    
    // Calculate ratio and IntelPeak score
    let ratio: number | null = null;
    let intelPeak: number | null = null;
    let score = -Infinity;
    
    if (baselineArea > 0) {
      ratio = peakArea / baselineArea;
      // IntelPeak is the percentage increase: (peakArea - baselineArea) / baselineArea * 100
      intelPeak = ((peakArea - baselineArea) / baselineArea) * 100;
      score = intelPeak;
    } else if (peakArea > 0) {
      // If no baseline, use peak area as metric (scaled)
      intelPeak = peakArea;
      score = peakArea;
    }
    
    // Skip peaks with negative IntelPeak (peak area is less than baseline)
    // These are not actual peaks - they represent decreases, not increases
    if (intelPeak !== null && intelPeak < 0) {
      // This peak has lower area than baseline - skip it
      console.log('[IntelPeak] ⚠️ Skipping peak with negative IntelPeak', {
        peakDate: peak.date.toISOString(),
        intelPeak,
        peakArea,
        baselineArea,
        peakValue: peak.value,
      });
      continue;
    }
    
    // Prefer peaks with higher IntelPeak scores (more significant)
    // Also consider peak value and peak area as tiebreakers
    // Peak value is VERY important - a peak of 100 is much more significant than 31
    // Use a combination: IntelPeak percentage + significant weight for peak value
    const peakValue = peak.value;
    // Weight peak value heavily - a peak of 100 should beat a peak of 31 even if percentage is slightly lower
    // Formula: IntelPeak% + (peakValue * 2) + (peakArea * 0.01)
    // This ensures high-value peaks are prioritized
    const peakScore = score + (peakValue * 2) + (peakArea * 0.01);
    
    if (peakScore > bestScore) {
      bestScore = peakScore;
      // Find the maximum value in the peak period (not just the peak point value)
      const maxPeakValue = peakPeriod.length > 0 
        ? Math.max(...peakPeriod.map(p => p.value))
        : peak.value;
      selectedPeakValue = maxPeakValue; // Store the maximum value of the selected peak period
      selectedPeakPeriod = peakPeriod; // Store the peak period
      bestPeakResult = {
        intelPeak,
        peakDate: peak.date,
        peakDuration: effectiveDuration,
        peakArea,
        baselineArea,
        ratio,
        peakStartDate,
        peakEndDate,
        baselineStartDate,
        baselineEndDate,
      };
    }
  }
  
  // After selecting the best peak, check if there are other peaks in the past with higher values
  // If so, divide the IntelPeak percentage by the number of such peaks
  // Note: We search ALL peaks (not just recentPeaks) to find higher peaks in the past
  // But we need to compare against the maximum value of each peak's period, not just the peak point value
  if (bestPeakResult && bestPeakResult.intelPeak !== null && selectedPeakValue > 0) {
    // For each peak in the past, find its maximum value within its peak period
    // Count peaks where the maximum value is higher than our selected peak's maximum value
    // Use the same peak period calculation logic as for the selected peak (7-day min, 90-day max)
    const higherPeaksCount = peaks.filter(p => {
      // Only check peaks before the selected peak date
      if (p.date >= bestPeakResult!.peakDate!) {
        return false;
      }
      
      // Find the peak period for this peak using the same logic as the selected peak
      const peakIndex = p.index;
      const durationResult = findPeakDuration(sortedData, peakIndex);
      let peakStartIdx = durationResult.startIndex;
      let peakEndIdx = durationResult.endIndex;
      const durationDays = durationResult.durationDays;
      
      // Use the same effective duration logic (min 7 days, max 90 days)
      const effectiveDuration = Math.max(durationDays, 7);
      
      if (durationDays < 7) {
        // Extend symmetrically around the peak (same as selected peak logic)
        const extension = Math.ceil((7 - durationDays) / 2);
        peakStartIdx = Math.max(0, peakStartIdx - extension);
        peakEndIdx = Math.min(sortedData.length - 1, peakEndIdx + extension);
      }
      
      // Cap at 90 days (3 months) maximum (same as selected peak logic)
      const maxDurationDays = 90;
      const currentDuration = Math.ceil((sortedData[peakEndIdx].date.getTime() - sortedData[peakStartIdx].date.getTime()) / (1000 * 60 * 60 * 24));
      if (currentDuration > maxDurationDays) {
        const maxEndDate = new Date(sortedData[peakStartIdx].date);
        maxEndDate.setDate(maxEndDate.getDate() + maxDurationDays);
        for (let i = peakStartIdx; i < sortedData.length; i++) {
          if (sortedData[i].date.getTime() >= maxEndDate.getTime()) {
            peakEndIdx = i;
            break;
          }
          peakEndIdx = i;
        }
      }
      
      // Get the peak period data points
      const otherPeakPeriod = sortedData.slice(peakStartIdx, peakEndIdx + 1);
      
      // Find the maximum value in this peak's period
      const otherMaxValue = otherPeakPeriod.length > 0
        ? Math.max(...otherPeakPeriod.map(dp => dp.value))
        : p.value;
      
      // Compare against the selected peak's maximum value
      return otherMaxValue > selectedPeakValue;
    }).length;
    
    // Always store the count for debug display (even if 0)
    bestPeakResult.higherPeaksCount = higherPeaksCount;
    
    // If there are higher peaks in the past, divide IntelPeak by the number of them
    if (higherPeaksCount > 0) {
      const originalIntelPeak = bestPeakResult.intelPeak;
      bestPeakResult.intelPeak = bestPeakResult.intelPeak / higherPeaksCount;
      console.log(`[IntelPeak] Adjusted IntelPeak: divided by ${higherPeaksCount} (found ${higherPeaksCount} higher peaks in the past)`, {
        originalIntelPeak,
        adjustedIntelPeak: bestPeakResult.intelPeak,
        selectedPeakValue,
        higherPeaksCount,
        selectedPeakDate: bestPeakResult.peakDate,
        totalPeaksSearched: peaks.length,
      });
    } else {
      console.log(`[IntelPeak] No higher peaks found in the past`, {
        selectedPeakValue,
        higherPeaksCount: 0,
        selectedPeakDate: bestPeakResult.peakDate,
        totalPeaksSearched: peaks.length,
      });
    }
  }
  
  // Return the best peak result, or fallback if none found
  if (bestPeakResult) {
    console.log('[IntelPeak] ✅ Best peak found:', {
      intelPeak: bestPeakResult.intelPeak,
      peakDate: bestPeakResult.peakDate?.toISOString(),
      peakDuration: bestPeakResult.peakDuration,
      higherPeaksCount: bestPeakResult.higherPeaksCount,
    });
    console.log('[IntelPeak] ========== END calculateIntelPeak (SUCCESS) ==========');
    return bestPeakResult;
  }
  
  // Fallback: return null result
  // This happens when:
  // 1. All peaks have negative IntelPeak (peak area < baseline area)
  // 2. All peaks don't have enough baseline data
  // 3. All peaks start more than 3 months ago
  console.log('[IntelPeak] ❌ No valid peak found after filtering', {
    recentPeaksCount: recentPeaks.length,
    totalPeaksDetected: peaks.length,
    threeMonthsAgo: threeMonthsAgo.toISOString(),
    threeMonthsFromStart: threeMonthsFromStart.toISOString(),
    currentDate: currentDate.toISOString(),
    recentPeakDates: recentPeaks.map(p => p.date.toISOString()),
  });
  console.log('[IntelPeak] ========== END calculateIntelPeak (NO PEAK) ==========');
  return {
    intelPeak: null,
    peakDate: null,
    peakDuration: 0,
    peakArea: 0,
    baselineArea: 0,
    ratio: null,
    peakStartDate: null,
    peakEndDate: null,
    baselineStartDate: null,
    baselineEndDate: null,
  };
}

