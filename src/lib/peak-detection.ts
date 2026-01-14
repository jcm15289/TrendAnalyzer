export interface Peak {
  date: string;
  value: number;
  keyword: string;
  index: number;
}

/**
 * Detect local maxima (peaks) in trend data
 * Also detects edge peaks (at the start or end of the timeline)
 */
export function detectPeaks(
  data: Array<{ date: string; [key: string]: number | string }>,
  keyword: string,
  minValue: number = 50, // Only consider peaks above 50
  windowSize: number = 3 // Look at 3 points on each side
): Peak[] {
  const peaks: Peak[] = [];
  
  if (data.length < 2) {
    return peaks;
  }

  // Helper function to check if a point is a peak
  const isPeakAt = (i: number): boolean => {
    const currentValue = Number(data[i][keyword]) || 0;
    
    // Skip if value is too low
    if (currentValue < minValue) {
      return false;
    }

    // Check surrounding points (only those that exist)
    const startCheck = Math.max(0, i - windowSize);
    const endCheck = Math.min(data.length - 1, i + windowSize);
    
    for (let j = startCheck; j <= endCheck; j++) {
      if (j === i) continue;
      const compareValue = Number(data[j][keyword]) || 0;
      if (compareValue >= currentValue) {
        return false;
      }
    }

    return true;
  };

  // Check all points including edges
  for (let i = 0; i < data.length; i++) {
    if (isPeakAt(i)) {
      const currentValue = Number(data[i][keyword]) || 0;
      peaks.push({
        date: String(data[i].date),
        value: currentValue,
        keyword,
        index: i,
      });
    }
  }

  return peaks;
}

/**
 * Extract EVENT description from structured PEAK EXPLANATIONS (section 2) for a specific date
 * Uses EVENT line from format: ### PEAK: YYYY-MM-DD\nEVENT: [description]
 * Focuses on extracting actual event descriptions, never generic "spike" or "Google Trends" language
 */
export function extractPeakExplanation(
  fullExplanation: string,
  date: string,
  maxWords: number = 15  // Increased to allow full EVENT descriptions
): string | null {
  if (!fullExplanation || !date) {
    return null;
  }

  // Strategy 1: Look for structured PEAK sections from section 2 (PEAK EXPLANATIONS)
  // Format: ### PEAK: YYYY-MM-DD
  //         EVENT: [event description] (DIRECTLY FROM Search Results)
  //         SOURCE: [source from Search Results]
  // Prioritize sections that have both EVENT and SOURCE (indicating search grounding was used)
  
  // First, collect all peak sections with their dates and events
  const peakSectionRegex = /### PEAK:\s*(\d{4}-\d{2}-\d{2})\s*\n\s*EVENT:\s*([^\n]+)(?:\s*\n\s*SOURCE:\s*[^\n]+)?/gi;
  const allPeakSections: Array<{ date: string; eventText: string; matchIndex: number }> = [];
  let match;
  while ((match = peakSectionRegex.exec(fullExplanation)) !== null) {
    allPeakSections.push({
      date: match[1],
      eventText: match[2].trim(),
      matchIndex: match.index
    });
  }
  
  // Now find the best matching peak section for our target date
  const targetDateStr = date.split('T')[0]; // Handle ISO dates
  let bestMatch: { date: string; eventText: string; daysDiff: number; matchIndex: number } | null = null;
  
  for (const peakSection of allPeakSections) {
    const peakDateStr = peakSection.date;
    
    // Try exact match first
    if (peakDateStr === targetDateStr || peakDateStr === date) {
      bestMatch = { date: peakDateStr, eventText: peakSection.eventText, daysDiff: 0, matchIndex: peakSection.matchIndex };
      break; // Exact match found, use it
    }
    
    // Calculate days difference for flexible matching
    try {
      const targetDate = new Date(targetDateStr);
      const peakDateObj = new Date(peakDateStr);
      const daysDiff = Math.abs((targetDate.getTime() - peakDateObj.getTime()) / (1000 * 60 * 60 * 24));
      
      // Find the closest match within 14 days (increased to catch more cases)
      if (daysDiff <= 14 && !isNaN(daysDiff)) {
        if (!bestMatch || daysDiff < bestMatch.daysDiff) {
          bestMatch = { date: peakDateStr, eventText: peakSection.eventText, daysDiff, matchIndex: peakSection.matchIndex };
        }
      }
    } catch (e) {
      // Date parsing failed, skip this section
      continue;
    }
  }
  
  // If we found a match (exact or flexible), use it
  if (bestMatch) {
    const eventText = bestMatch.eventText;
    if (bestMatch.daysDiff > 0) {
      console.log(`[extractPeakExplanation] Flexible date match: ${bestMatch.date} matches ${targetDateStr} (${bestMatch.daysDiff.toFixed(1)} days apart)`);
    }
    
    // Process the matched event text
    {
      // Check if this section has a SOURCE line (indicating search grounding was used)
      const sectionMatch = fullExplanation.substring(Math.max(0, bestMatch.matchIndex - 50), bestMatch.matchIndex + 500);
      const hasSource = /SOURCE:\s*[^\n]+/i.test(sectionMatch);
      
      console.log(`[extractPeakExplanation] Found structured EVENT for ${date}:`, {
        eventText,
        hasSource,
        fromSearchResults: hasSource ? 'YES (has SOURCE citation)' : 'UNKNOWN (no SOURCE found)',
      });
      
      // REJECT if it's a generic "no event" or "search volume" response
      const lowerEvent = eventText.toLowerCase();
      if (
        lowerEvent.includes('no specific event') ||
        lowerEvent.includes('no event found') ||
        lowerEvent.includes('search volume') ||
        lowerEvent.includes('general election news') ||
        lowerEvent.includes('not found') ||
        lowerEvent.includes('unclear') ||
        lowerEvent.includes('unknown event') ||
        lowerEvent.includes('peak in') ||
        lowerEvent.includes('peak on') ||
        lowerEvent.startsWith('peak ') ||
        lowerEvent.match(/^peak\s+on\s+/i) ||
        lowerEvent.match(/^peak\s+at\s+/i) ||
        lowerEvent.includes('increase in') ||
        lowerEvent.includes('spike in') ||
        lowerEvent.includes('rise in') ||
        lowerEvent.includes('google trends') ||
        lowerEvent.includes('search interest') ||
        lowerEvent.includes('here\'s') ||
        lowerEvent.includes('analysis') ||
        lowerEvent.includes('keyword') ||
        lowerEvent.includes('for keyword')
      ) {
        console.log(`[extractPeakExplanation] REJECTED generic/no-event text for ${date}`);
        return null;
      }
      
      // Must contain actual event-related words (political, social themes)
      // Expanded to include security, directive, violence, classification, and other political terms
      // Also includes: allegations, misconduct, sexual harassment, conceded, race, mayoral, mayor, launched, etc.
      const hasEventWords = /election|campaign|debate|announcement|policy|protest|crisis|incident|scandal|vote|referendum|rally|march|strike|legislation|bill|law|court|ruling|verdict|attack|conflict|war|treaty|summit|convention|primary|candidate|resignation|appointment|speech|interview|endorsement|controversy|win|won|victory|defeat|defied|odds|directive|security|violence|classif|label|predictor|belief|political|trump|biden|president|government|administration|federal|state|national|domestic|international|terrorism|extremism|radical|ideology|doctrine|order|executive|decision|action|measure|initiative|program|plan|strategy|response|reaction|statement|declaration|proclamation|guidance|instruction|mandate|requirement|regulation|rule|standard|criteria|classification|category|designation|identification|assessment|evaluation|analysis|report|finding|conclusion|recommendation|suggestion|proposal|capitalist|anti-capitalist|anti-capitalism|allegations|misconduct|sexual|harassment|conceded|concede|race|mayoral|mayor|launched|accused|faced|death|deaths|undercounting|nursing|home|covid|coronavirus/i.test(eventText);
      
      // If event has SOURCE citation (from search results), be more lenient - it's likely a valid event
      if (!hasEventWords && !hasSource) {
        console.log(`[extractPeakExplanation] REJECTED - no themed event words for ${date}`);
        return null;
      } else if (!hasEventWords && hasSource) {
        // Has source but no event words - might still be valid, but log a warning
        console.log(`[extractPeakExplanation] WARNING - EVENT for ${date} has SOURCE but no typical event words, allowing anyway`);
      }
      
      // Prefer events that have SOURCE citations (indicating they came from Search Results)
      if (!hasSource) {
        console.log(`[extractPeakExplanation] WARNING - EVENT for ${date} has no SOURCE citation (may not be from Search Results)`);
        // Still allow it, but log a warning
      }
      
      // Clean up but keep full EVENT description (don't truncate too aggressively)
      const cleaned = eventText
        .replace(/^(the|a|an)\s+/i, '')
        .replace(/\s*[.,;:]$/, '')
        .trim();
      
      // Use full description up to maxWords, but ensure it's meaningful
      const words = cleaned.split(/\s+/);
      if (words.length >= 3) {
        // Return up to maxWords, but prefer complete sentences
        const truncated = words.slice(0, maxWords).join(' ');
        return truncated;
      }
    }
  }

  // Strategy 2: Parse the date and try fallback extraction if no structured format found
  const dateObj = new Date(date);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[month - 1];

  // Split into sentences and bullet points
  const lines = fullExplanation.split(/[.\n]+/).map(s => s.trim()).filter(s => s.length > 15);

  // Find lines mentioning the timeframe
  const relevantLines = lines.filter(line => {
    const lower = line.toLowerCase();
    // Skip header/title lines and descriptive text
    if (
      lower.includes('google trends') || 
      lower.includes('analysis') || 
      lower.startsWith('the google trends data') ||
      lower.includes('search interest for') ||
      lower.includes('remained relatively') ||
      lower.includes('shows') ||
      lower.includes('reveals') ||
      lower.includes('data for')
    ) {
      return false;
    }
    return (
      (lower.includes(monthName.toLowerCase()) && lower.includes(year.toString())) ||
      lower.includes(date) ||
      (lower.includes(year.toString()) && lower.includes(`${month}`))
    );
  });

  if (relevantLines.length === 0) return null;

  // Try multiple extraction strategies in order of preference (fallback only)
  for (const line of relevantLines) {
    // Skip lines with generic/descriptive language
    const lowerLine = line.toLowerCase();
    if (
      lowerLine.includes('no specific event') ||
      lowerLine.includes('search volume') ||
      lowerLine.includes('search interest') ||
      lowerLine.includes('peak in') ||
      lowerLine.includes('peak on') ||
      lowerLine.startsWith('peak ') ||
      lowerLine.match(/^peak\s+on\s+/i) ||
      lowerLine.match(/^peak\s+at\s+/i) ||
      lowerLine.includes('spike in') ||
      lowerLine.includes('increase in') ||
      lowerLine.includes('rise in') ||
      lowerLine.includes('not found') ||
      lowerLine.includes('unclear')
    ) {
      continue;
      }
      
    // Strategy 3a: Look for specific event phrases (election, campaign, race, etc.)
    const eventPhrases = [
      /(?:the\s+)?(\d{4}\s+(?:New York City|NYC|mayoral|presidential|gubernatorial)\s+(?:election|race|campaign))/i,
      /(?:the\s+)?(lead-up to|run-up to|buildup to|final weeks|days before)\s+(?:the\s+)?([^,.]{15,60})/i,
      /(?:related to|involving|concerning|about)\s+(?:the\s+)?([^,.]{15,60}(?:election|campaign|race|mayoral|debate|primary))/i,
      /(?:surrounding|regarding)\s+(?:the\s+)?(\d{4}\s+[^,.]{10,50})/i,
    ];

    for (const pattern of eventPhrases) {
      const match = line.match(pattern);
      if (match && (match[1] || match[2])) {
        let extracted = (match[1] || match[2])
          .trim()
          .replace(/\s+where\s+.*/i, '')
          .replace(/\s+on\s+November\s+\d+.*$/i, '')
          .replace(/\s*[.,].*/, '');

        const words = extracted
          .split(/\s+/)
          .filter(w => w.length > 2)
          .slice(0, maxWords);

        if (words.length >= 3 && words.length <= maxWords) {
          return words.join(' ');
      }
    }
  }

    // Strategy 3b: Extract noun phrases after key connectors
    const connectors = [
      /(?:due to|because of|caused by|related to|sparked by|driven by|following|after)(?:\s+the)?\s+([a-z][^,.]{15,70})/i,
      /(?:marks?|coincides? with|corresponds? to|aligns? with)\s+(?:the\s+)?([a-z][^,.]{15,70})/i,
    ];

    for (const pattern of connectors) {
      const match = line.match(pattern);
      if (match && match[1]) {
        let extracted = match[1]
          .trim()
          .replace(/\s+in\s+\d{4}$/i, '')
          .replace(/^(a|an|the)\s+/i, '')
          .replace(/\s+and\s+(the\s+)?launching?.*/i, '')
          .replace(/\s*,.*/, '');

        // Reject if it contains description language
        if (/search interest|remained|relatively|baseline|shows?|reveals?|data/i.test(extracted)) {
          continue;
        }

        const words = extracted
          .split(/\s+/)
          .filter(w => w.length > 2 && !/^(was|were|has|have|had|been|being|will|would|could|should|may|might|can|this|that|when|where|which|more|most|very|quite|just|only)$/i.test(w))
          .slice(0, maxWords);

        if (words.length >= 3) {
          const result = words.join(' ').trim();
          if (!/^(peak|spike|surge|increase|rise|jump|drop|decline|fall|more|significant|occurs?|likely|search|interest|remained|relatively)/i.test(result)) {
            return result;
          }
        }
      }
    }

    // Strategy 3c: Look for capitalized noun phrases (likely events/names)
    const capitalizedPhrases = line.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+|\s+[a-z]{2,}){2,5}\b/g);
    if (capitalizedPhrases) {
      for (const phrase of capitalizedPhrases) {
        if (phrase.includes('Google Trends') || phrase.includes('Trends for') || phrase.includes('Curtis Sliwa') || phrase.includes('Guardian Angels')) {
          continue;
        }
        // Look for election/campaign related phrases
        if (/election|campaign|race|mayoral|debate|primary/i.test(phrase)) {
          const words = phrase.split(/\s+/).slice(0, maxWords);
          if (words.length >= 3 && words.length <= maxWords) {
            return words.join(' ');
        }
      }
    }
  }

    // Strategy 3d: Extract election/political event patterns
    const politicalPatterns = [
      /\b(\d{4})\s+(New York City|NYC)\s+(mayoral)\s+(election|race|campaign)/i,
      /\b(mayoral)\s+(election|race|campaign)(?:\s+(?:in|for)\s+\d{4})?/i,
      /\b(election|campaign)\s+(?:in|for|on)\s+([^,.]{10,40})/i,
    ];

    for (const pattern of politicalPatterns) {
      const match = line.match(pattern);
      if (match) {
        let result = match[0].trim()
          .replace(/\s+where\s+.*/i, '')
          .replace(/\s+on\s+November.*$/i, '');
        
        const words = result.split(/\s+/).slice(0, maxWords);
        if (words.length >= 3) {
          return words.join(' ');
        }
      }
    }

    // Strategy 3e: Extract key terms (nouns) from the sentence - last resort
    const stopWords = /^(the|a|an|in|on|at|to|for|of|with|by|from|as|is|was|were|are|this|that|these|those|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|spike|spikes|peak|peaks|surge|surges|increase|increases|rise|rises|drop|drops|value|values|interest|likely|corresponds|coverage|media|search|data|reflects?|shows?|indicates?|suggests?|marks?|higher|lower|during|period|remained?|relatively|baseline|noticeable|substantial)$/i;
    
    const meaningfulWords = line
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.test(w) && !/^\d+$/.test(w))
      .slice(0, maxWords);

    // Validate we have actual event-related terms
    if (meaningfulWords.length >= 3) {
      const result = meaningfulWords.join(' ');
      // Must contain at least one event-related word
      if (/election|campaign|race|mayoral|debate|primary|candidate|vote|announcement|policy|scandal|protest|crisis|incident/i.test(result)) {
        // Reject if it still looks generic
        if (!/^(october|november|december|january|february|march|april|may|june|july|august|september|increased?|higher|lower|greater|change|search|interest|terest|remed)/i.test(result)) {
          return result;
        }
      }
    }
  }

  return null;
}

