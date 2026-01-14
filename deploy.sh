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
    echo "⚠️  No changes to commit"
    exit 0
fi

# Stage all changes
echo "📦 Staging changes..."
git add -A

# Commit with version and timestamp
echo "💾 Committing changes..."
git commit -m "Deploy v$VERSION - $TIMESTAMP: Add stock API button with version tracking"

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push origin main

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod --yes

echo "✅ Deployment complete!"
echo "Version: $VERSION"
echo "Timestamp: $TIMESTAMP"
