#!/bin/bash
set -e

# Get version and timestamp
VERSION=$(node -p "require('./package.json').version")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S %Z")

echo "🚀 DEPLOYMENT INFO:"
echo "Version: $VERSION"
echo "Timestamp: $TIMESTAMP"
echo "---"

# Check for changes
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  No changes to commit, deploying existing code..."
    # Continue to deploy even if no changes
fi

# Stage all changes
echo "📦 Staging changes..."
git add -A

# Commit with version and timestamp
echo "💾 Committing changes..."
git commit -m "Deploy v$VERSION - $TIMESTAMP: ALLSYMS-based ticker trends with multi-line charts" || echo "No changes to commit"

# Push to GitHub (this will trigger Vercel deployment automatically if GitHub integration is enabled)
echo "📤 Pushing to GitHub..."
git push origin main

# Note: If Vercel is connected to GitHub, the push above will automatically trigger a deployment.
# Only run vercel --prod --yes if you want to force a manual deployment instead.
# Uncomment the line below if GitHub integration is NOT enabled:
# echo "🚀 Deploying to Vercel..."
# vercel --prod --yes

echo "✅ Deployment complete!"
echo "Version: $VERSION"
echo "Timestamp: $TIMESTAMP"
