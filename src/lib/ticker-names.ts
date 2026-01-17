/**
 * Maps ticker symbols to company names
 * Company names are extracted from the first keyword in each ticker group
 */

export function getCompanyName(ticker: string, keywords: string[]): string {
  // If we have keywords, use the first one as the company name
  // Remove common suffixes like "login", "register", "sign up", etc.
  if (keywords && keywords.length > 0) {
    const firstKeyword = keywords[0].trim();
    
    // Common suffixes to remove
    const suffixes = [
      ' login',
      ' register',
      ' sign up',
      ' signup',
      ' cloud',
      ' ads',
      ' subscription',
      ' pricing',
      ' cost',
      ' price',
    ];
    
    let companyName = firstKeyword;
    for (const suffix of suffixes) {
      if (companyName.toLowerCase().endsWith(suffix.toLowerCase())) {
        companyName = companyName.slice(0, -suffix.length).trim();
        break;
      }
    }
    
    // Capitalize first letter of each word
    return companyName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Fallback: return ticker symbol if no keywords
  return ticker;
}
