#!/bin/bash
set -e

echo "=== Vercel Alexon Project Setup ==="
echo ""

# Determine project directory
if [ -d "$HOME/Dropbox/FinantialScan/GeoPolGTrends" ]; then
    cd "$HOME/Dropbox/FinantialScan/GeoPolGTrends"
elif [ -d "/Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends" ]; then
    cd "/Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends"
else
    echo "ERROR: Project directory not found"
    exit 1
fi

echo "Working directory: $(pwd)"
echo ""

# Step 1: Link to alexongeopol project
echo "Step 1: Linking to Vercel project 'alexongeopol'..."
vercel link --yes --project alexongeopol --scope team_ikNaPetPQUbV8ngxnEjXcujg

echo ""
echo "Step 2: Deploying to production..."
vercel --prod --yes

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Project should be available at: https://alexongeopol.vercel.app"
echo "The middleware will route this domain to /alexon page"








