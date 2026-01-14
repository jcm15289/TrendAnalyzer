#!/bin/bash

# Send File to Redis Database - Shell Script Version
# 
# Usage: ./sendfiletoRedis.sh <file_path> [key] [folder] [ttl]
# 
# Examples:
#   ./sendfiletoRedis.sh data.json
#   ./sendfiletoRedis.sh report.pdf my-report reports
#   ./sendfiletoRedis.sh trends.json ai-trends-2024 data 86400

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
DEFAULT_SERVER="https://geopol-gtrends.vercel.app"
# Redis databases
OLD_REDIS_URL="redis://default:gxrWrXy1C5QJxXjO0sQzAh8JddnAm3il@redis-18997.c289.us-west-1-2.ec2.redns.redis-cloud.com:18997"
NEW_REDIS_URL="redis://default:3oXlvgRqAf5gGtWErDiLFlrBrMCAgTzO@redis-14969.c15.us-east-1-4.ec2.cloud.redislabs.com:14969"
DEFAULT_FOLDER="files"
DEFAULT_TTL="604800"  # 7 days

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Function to show help
show_help() {
    print_color "Send File to Redis Database" "$BRIGHT"
    echo ""
    echo "Usage:"
    echo "  ./sendfiletoRedis.sh <file_path> [key] [folder] [ttl]"
    echo ""
    echo "Arguments:"
    echo "  file_path    Path to the file to upload"
    echo "  key          Redis key (default: filename)"
    echo "  folder       Redis folder prefix (default: files)"
    echo "  ttl          Time to live in seconds (default: 604800 = 7 days)"
    echo ""
    echo "Examples:"
    echo "  ./sendfiletoRedis.sh data.json"
    echo "  ./sendfiletoRedis.sh report.pdf my-report reports"
    echo "  ./sendfiletoRedis.sh trends.json ai-trends-2024 data 86400"
    echo ""
    echo "TTL Examples:"
    echo "  3600     = 1 hour"
    echo "  86400    = 1 day"
    echo "  604800   = 7 days (default)"
    echo "  2592000  = 30 days"
    echo ""
    echo "Prerequisites:"
    echo "  1. Development server running: npm run dev"
    echo "  2. Redis connection configured"
    echo ""
}

# Function to format file size
format_size() {
    local bytes=$1
    if [ $bytes -eq 0 ]; then
        echo "0 Bytes"
    elif [ $bytes -lt 1024 ]; then
        echo "${bytes} Bytes"
    elif [ $bytes -lt 1048576 ]; then
        echo "$(echo "scale=2; $bytes/1024" | bc) KB"
    elif [ $bytes -lt 1073741824 ]; then
        echo "$(echo "scale=2; $bytes/1048576" | bc) MB"
    else
        echo "$(echo "scale=2; $bytes/1073741824" | bc) GB"
    fi
}

# Function to format TTL
format_ttl() {
    local seconds=$1
    if [ $seconds -lt 60 ]; then
        echo "${seconds} seconds"
    elif [ $seconds -lt 3600 ]; then
        echo "$(echo "scale=0; $seconds/60" | bc) minutes"
    elif [ $seconds -lt 86400 ]; then
        echo "$(echo "scale=0; $seconds/3600" | bc) hours"
    else
        echo "$(echo "scale=0; $seconds/86400" | bc) days"
    fi
}

# Check if help is requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ] || [ $# -eq 0 ]; then
    show_help
    exit 0
fi

# Parse arguments
FILE_PATH="$1"
KEY="${2:-$(basename "$FILE_PATH")}"
FOLDER="${3:-$DEFAULT_FOLDER}"
TTL="${4:-$DEFAULT_TTL}"

# Check if file exists
if [ ! -f "$FILE_PATH" ]; then
    print_color "❌ Error: File not found: $FILE_PATH" "$RED"
    exit 1
fi

# Get file info
FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null)
FILE_EXT="${FILE_PATH##*.}"
FILE_CREATED=$(stat -f%B "$FILE_PATH" 2>/dev/null || stat -c%W "$FILE_PATH" 2>/dev/null)
FILE_MODIFIED=$(stat -f%m "$FILE_PATH" 2>/dev/null || stat -c%Y "$FILE_PATH" 2>/dev/null)
UPLOAD_TIME=$(date +%s)

print_color "🚀 Send File to Redis Database" "$BRIGHT"
echo ""
print_color "📤 Uploading file to Redis..." "$BLUE"
echo "   File: $FILE_PATH"
echo "   Size: $(format_size $FILE_SIZE)"
echo "   Key: $FOLDER:$KEY"
echo "   TTL: $(format_ttl $TTL)"
echo "   Server: $DEFAULT_SERVER"
echo "   File Created: $(date -r $FILE_CREATED 2>/dev/null || date -d @$FILE_CREATED 2>/dev/null || echo 'Unknown')"
echo "   File Modified: $(date -r $FILE_MODIFIED 2>/dev/null || date -d @$FILE_MODIFIED 2>/dev/null || echo 'Unknown')"
echo "   Upload Time: $(date -r $UPLOAD_TIME 2>/dev/null || date -d @$UPLOAD_TIME 2>/dev/null || echo 'Unknown')"
echo ""

# Test server connection
print_color "🔍 Testing server connection..." "$YELLOW"
if curl -s "$DEFAULT_SERVER/api/redis/list?folder=test&pattern=*" > /dev/null; then
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
    RESPONSE=$(curl -s -X PUT "$DEFAULT_SERVER/api/redis/upload" \
        -H "Content-Type: application/json" \
        -d "{
            \"data\": $(cat "$FILE_PATH"),
            \"key\": \"$KEY\",
            \"folder\": \"$FOLDER\",
            \"ttl\": $TTL,
            \"metadata\": {
                \"fileCreated\": \"$(date -r $FILE_CREATED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -d @$FILE_CREATED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo 'Unknown')\",
                \"fileModified\": \"$(date -r $FILE_MODIFIED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -d @$FILE_MODIFIED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo 'Unknown')\",
                \"uploadTime\": \"$(date -r $UPLOAD_TIME -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -d @$UPLOAD_TIME -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo 'Unknown')\",
                \"originalPath\": \"$FILE_PATH\",
                \"fileSize\": $FILE_SIZE
            }
        }")
else
    print_color "📁 Uploading as file..." "$CYAN"
    
    # Upload as file
    RESPONSE=$(curl -s -X POST "$DEFAULT_SERVER/api/redis/upload" \
        -F "file=@$FILE_PATH" \
        -F "key=$KEY" \
        -F "folder=$FOLDER" \
        -F "ttl=$TTL" \
        -F "metadata={\"fileCreated\":\"$(date -r $FILE_CREATED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -d @$FILE_CREATED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo 'Unknown')\",\"fileModified\":\"$(date -r $FILE_MODIFIED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -d @$FILE_MODIFIED -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo 'Unknown')\",\"uploadTime\":\"$(date -r $UPLOAD_TIME -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || date -d @$UPLOAD_TIME -u +%Y-%m-%dT%H:%M:%S.000Z 2>/dev/null || echo 'Unknown')\",\"originalPath\":\"$FILE_PATH\",\"fileSize\":$FILE_SIZE}")
fi

# Check response
HTTP_SUCCESS=0
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_color "✅ Upload to HTTP API successful!" "$GREEN"
    HTTP_SUCCESS=1
    
    # Extract key from response
    REDIS_KEY=$(echo "$RESPONSE" | grep -o '"key":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$REDIS_KEY" ]; then
        echo "   Redis Key: $REDIS_KEY"
    fi
    
    # Extract size from response
    SIZE=$(echo "$RESPONSE" | grep -o '"size":[0-9]*' | cut -d':' -f2)
    if [ -n "$SIZE" ]; then
        echo "   Size: $(format_size $SIZE)"
    fi
    
    # Extract TTL from response
    RESPONSE_TTL=$(echo "$RESPONSE" | grep -o '"ttl":[0-9]*' | cut -d':' -f2)
    if [ -n "$RESPONSE_TTL" ]; then
        echo "   TTL: $(format_ttl $RESPONSE_TTL)"
    fi
else
    print_color "❌ Upload to HTTP API failed" "$RED"
    echo "Response: $RESPONSE"
fi

# Also upload directly to new Redis database
if command -v /usr/local/bin/redis-cli &> /dev/null; then
    REDIS_KEY_NEW="${FOLDER}:${KEY}"
    print_color "📤 Uploading to new Redis database..." "$CYAN"
    REDIS_RESULT=$(base64 -i "$FILE_PATH" | /usr/local/bin/redis-cli -u "$NEW_REDIS_URL" -x SET "$REDIS_KEY_NEW" 2>&1)
    if echo "$REDIS_RESULT" | grep -q "^OK$"; then
        print_color "✅ Upload to new Redis database successful!" "$GREEN"
        # Set metadata
        METADATA="{\"filename\":\"$(basename "$FILE_PATH")\",\"uploadedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"size\":$FILE_SIZE}"
        /usr/local/bin/redis-cli -u "$NEW_REDIS_URL" SET "${REDIS_KEY_NEW}:metadata" "$METADATA" >/dev/null 2>&1
        echo "   Redis Key: $REDIS_KEY_NEW"
    else
        print_color "❌ Upload to new Redis database failed!" "$RED"
        print_color "Error: $REDIS_RESULT" "$RED"
    fi
else
    print_color "⚠️  redis-cli not available - skipping direct Redis upload" "$YELLOW"
fi

echo ""
if [ $HTTP_SUCCESS -eq 1 ]; then
    print_color "🎉 Upload completed successfully!" "$GREEN"
    if [ -n "$REDIS_KEY" ]; then
        echo "   Your file is now stored in Redis with key: $REDIS_KEY"
    fi
else
    print_color "⚠️  HTTP API upload failed, but direct Redis upload may have succeeded" "$YELLOW"
fi
    
    # List files in the folder
    echo ""
    print_color "📋 Listing files in folder '$FOLDER'..." "$YELLOW"
    LIST_RESPONSE=$(curl -s "$DEFAULT_SERVER/api/redis/list?folder=$FOLDER&pattern=*")
    
    if echo "$LIST_RESPONSE" | grep -q '"success":true'; then
        COUNT=$(echo "$LIST_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
        print_color "✅ Found $COUNT files in folder '$FOLDER'" "$GREEN"
    else
        print_color "⚠️  Could not list files" "$YELLOW"
    fi
    
# Check if new Redis upload succeeded
NEW_REDIS_SUCCESS=0
if command -v /usr/local/bin/redis-cli &> /dev/null; then
    if /usr/local/bin/redis-cli -u "$NEW_REDIS_URL" EXISTS "$REDIS_KEY_NEW" >/dev/null 2>&1; then
        NEW_REDIS_SUCCESS=1
    fi
fi

# Exit with success if at least one upload succeeded
if [ $HTTP_SUCCESS -eq 1 ] || [ $NEW_REDIS_SUCCESS -eq 1 ]; then
    exit 0
else
    echo ""
    echo "Common issues:"
    echo "  1. Redis connection not configured"
    echo "  2. Development server not running"
    echo "  3. Invalid file format"
    echo "  4. Redis server not accessible"
    exit 1
fi
