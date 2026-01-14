# TrendAnalyzer Deployment Guide

This guide will help you deploy TrendAnalyzer to a new Vercel instance and set up a new Git repository.

## Prerequisites

- Node.js installed
- Vercel CLI installed (`npm i -g vercel`)
- Git installed
- A GitHub/GitLab/Bitbucket account (for remote repository)

## Step 1: Create a New Git Repository

### Option A: Create on GitHub/GitLab/Bitbucket first
1. Go to your Git hosting service
2. Create a new repository named `TrendAnalyzer` (or `trend-analyzer`)
3. **DO NOT** initialize with README, .gitignore, or license (we already have these)

### Option B: Initialize locally first (current approach)
The Git repository has been initialized locally. You'll need to:
1. Create a remote repository on your Git hosting service
2. Add the remote and push

## Step 2: Initial Git Commit

```bash
cd /Users/juliocasalmartin/Library/CloudStorage/Dropbox/Julio/TrendAnalyzer

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: TrendAnalyzer project"

# Add remote repository (replace with your actual repository URL)
git remote add origin <YOUR_REPOSITORY_URL>

# Push to remote
git push -u origin main
```

**Note:** If your default branch is `master` instead of `main`, use:
```bash
git branch -M main  # Rename branch to main if needed
git push -u origin main
```

## Step 3: Create New Vercel Project

### Via Vercel Dashboard (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Import your Git repository (the new TrendAnalyzer repository)
4. Configure the project:
   - **Project Name:** `TrendAnalyzer` (or `trend-analyzer`)
   - **Framework Preset:** Next.js (should auto-detect)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)
5. Add Environment Variables (if needed):
   - Go to Project Settings → Environment Variables
   - Add any required environment variables (check your `.env.example` or existing config)
6. Click "Deploy"

### Via Vercel CLI (Alternative)
```bash
cd /Users/juliocasalmartin/Library/CloudStorage/Dropbox/Julio/TrendAnalyzer

# Login to Vercel (if not already logged in)
vercel login

# Link to new project
vercel link

# When prompted:
# - Set up and deploy? Yes
# - Which scope? [Select your account/team]
# - Link to existing project? No
# - Project name? TrendAnalyzer
# - Directory? ./
# - Override settings? No

# Deploy to production
vercel --prod
```

## Step 4: Verify Deployment

After deployment, your project will be available at:
- **Production URL:** `https://trend-analyzer.vercel.app` (or similar)
- Check the Vercel dashboard for the exact URL

## Step 5: Environment Variables

Make sure to configure all required environment variables in Vercel:
1. Go to Project Settings → Environment Variables
2. Add variables for:
   - Redis/KV connection strings (if using)
   - Blob storage credentials (if using)
   - Any API keys
   - Other environment-specific settings

**Important:** These should be separate from your `geopol-gtrends` project variables.

## Step 6: Continuous Deployment

Once connected to Git, Vercel will automatically deploy:
- Every push to `main` branch → Production
- Every push to other branches → Preview deployments

## Troubleshooting

### If you see errors related to the old project:
- Make sure `.vercel` directory is removed (already done)
- Verify `vercel.json` has `"name": "TrendAnalyzer"`
- Check that you're linking to the correct project

### If deployment fails:
- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Ensure `package.json` scripts are correct
- Check that all dependencies are listed in `package.json`

## Important Notes

✅ **This deployment is completely separate from `geopol-gtrends`**
- Different Vercel project
- Different Git repository
- Different URL
- Independent environment variables

⚠️ **The codebase still contains references to "geopol" in:**
- localStorage keys (won't affect deployment)
- API route keys (may need separate Redis/KV namespaces)
- UI text (can be updated later if needed)

These references won't conflict with the old deployment since they're in separate instances.

## Next Steps

1. ✅ Git repository initialized
2. ✅ Vercel configuration updated
3. ⏭️ Create remote Git repository
4. ⏭️ Push code to remote
5. ⏭️ Deploy to Vercel
6. ⏭️ Configure environment variables
7. ⏭️ Test deployment
