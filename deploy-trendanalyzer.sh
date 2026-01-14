#!/bin/bash

# Deployment script for TrendAnalyzer Vercel project
# This script helps deploy TrendAnalyzer to a new Vercel instance

set -e

PROJECT_DIR="/Users/juliocasalmartin/Library/CloudStorage/Dropbox/Julio/TrendAnalyzer"
PROJECT_NAME="TrendAnalyzer"

echo "🚀 TrendAnalyzer Deployment Script"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the TrendAnalyzer directory."
    exit 1
fi

cd "$PROJECT_DIR"

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if Git is initialized
if [ ! -d ".git" ]; then
    echo "⚠️  Git repository not initialized. Initializing..."
    git init
fi

# Check Git remote
if ! git remote | grep -q origin; then
    echo "⚠️  No Git remote found. You'll need to add one:"
    echo "   git remote add origin <YOUR_REPOSITORY_URL>"
    echo ""
    read -p "Do you want to continue with Vercel deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if .vercel exists (should not, but just in case)
if [ -d ".vercel" ]; then
    echo "⚠️  Found existing .vercel directory. Removing it..."
    rm -rf .vercel
fi

echo "📦 Linking to Vercel project: $PROJECT_NAME"
echo ""

# Link to Vercel project
vercel link --yes --project "$PROJECT_NAME" 2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully linked to Vercel project: $PROJECT_NAME"
else
    echo ""
    echo "⚠️  Link command had issues. You may need to:"
    echo "   1. Create the project in Vercel dashboard first, OR"
    echo "   2. Run: vercel link (and follow prompts)"
    echo ""
    read -p "Do you want to try deploying anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🚀 Deploying to Vercel..."
echo ""

# Deploy to production
vercel --prod --yes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Check your Vercel dashboard for the deployment URL"
    echo "   2. Configure environment variables in Vercel project settings"
    echo "   3. Test the deployed application"
    echo ""
    echo "🌐 Your project should be available at: https://trend-analyzer.vercel.app"
    echo "   (or check Vercel dashboard for exact URL)"
else
    echo ""
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi
