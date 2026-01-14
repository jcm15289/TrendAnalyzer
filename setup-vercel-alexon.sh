#!/bin/bash

# Setup Vercel project for alexongeopol.vercel.app

echo "=========================================="
echo "Setting up Vercel project: alexongeopol"
echo "=========================================="
echo ""

# Find the correct directory
if [ -d "$HOME/Dropbox/FinantialScan/GeoPolGTrends" ]; then
    PROJECT_DIR="$HOME/Dropbox/FinantialScan/GeoPolGTrends"
elif [ -d "/Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends" ]; then
    PROJECT_DIR="/Users/juliocasalmartin/Library/CloudStorage/Dropbox/FinantialScan/GeoPolGTrends"
else
    echo "Error: Could not find GeoPolGTrends directory"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "Current directory: $(pwd)"
echo ""

# Check if .vercel directory exists
if [ ! -d ".vercel" ]; then
    echo "Creating .vercel directory..."
    mkdir -p .vercel
fi

# Check current Vercel project
echo "Current Vercel project configuration:"
if [ -f ".vercel/project.json" ]; then
    cat .vercel/project.json
    echo ""
else
    echo "No project.json found"
    echo ""
fi

# Link to new project
echo "Linking to Vercel project 'alexongeopol'..."
echo "This will create a new project or link to existing one."
echo ""

vercel link --yes --project alexongeopol 2>&1

echo ""
echo "Deploying to production..."
vercel --prod --yes 2>&1

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Your project should now be available at:"
echo "https://alexongeopol.vercel.app"
echo ""
echo "The middleware will automatically route this domain"
echo "to the simplified /alexon page."








