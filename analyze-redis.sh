#!/bin/bash

# Redis Database Analysis Script
# Shows all files, sizes, and total database size

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BRIGHT='\033[1m'
NC='\033[0m' # No Color

# Redis URL
REDIS_URL="redis://default:gxrWrXy1C5QJxXjO0sQzAh8JddnAm3il@redis-18997.c289.us-west-1-2.ec2.redns.redis-cloud.com:18997"

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

print_color "🔍 Redis Database Analysis" "$BRIGHT"
print_color "=========================" "$BRIGHT"
echo ""

# Get all keys
print_color "📋 Fetching all keys from Redis..." "$CYAN"
ALL_KEYS=$(/usr/local/bin/redis-cli -u "$REDIS_URL" --scan --pattern "*" 2>/dev/null | sort)

if [ -z "$ALL_KEYS" ]; then
    print_color "❌ No keys found in Redis database" "$RED"
    exit 1
fi

# Count total keys
TOTAL_KEYS=$(echo "$ALL_KEYS" | wc -l | tr -d ' ')
print_color "📊 Total Keys Found: $TOTAL_KEYS" "$GREEN"
echo ""

# Initialize counters
CACHE_TRENDS_COUNT=0
TRENDS_RUN_COUNT=0
GUI_KEYWORDS_COUNT=0
OTHER_COUNT=0
TOTAL_SIZE=0

print_color "📁 Key Categories:" "$BRIGHT"
echo ""

# Process each key
while IFS= read -r key; do
    if [ -n "$key" ]; then
        # Get key size
        KEY_SIZE=$(/usr/local/bin/redis-cli -u "$REDIS_URL" STRLEN "$key" 2>/dev/null)
        if [ -z "$KEY_SIZE" ] || [ "$KEY_SIZE" = "0" ]; then
            KEY_SIZE=0
        fi
        
        # Add to total size
        TOTAL_SIZE=$((TOTAL_SIZE + KEY_SIZE))
        
        # Categorize keys
        if [[ "$key" == cache-trends:* ]]; then
            ((CACHE_TRENDS_COUNT++))
            print_color "   🔄 $key ($(numfmt --to=iec $KEY_SIZE))" "$YELLOW"
        elif [[ "$key" == trends-run:* ]]; then
            ((TRENDS_RUN_COUNT++))
            print_color "   📈 $key ($(numfmt --to=iec $KEY_SIZE))" "$BLUE"
        elif [[ "$key" == gui-keywords ]]; then
            ((GUI_KEYWORDS_COUNT++))
            print_color "   🎯 $key ($(numfmt --to=iec $KEY_SIZE))" "$GREEN"
        else
            ((OTHER_COUNT++))
            print_color "   ❓ $key ($(numfmt --to=iec $KEY_SIZE))" "$RED"
        fi
    fi
done <<< "$ALL_KEYS"

echo ""
print_color "📊 Summary by Category:" "$BRIGHT"
print_color "=======================" "$BRIGHT"
print_color "🔄 Cache Trends: $CACHE_TRENDS_COUNT keys" "$YELLOW"
print_color "📈 Trends Run: $TRENDS_RUN_COUNT keys" "$BLUE"
print_color "🎯 GUI Keywords: $GUI_KEYWORDS_COUNT keys" "$GREEN"
print_color "❓ Other: $OTHER_COUNT keys" "$RED"
echo ""

# Calculate total size in human readable format
TOTAL_SIZE_HR=$(numfmt --to=iec $TOTAL_SIZE)
print_color "💾 Total Database Size: $TOTAL_SIZE_HR ($TOTAL_SIZE bytes)" "$BRIGHT"

# Get Redis info
print_color "" "$NC"
print_color "🔧 Redis Server Info:" "$BRIGHT"
print_color "====================" "$BRIGHT"

# Get memory usage
MEMORY_USAGE=$(/usr/local/bin/redis-cli -u "$REDIS_URL" INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
if [ -n "$MEMORY_USAGE" ]; then
    print_color "💾 Memory Usage: $MEMORY_USAGE" "$CYAN"
fi

# Get database size
DB_SIZE=$(/usr/local/bin/redis-cli -u "$REDIS_URL" DBSIZE 2>/dev/null)
if [ -n "$DB_SIZE" ]; then
    print_color "📊 Database Size: $DB_SIZE keys" "$CYAN"
fi

# Get Redis version
REDIS_VERSION=$(/usr/local/bin/redis-cli -u "$REDIS_URL" INFO server 2>/dev/null | grep "redis_version" | cut -d: -f2 | tr -d '\r')
if [ -n "$REDIS_VERSION" ]; then
    print_color "🔧 Redis Version: $REDIS_VERSION" "$CYAN"
fi

echo ""
print_color "✅ Analysis Complete!" "$GREEN"










