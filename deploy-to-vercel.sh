#!/bin/bash
set -e

echo "=========================================="
echo "Deploying to geopol-gtrends.vercel.app"
echo "=========================================="
echo ""

cd /Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends || cd ~/Dropbox/FinantialScan/GeoPolGTrends

echo "Current directory: $(pwd)"
echo ""

echo "Step 1: Building project..."
npm run build 2>&1 | tail -20
echo ""

echo "Step 2: Deploying to Vercel production..."
vercel --prod --yes 2>&1

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="








