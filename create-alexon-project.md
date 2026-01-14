# Creating alexongeopol Vercel Project

## Option 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import your Git repository (same one as geopol-gtrends)
4. Set project name to: `alexongeopol`
5. Vercel will automatically create the domain: `alexongeopol.vercel.app`
6. Deploy

## Option 2: Via Vercel CLI

Run these commands in your terminal:

```bash
# Navigate to project directory
cd ~/Dropbox/FinantialScan/GeoPolGTrends

# Link to new project named alexongeopol
vercel link --project alexongeopol

# Deploy to production
vercel --prod
```

## Option 3: Create New Project via CLI

```bash
cd ~/Dropbox/FinantialScan/GeoPolGTrends

# Create new project
vercel --prod --name alexongeopol --yes
```

## After Deployment

Once deployed, the middleware (`src/middleware.ts`) will automatically:
- Detect requests to `alexongeopol.vercel.app`
- Route them to the `/alexon` page
- Show only the "Interesting" category
- Hide all buttons and controls

## Verify

Visit: https://alexongeopol.vercel.app

You should see the simplified page with only the "Interesting" category keywords.








