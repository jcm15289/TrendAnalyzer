#!/bin/bash

# Send File to Vercel Blob Storage - Shell Script Version
# 
# Usage: ./sendfiletoVercel.sh <file_path> [folder] [filename]
# 
# Examples:
#   ./sendfiletoVercel.sh data.json
#   ./sendfiletoVercel.sh report.pdf reports
#   ./sendfiletoVercel.sh trends.json trends-data ai-trends-2024.json

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BRIGHT='\033[1m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_SERVER="http://localhost:9002"
DEFAULT_FOLDER="trends-data"

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to show help
show_help() {
    print_color "Send File to Vercel Blob Storage" "$BRIGHT"
    echo ""
    echo "Usage:"
    echo "  ./sendfiletoVercel.sh <file_path> [folder] [filename]"
    echo ""
    echo "Arguments:"
    echo "  file_path    Path to the file to upload"
    echo "  folder       Target folder in blob storage (default: trends-data)"
    echo "  filename     Custom filename (default: original filename)"
    echo ""
    echo "Examples:"
    echo "  ./sendfiletoVercel.sh data.json"
    echo "  ./sendfiletoVercel.sh report.pdf reports"
    echo "  ./sendfiletoVercel.sh trends.json trends-data ai-trends-2024.json"
    echo ""
    echo "Prerequisites:"
    echo "  1. Development server running: npm run dev"
    echo "  2. BLOB_READ_WRITE_TOKEN set in .env.local"
    echo ""
}

# Check if help is requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ $# -eq 0 ]; then
    show_help
    exit 0
fi

# Parse arguments
FILE_PATH="$1"
FOLDER="${2:-$DEFAULT_FOLDER}"
FILENAME="${3:-$(basename "$FILE_PATH")}"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    print_color "❌ Error: File not found: $FILE_PATH" "$RED"
    exit 1
fi

# Get file info
FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null)
FILE_EXT="${FILE_PATH##*.}"

print_color "🚀 Send File to Vercel Blob Storage" "$BRIGHT"
echo ""
print_color "📤 Uploading file..." "$BLUE"
echo "   File: $FILE_PATH"
echo "   Size: $FILE_SIZE bytes"
echo "   Target: $FOLDER/$FILENAME"
echo "   Server: $DEFAULT_SERVER"
echo ""

# Test server connection
print_color "🔍 Testing server connection..." "$YELLOW"
if curl -s "$DEFAULT_SERVER/api/blob/list?folder=test&limit=1" > /dev/null; then
    print_color "✅ Server is running" "$GREEN"
else
    print_color "❌ Cannot connect to server" "$RED"
    echo "   Make sure the development server is running: npm run dev"
    exit 1
fi

echo ""

# Determine upload method based on file type
if [ "$FILE_EXT" = "json" ]; then
    print_color "📋 Uploading as JSON data..." "$CYAN"
    
    # Upload as JSON
    RESPONSE=$(curl -s -X PUT "$DEFAULT_SERVER/api/blob/upload" \
        -H "Content-Type: application/json" \
        -d "{
            \"data\": $(cat "$FILE_PATH"),
            \"filename\": \"$FILENAME\",
            \"folder\": \"$FOLDER\"
        }")
else
    print_color "📁 Uploading as file..." "$CYAN"
    
    # Upload as file
    RESPONSE=$(curl -s -X POST "$DEFAULT_SERVER/api/blob/upload" \
        -F "file=@$FILE_PATH" \
        -F "filename=$FILENAME" \
        -F "folder=$FOLDER")
fi

# Check response
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_color "✅ Upload successful!" "$GREEN"
    
    # Extract URL from response
    URL=$(echo "$RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$URL" ]; then
        echo "   URL: $URL"
    fi
    
    # Extract size from response
    SIZE=$(echo "$RESPONSE" | grep -o '"size":[0-9]*' | cut -d':' -f2)
    if [ -n "$SIZE" ]; then
        echo "   Size: $SIZE bytes"
    fi
    
    echo ""
    print_color "🎉 Upload completed successfully!" "$GREEN"
    if [ -n "$URL" ]; then
        echo "   You can access your file at: $URL"
    fi
else
    print_color "❌ Upload failed" "$RED"
    echo "Response: $RESPONSE"
    echo ""
    echo "Common issues:"
    echo "  1. BLOB_READ_WRITE_TOKEN not set in .env.local"
    echo "  2. Development server not running"
    echo "  3. Invalid file format"
    exit 1
fi

