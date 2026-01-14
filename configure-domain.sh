#!/bin/bash

# Configure alexongeopol.vercel.app domain
cd /Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends

echo "Deploying to production..."
vercel --prod

echo ""
echo "Getting production URL..."
PROD_URL=$(vercel inspect --json 2>/dev/null | grep -o '"production":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$PROD_URL" ]; then
    echo "Could not get production URL. Trying alternative method..."
    PROD_URL="geopol-gtrends.vercel.app"
fi

echo "Production URL: $PROD_URL"
echo ""
echo "Adding alias alexongeopol.vercel.app..."
vercel alias "$PROD_URL" alexongeopol.vercel.app --scope team_ikNaPetPQUbV8ngxnEjXcujg 2>&1

echo ""
echo "Domain configuration complete!"
echo "The domain alexongeopol.vercel.app should now point to your deployment."








