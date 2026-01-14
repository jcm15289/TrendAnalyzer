# Deploy to geopol-gtrends.vercel.app

## Files Ready
✅ src/app/alexon/page.tsx
✅ src/middleware.ts  
✅ All IntelPeak fixes

## Deployment Steps

### Option 1: Via Vercel CLI (Recommended)

Run these commands in your terminal:

```bash
cd ~/Dropbox/FinantialScan/GeoPolGTrends

# Verify you're logged in
vercel whoami

# Deploy to production
vercel --prod --yes
```

### Option 2: Via Git Push (Auto-deploy)

If your Vercel project is connected to Git:

```bash
cd ~/Dropbox/FinantialScan/GeoPolGTrends

# Commit changes
git add .
git commit -m "Add alexon page and middleware"
git push
```

Vercel will automatically deploy when you push to the main branch.

### Option 3: Via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Find project "geopol-gtrends"
3. Click "Redeploy" → "Redeploy" (or trigger a new deployment)

## Verify Deployment

After deployment, check:
- https://geopol-gtrends.vercel.app/ - Main site
- https://geopol-gtrends.vercel.app/alexon - Simplified page (if you want to test it directly)

## Troubleshooting

If deployment fails:
1. Check Vercel CLI is installed: `vercel --version`
2. Check you're logged in: `vercel whoami`
3. Check project is linked: `cat .vercel/project.json`
4. Try: `vercel link` to relink the project








