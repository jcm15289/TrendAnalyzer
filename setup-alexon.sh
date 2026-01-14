#!/bin/bash

# Setup script for alexongeopol.vercel.app
# This script will create/link a Vercel project and deploy it

set -e  # Exit on error

echo "=========================================="
echo "Vercel Alexon Project Setup"
echo "=========================================="
echo ""

# Find project directory
PROJECT_DIR=""
if [ -d "$HOME/Dropbox/FinantialScan/GeoPolGTrends" ]; then
    PROJECT_DIR="$HOME/Dropbox/FinantialScan/GeoPolGTrends"
elif [ -d "/Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends" ]; then
    PROJECT_DIR="/Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends"
else
    echo "ERROR: Could not find GeoPolGTrends directory"
    echo "Please run this script from the project directory"
    exit 1
fi

cd "$PROJECT_DIR"
echo "✓ Working directory: $(pwd)"
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "ERROR: Vercel CLI not found"
    echo "Install it with: npm i -g vercel"
    exit 1
fi

echo "✓ Vercel CLI found: $(vercel --version)"
echo ""

# Step 1: Link to alexongeopol project
echo "Step 1: Linking to Vercel project 'alexongeopol'..."
echo "----------------------------------------"
vercel link --yes --project alexongeopol --scope team_ikNaPetPQUbV8ngxnEjXcujg 2>&1
LINK_EXIT_CODE=$?

if [ $LINK_EXIT_CODE -eq 0 ]; then
    echo "✓ Successfully linked to alexongeopol project"
else
    echo "⚠ Link command exited with code $LINK_EXIT_CODE"
    echo "This might be okay if the project already exists"
fi
echo ""

# Step 2: Deploy to production
echo "Step 2: Deploying to production..."
echo "----------------------------------------"
vercel --prod --yes 2>&1
DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
    echo "✓ Deployment successful"
else
    echo "⚠ Deployment exited with code $DEPLOY_EXIT_CODE"
fi
echo ""

# Summary
echo "=========================================="
echo "Setup Summary"
echo "=========================================="
echo ""
echo "Project should be available at:"
echo "  https://alexongeopol.vercel.app"
echo ""
echo "The middleware will automatically route this domain"
echo "to the simplified /alexon page showing only the"
echo "'Interesting' category."
echo ""
echo "To verify, visit: https://alexongeopol.vercel.app"
echo ""








