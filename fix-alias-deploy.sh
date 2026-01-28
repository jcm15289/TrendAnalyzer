#!/bin/bash
set -e

echo "🔗 Fixing alias by deploying fresh to production..."
echo ""

# Get version and timestamp
VERSION=$(node -p "require('./package.json').version")
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S %Z")

echo "🚀 DEPLOYMENT INFO:"
echo "Version: $VERSION"
echo "Timestamp: $TIMESTAMP"
echo "---"

# Stage and commit any changes
echo "📦 Staging changes..."
git add -A

# Check if there are changes
if [ -n "$(git status --porcelain)" ]; then
    echo "💾 Committing changes..."
    git commit -m "Deploy v$VERSION - $TIMESTAMP: Force production deployment to fix alias" || true
    echo "📤 Pushing to GitHub..."
    git push origin main || true
else
    echo "✅ No changes to commit"
fi

echo ""
echo "🚀 Deploying to Vercel Production..."
echo "This will create a new production deployment and update the alias automatically"
echo ""

# Deploy to production - this should automatically update the alias
vercel --prod --yes

echo ""
echo "✅ Deployment complete!"
echo "The alias trends-analyzer.vercel.app should now point to the latest deployment"
echo "Wait 1-2 minutes for DNS propagation, then check: https://trends-analyzer.vercel.app"
