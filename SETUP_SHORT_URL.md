# Setting Up Shorter URL for TrendAnalyzer

## Current Situation

Your project is deployed at:
- **Long URL:** `https://trend-analyzer-eo2nj3lwa-julio-casals-projects.vercel.app`
- **Desired URL:** `trendanalyzer.vercel.app` (already in use by another project)

## Options

### Option 1: Use Default Vercel URL (Recommended)

The default production URL for your project should be:
- **`https://trend-analyzer.vercel.app`**

However, this might not be active yet. To activate it:

1. Go to Vercel Dashboard: https://vercel.com/julio-casals-projects/trend-analyzer
2. Navigate to **Settings** → **Domains**
3. The default `trend-analyzer.vercel.app` should be listed there
4. If not active, Vercel will activate it automatically on the next deployment

### Option 2: Add Custom Domain via Dashboard

1. Go to: https://vercel.com/julio-casals-projects/trend-analyzer/settings/domains
2. Click **"Add Domain"**
3. Enter: `trendanalyzer.vercel.app`
4. If it's already taken by another project, you'll need to:
   - Remove it from the other project first, OR
   - Use a different name like `trendanalyzer-app.vercel.app`

### Option 3: Remove Old Alias and Reassign (If you have access)

If `trendanalyzer.vercel.app` belongs to an old project you own:

1. Find the project using that domain
2. Go to that project's Settings → Domains
3. Remove `trendanalyzer.vercel.app`
4. Then add it to the new `trend-analyzer` project

### Option 4: Use Alternative Short Name

You could use:
- `trendanalyzer-app.vercel.app`
- `trend-analyzer-app.vercel.app`
- `trendanalyzer-new.vercel.app`

## Quick Fix: Check Default URL

Try accessing: **https://trend-analyzer.vercel.app**

If it works, that's your shorter URL! If not, the next deployment should activate it automatically.

## Via Vercel Dashboard (Easiest)

1. Visit: https://vercel.com/julio-casals-projects/trend-analyzer/settings/domains
2. Check if `trend-analyzer.vercel.app` is listed (it should be)
3. If you want `trendanalyzer.vercel.app` specifically, you'll need to remove it from the other project first
