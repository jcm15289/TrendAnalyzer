#!/bin/bash

# Simple sync script - runs every 5 minutes via cron
# Checks Redis for GUI keyword changes and syncs to local Keywords file
# Uploads newer cache files to Redis
# Fetches missing cache files for keywords in Redis

KEYWORDS_FILE="/Users/jcasal/Google Drive/FinantialScan/TrendKeywords/Keywords"
LOG_FILE="/Users/jcasal/Google Drive/FinantialScan/TrendKeywords/simple-sync.log"
TRENDS_RUN_SCRIPT="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/TrendKeywords/run-trends-and-upload.sh"
LOCK_FILE="/tmp/simple-sync.lock"
CACHE_DIR="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/Cache"
TRENDS_RUN_DIR="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/TrendKeywords"

# Redis connection details
# Always use OLD database (redis-18997) - same as Vercel
REDIS_URL="redis://default:gxrWrXy1C5QJxXjO0sQzAh8JddnAm3il@redis-18997.c289.us-west-1-2.ec2.redns.redis-cloud.com:18997"
# Upload to OLD database only (via HTTP API)
OLD_REDIS_SERVER="https://geopol-gtrends.vercel.app"
OLD_REDIS_URL="redis://default:gxrWrXy1C5QJxXjO0sQzAh8JddnAm3il@redis-18997.c289.us-west-1-2.ec2.redns.redis-cloud.com:18997"
# NEW Redis database (redis-14969)
NEW_REDIS_URL="redis://default:3oXlvgRqAf5gGtWErDiLFlrBrMCAgTzO@redis-14969.c15.us-east-1-4.ec2.cloud.redislabs.com:14969"

# Vercel API endpoint
VERCEL_API_URL="https://geopol-gtrends.vercel.app/api/keywords/sync"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

mkdir -p "$(dirname "$LOG_FILE")"

# Atomic directory-based locking (works on macOS) - MUST BE FIRST BEFORE ANY OUTPUT
LOCK_DIR="/tmp/simple-sync.lock.dir"

# Function to check if lock process is still running
check_lock_process() {
    local lock_pid="$1"
    if [ -z "$lock_pid" ]; then
        return 1  # No PID, process not running
    fi
    # Check if process exists and is actually simple-sync.sh
    if kill -0 "$lock_pid" 2>/dev/null; then
        # Verify it's actually our script (not a reused PID)
        local cmdline=$(ps -p "$lock_pid" -o command= 2>/dev/null)
        if echo "$cmdline" | grep -q "simple-sync.sh"; then
            return 0  # Process is running
        fi
    fi
    return 1  # Process not running or not our script
}

# Try to acquire lock - exit immediately if another instance is running
LOCK_ACQUIRED=0
for i in {1..3}; do
    if mkdir "$LOCK_DIR" 2>/dev/null; then
        # Successfully created lock directory - write PID IMMEDIATELY
        echo $$ > "$LOCK_DIR/pid"
        # Verify PID was written and is still ours (double-check)
        if [ -f "$LOCK_DIR/pid" ] && [ "$(cat "$LOCK_DIR/pid" 2>/dev/null)" = "$$" ]; then
            LOCK_ACQUIRED=1
            break
        else
            # Race condition: another process wrote PID, remove lock and exit
            rm -rf "$LOCK_DIR"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] Lock acquired but PID mismatch - another instance started - exiting" >> "$LOG_FILE"
            exit 0
        fi
    else
        # Lock exists, check if process is still running
        if [ -f "$LOCK_DIR/pid" ]; then
            lock_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null)
            if check_lock_process "$lock_pid"; then
                # Process is still running, exit immediately (no retry)
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another instance is running (PID: $lock_pid) - exiting immediately" >> "$LOG_FILE"
                exit 0
            else
                # Stale lock, remove it and retry once
                rm -rf "$LOCK_DIR"
                sleep 0.2
                continue
            fi
        else
            # Lock directory exists but no PID file - might be in race condition
            # Wait a tiny bit and check again
            sleep 0.1
            if [ -f "$LOCK_DIR/pid" ]; then
                lock_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null)
                if check_lock_process "$lock_pid"; then
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Another instance is running (PID: $lock_pid) - exiting immediately" >> "$LOG_FILE"
                    exit 0
                fi
            fi
            # Still no PID or stale, remove and retry
            rm -rf "$LOCK_DIR"
            sleep 0.2
            continue
        fi
    fi
done

if [ $LOCK_ACQUIRED -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to acquire lock after 3 attempts - exiting" >> "$LOG_FILE"
    exit 0
fi

timestamp_log_output() {
    local line clean_line
    while IFS= read -r line || [ -n "$line" ]; do
        clean_line=$(printf '%s\n' "$line" | perl -pe 's/\r//g; s/\e\[[0-9;]*[[:alpha:]]//g')
        if [[ -z "${clean_line//[[:space:]]/}" ]]; then
            continue
        fi
        # Skip lines containing "Sample data" or "Sample Data"
        if [[ "$clean_line" =~ [Ss]ample[[:space:]]*[Dd]ata ]]; then
            continue
        fi
        # Write directly to file only (don't use tee since stdout is already redirected here)
        # Using tee would create a loop: stdout -> timestamp_log_output -> tee -> stdout -> timestamp_log_output...
        printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$clean_line" >> "$LOG_FILE"
    done
}

exec > >(timestamp_log_output)
exec 2>&1

log_with_timestamp() {
    echo "$1"
}

# Function to upload logs to Redis (can be called from trap handler)
upload_logs_on_exit() {
    # Only upload if we haven't already uploaded (check for a flag file)
    if [ -f "/tmp/simple-sync-logs-uploaded-$$" ]; then
        return 0
    fi
    
    # Mark that we're uploading logs
    touch "/tmp/simple-sync-logs-uploaded-$$"
    
    # Upload logs to both Redis databases
    TRENDS_LOG="/Users/jcasal/Google Drive/FinantialScan/logs/TrendsLog"
    if [ -f "$TRENDS_LOG" ]; then
        upload_logs_to_redis "$TRENDS_LOG" "logs:TrendsLog:last500" "$OLD_REDIS_URL" "OLD Redis" 2>/dev/null || true
        upload_logs_to_redis "$TRENDS_LOG" "logs:TrendsLog:last500" "$NEW_REDIS_URL" "NEW Redis" 2>/dev/null || true
    fi
    
    if [ -f "$LOG_FILE" ]; then
        upload_logs_to_redis "$LOG_FILE" "logs:simple-sync:last500" "$OLD_REDIS_URL" "OLD Redis" 2>/dev/null || true
        upload_logs_to_redis "$LOG_FILE" "logs:simple-sync:last500" "$NEW_REDIS_URL" "NEW Redis" 2>/dev/null || true
fi

    # Clean up flag file
    rm -f "/tmp/simple-sync-logs-uploaded-$$"
}

# Ensure lock is released on exit and upload logs
cleanup_lock() {
    # Upload logs before exiting (if script was interrupted)
    upload_logs_on_exit
    rm -rf "$LOCK_DIR"
}
trap cleanup_lock EXIT INT TERM

# Function to upload log content to Redis (must be defined before trap handler)
upload_logs_to_redis() {
    local log_file="$1"
    local redis_key="$2"
    local redis_url="$3"
    local redis_name="$4"
    
    if [ ! -f "$log_file" ]; then
        log_with_timestamp "  ⚠️  Log file not found: $log_file"
        return 1
    fi
    
    # Create temporary file for JSON
    local temp_json=$(mktemp)
    
    # Create JSON structure with metadata using Python (handles escaping properly)
    local timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
    local line_count=$(tail -500 "$log_file" 2>/dev/null | wc -l | tr -d ' ')
    
    python3 << PYTHON_END > "$temp_json"
import json
import sys

log_file_path = "$log_file"
timestamp_str = "$timestamp"

# Read last 500 lines from log file
try:
    with open(log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        # Get last 500 lines
        log_content = ''.join(lines[-500:])
        actual_line_count = len(lines[-500:])
except Exception as e:
    log_content = f"Error reading log file: {str(e)}"
    actual_line_count = 0

log_data = {
    "metadata": {
        "uploadTime": timestamp_str,
        "source": "simple-sync.sh",
        "lines": actual_line_count,
        "file": log_file_path
    },
    "content": log_content
}

print(json.dumps(log_data, ensure_ascii=False))
PYTHON_END
    
    if [ ! -s "$temp_json" ]; then
        log_with_timestamp "  ❌ Failed to create JSON for $redis_name"
        rm -f "$temp_json"
        return 1
    fi
    
    # Upload to Redis using redis-cli
    if /usr/local/bin/redis-cli -u "$redis_url" -x SET "$redis_key" < "$temp_json" >/dev/null 2>&1; then
        log_with_timestamp "  ✅ Successfully uploaded logs to $redis_name ($redis_key, $line_count lines)"
        rm -f "$temp_json"
        return 0
    else
        log_with_timestamp "  ❌ Failed to upload logs to $redis_name ($redis_key)"
        rm -f "$temp_json"
        return 1
    fi
}

# Log script start
log_with_timestamp "Simple sync script started (PID: $$)"

# Check if Redis CLI is available
if ! command -v /usr/local/bin/redis-cli &> /dev/null; then
    log_with_timestamp "ERROR: redis-cli not found at /usr/local/bin/redis-cli"
    exit 1
fi

# ============================================================================
# CRITICAL: Download keywords from Vercel/Redis FIRST - this is the source of truth
# NEVER update Redis keywords from local sources - only read from Redis
# ============================================================================
log_with_timestamp "Downloading keywords from Vercel/Redis (source of truth)..."

# Get keywords from Redis (Vercel is the source of truth)
keywords_json=$(/usr/local/bin/redis-cli -u "$REDIS_URL" GET "gui-keywords" 2>/dev/null)

if [ -z "$keywords_json" ] || [ "$keywords_json" = "(nil)" ]; then
    log_with_timestamp "ERROR: No keywords found in Redis - cannot proceed without Vercel keyword list"
    exit 1
fi

# Parse keywords from JSON
redis_keywords=$(echo "$keywords_json" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    keywords = data.get('keywords', [])
    for keyword in keywords:
        print(keyword)
except:
    sys.exit(1)
" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$redis_keywords" ]; then
    log_with_timestamp "ERROR: Failed to parse keywords from Redis"
    exit 1
fi

keyword_count=$(echo "$redis_keywords" | wc -l | tr -d ' ')
log_with_timestamp "Downloaded $keyword_count keywords from Vercel/Redis"

# ============================================================================
# IMPORTANT: Always update local Keywords file FROM Redis (never reverse)
# Local Keywords file is only for TrendsRun.pl - Redis is the source of truth
# ============================================================================
log_with_timestamp "Updating local Keywords file from Vercel/Redis (overwriting any local changes)..."

# Create backup of local file if it exists
if [ -f "$KEYWORDS_FILE" ]; then
    cp "$KEYWORDS_FILE" "${KEYWORDS_FILE}.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null
fi

# Always overwrite local Keywords file with Redis data (Redis is source of truth)
cat > "$KEYWORDS_FILE" << EOF
# Keywords file - Synced from Vercel GUI via Redis
# Last updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# Format: one keyword per line
# WARNING: This file is auto-generated from Redis. Do not edit manually.
# Redis is the source of truth - local changes will be overwritten.
EOF

# Add keywords from Redis
echo "$redis_keywords" | while read -r keyword; do
    if [ -n "$keyword" ]; then
        echo "$keyword" >> "$KEYWORDS_FILE"
    fi
done

log_with_timestamp "Local Keywords file updated with $keyword_count keywords from Vercel/Redis"

# Get current local keywords for comparison (after updating from Redis)
local_keywords=""
if [ -f "$KEYWORDS_FILE" ]; then
    local_keywords=$(grep -v '^#' "$KEYWORDS_FILE" | grep -v '^$' | sort)
fi

# Sort Redis keywords for comparison
redis_keywords_sorted=$(echo "$redis_keywords" | sort)

# Function to normalize keyword for file/Redis key lookup
# Converts to lowercase and removes spaces (e.g., "Democracy Decline" -> "democracydecline")
normalize_keyword_for_file() {
    local keyword="$1"
    echo "$keyword" | tr '[:upper:]' '[:lower:]' | tr -d ' '
}

# Function to sync keywords to Vercel
sync_keywords_to_vercel() {
    local keywords_json="$1"
    
    log_with_timestamp "Syncing keywords to Vercel..."
    
    # Parse keywords and keywordSets from JSON
    local keywords_array=$(echo "$keywords_json" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    keywords = data.get('keywords', [])
    keyword_sets = data.get('keywordSets', [])
    
    # If no keywordSets, create single-item sets from keywords list
    if not keyword_sets and keywords:
        keyword_sets = [[k] for k in keywords]
    
    # Output as JSON array of arrays
    print(json.dumps(keyword_sets))
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null)
    
    if [ $? -ne 0 ] || [ -z "$keywords_array" ]; then
        log_with_timestamp "ERROR: Failed to prepare keywords for Vercel sync"
        return 1
    fi
    
    # Send to Vercel API using curl
    local response=$(curl -s -k -X POST "$VERCEL_API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"keywords\": $keywords_array}" \
        -w "\n%{http_code}" 2>/dev/null)
    
    local http_code=$(echo "$response" | tail -1)
    local response_body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        log_with_timestamp "✅ Successfully synced keywords to Vercel (HTTP $http_code)"
        return 0
    else
        log_with_timestamp "⚠️  Failed to sync keywords to Vercel (HTTP $http_code)"
        if [ -n "$response_body" ]; then
            log_with_timestamp "Response: $response_body"
        fi
        return 1
    fi
}

# DISABLED: Do NOT sync keywords to Vercel - this causes Vercel to overwrite Redis with wrong keyword list
# The sync_keywords_to_vercel() function sends keywords to Vercel, which then writes them BACK to Redis,
# overwriting the good keyword list (e.g., 95 good keywords become 583 bad ones)
# log_with_timestamp "Syncing keywords from Redis to Vercel..."
# sync_keywords_to_vercel "$keywords_json"

# Function to upload file to OLD Redis database only (via HTTP API)
upload_to_old_redis() {
    local cache_file="$1"
    local keyword="$2"
    # Normalize keyword: lowercase and remove spaces for Redis key
    local keyword_normalized=$(normalize_keyword_for_file "$keyword")
    local redis_key="Trends.$keyword_normalized"
    
    if [ ! -f "$cache_file" ]; then
        log_with_timestamp "  ❌ Cache file not found: $cache_file"
        return 1
    fi
    
    log_with_timestamp "  Uploading $keyword to OLD Redis DB..."
    
    # Upload via HTTP API to OLD database (with 30 second timeout)
    local response=$(curl -s --max-time 30 -X POST "${OLD_REDIS_SERVER}/api/redis/upload" \
        -F "file=@${cache_file}" \
        -F "key=${redis_key}" \
        -F "folder=cache-trends" \
        -F "ttl=604800" 2>&1)
    
    local curl_exit_code=$?
    
    if [ $curl_exit_code -ne 0 ]; then
        log_with_timestamp "  ❌ Failed to upload $keyword to OLD Redis DB (curl error: $curl_exit_code)"
        log_with_timestamp "  Response: $response"
        return 1
    fi
    
    if echo "$response" | grep -q '"success":true'; then
        log_with_timestamp "  ✅ Successfully uploaded $keyword to OLD Redis DB"
        return 0
    else
        log_with_timestamp "  ❌ Failed to upload $keyword to OLD Redis DB (API returned failure)"
        log_with_timestamp "  Response: $response"
        return 1
    fi
}

# Function to check if cache file is newer than Redis version (check OLD DB)
check_and_upload_newer_cache() {
    local keyword="$1"
    # Normalize keyword: lowercase and remove spaces for file/Redis key lookup
    local keyword_normalized=$(normalize_keyword_for_file "$keyword")
    local cache_file="$CACHE_DIR/Trends.$keyword_normalized"
    local redis_key="cache-trends:Trends.$keyword_normalized"
    
    if [ ! -f "$cache_file" ]; then
        return 1  # Cache file doesn't exist
    fi
    
    # Get cache file modification time
    local cache_mtime=$(stat -f "%m" "$cache_file" 2>/dev/null || echo "0")
    
    # Check if key exists in OLD Redis database
    local redis_exists=$(/usr/local/bin/redis-cli -u "$OLD_REDIS_URL" EXISTS "$redis_key" 2>/dev/null || echo "0")
    
    if [ "$redis_exists" = "0" ]; then
        # No Redis entry in OLD DB, should upload
        log_with_timestamp "  Cache file exists but not in OLD Redis DB: $keyword - uploading"
        return 0
    fi
    
    # Get Redis data from OLD DB (contains both content and metadata)
    local redis_data=$(/usr/local/bin/redis-cli -u "$OLD_REDIS_URL" GET "$redis_key" 2>/dev/null)
    
    if [ -z "$redis_data" ] || [ "$redis_data" = "(nil)" ]; then
        # Redis key exists but data is empty, should upload
        log_with_timestamp "  Cache file has empty Redis entry in OLD DB: $keyword - uploading"
        return 0
    fi
    
    # Parse upload timestamp from Redis metadata
    local redis_upload_time=$(echo "$redis_data" | python3 -c "
import json, sys
from datetime import datetime
try:
    data = json.load(sys.stdin)
    metadata = data.get('metadata', {})
    upload_time_str = metadata.get('uploadTime', metadata.get('fileModified', ''))
    if upload_time_str:
        dt = datetime.fromisoformat(upload_time_str.replace('Z', '+00:00'))
        print(int(dt.timestamp()))
    else:
        print('0')
except:
    print('0')
" 2>/dev/null || echo "0")
    
    # Upload if cache is newer than Redis in OLD DB
    if [ "$cache_mtime" -gt "$redis_upload_time" ]; then
        log_with_timestamp "  Cache file newer than OLD Redis DB for $keyword - uploading"
        return 0
    fi
    
    return 1  # Cache is not newer
}

# Function to fetch missing cache file from Google Trends
fetch_missing_cache() {
    local keyword="$1"
    # Normalize keyword: lowercase and remove spaces for file lookup
    local keyword_normalized=$(normalize_keyword_for_file "$keyword")
    local cache_file="$CACHE_DIR/Trends.$keyword_normalized"
    
    log_with_timestamp "  Fetching Google Trends data for missing cache: $keyword"
    
    cd "$TRENDS_RUN_DIR"
    
    # Create a temporary keywords file with just this keyword
    # Use normalized version for filename (to avoid issues with spaces), but write original keyword to file
    local keyword_normalized_for_file=$(normalize_keyword_for_file "$keyword")
    local temp_keywords="/tmp/temp-keyword-$$-$keyword_normalized_for_file.txt"
    echo "$keyword" > "$temp_keywords"
    
    # Run TrendsRun.pl for this single keyword
    if ./TrendsRun.pl "$temp_keywords" 2>&1; then
        log_with_timestamp "  Successfully fetched data for: $keyword"
        rm -f "$temp_keywords"
        return 0
    else
        log_with_timestamp "  ERROR: Failed to fetch data for: $keyword"
        rm -f "$temp_keywords"
        return 1
    fi
}

# Function to validate cache file size and recreate if too small
# Receives original keyword (with spaces) so it can pass it to fetch_missing_cache
validate_cache_file_size() {
    local keyword="$1"
    # Normalize keyword: lowercase and remove spaces for file lookup
    local keyword_normalized=$(normalize_keyword_for_file "$keyword")
    local cache_file="$CACHE_DIR/Trends.$keyword_normalized"
    local min_size=100  # Minimum file size in bytes
    
    if [ ! -f "$cache_file" ]; then
        return 1  # File doesn't exist
    fi
    
    # Get file size
    local file_size=$(stat -f%z "$cache_file" 2>/dev/null || stat -c%s "$cache_file" 2>/dev/null || echo "0")
    
    # Check if file is too small
    if [ "$file_size" -lt "$min_size" ]; then
        log_with_timestamp "  Cache file too small ($file_size bytes) for $keyword - removing and refetching"
        rm -f "$cache_file"
        
        # Fetch fresh data
        fetch_missing_cache "$keyword"
        return $?
    fi
    
    return 0  # File size is OK
}

# Check for keywords in Redis that don't have local cache files or need updating
FILES_TO_UPLOAD=()
FILES_TO_FETCH=()

log_with_timestamp "Checking cache files against Redis..."
while IFS= read -r keyword; do
    if [ -n "$keyword" ]; then
        # Normalize keyword: lowercase and remove spaces for file/Redis key lookup
        keyword_normalized=$(normalize_keyword_for_file "$keyword")
        cache_file="$CACHE_DIR/Trends.$keyword_normalized"
        redis_key="cache-trends:Trends.$keyword_normalized"
        
        # Check if OLD Redis DB has this keyword
        redis_exists=$(/usr/local/bin/redis-cli -u "$OLD_REDIS_URL" EXISTS "$redis_key" 2>/dev/null || echo "0")
        
        if [ ! -f "$cache_file" ] && [ "$redis_exists" = "1" ]; then
            # OLD Redis DB has it but cache doesn't - need to fetch
            log_with_timestamp "  Keyword in OLD Redis DB but no cache file: $keyword"
            FILES_TO_FETCH+=("$keyword")  # Store original keyword with spaces for Google Trends query
        elif [ ! -f "$cache_file" ] && [ "$redis_exists" = "0" ]; then
            # File doesn't exist locally and not in OLD DB - need to fetch
            log_with_timestamp "  Keyword not found in OLD Redis DB or locally: $keyword - will fetch"
            FILES_TO_FETCH+=("$keyword")  # Store original keyword with spaces for Google Trends query
        elif [ -f "$cache_file" ]; then
            # First validate file size (remove and refetch if < 100 bytes)
            # Pass original keyword so fetch_missing_cache can use it for Google Trends query
            validate_cache_file_size "$keyword"
            
            # Check if cache is newer than OLD Redis DB
            if check_and_upload_newer_cache "$keyword_normalized"; then
                FILES_TO_UPLOAD+=("$keyword_normalized")
            fi
        fi
    fi
done <<< "$redis_keywords"

# Fetch missing cache files
if [ ${#FILES_TO_FETCH[@]} -gt 0 ]; then
    log_with_timestamp "Found ${#FILES_TO_FETCH[@]} keywords to fetch from Google Trends"
    for keyword in "${FILES_TO_FETCH[@]}"; do
        # Pass original keyword with spaces to fetch_missing_cache
        # It will normalize internally for file lookup but use original for Google Trends query
        fetch_missing_cache "$keyword"
    done
fi

# Upload newer cache files to OLD Redis database only
if [ ${#FILES_TO_UPLOAD[@]} -gt 0 ]; then
    log_with_timestamp "Found ${#FILES_TO_UPLOAD[@]} cache files newer than OLD Redis DB - uploading to OLD DB only"
    upload_count=0
    error_count=0
    
    for keyword_normalized in "${FILES_TO_UPLOAD[@]}"; do
        cache_file="$CACHE_DIR/Trends.$keyword_normalized"
        if [ -f "$cache_file" ]; then
            if upload_to_old_redis "$cache_file" "$keyword_normalized"; then
                upload_count=$((upload_count + 1))
            else
                error_count=$((error_count + 1))
            fi
            # Small delay to avoid overwhelming the API
            sleep 0.5
        fi
    done
    
    log_with_timestamp "Upload completed: $upload_count successful, $error_count errors (uploaded to OLD Redis DB only)"
fi

# DISABLED: Do NOT sync keywords to Vercel - this causes Vercel to overwrite Redis with wrong keyword list
# log_with_timestamp "Syncing keywords from Redis to Vercel..."
# sync_keywords_to_vercel "$keywords_json"

# Check if local Keywords file matches Redis (should always match since we just updated it)
# This check is mainly for logging purposes - we already updated the file above
if [ "$redis_keywords_sorted" != "$local_keywords" ]; then
    log_with_timestamp "WARNING: Local Keywords file still doesn't match Redis after update - this shouldn't happen"
    # Force update again to ensure consistency
    cat > "$KEYWORDS_FILE" << EOF
# Keywords file - Synced from Vercel GUI via Redis
# Last updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# Format: one keyword per line
# WARNING: This file is auto-generated from Redis. Do not edit manually.
EOF
    echo "$redis_keywords" | while read -r keyword; do
        if [ -n "$keyword" ]; then
            echo "$keyword" >> "$KEYWORDS_FILE"
        fi
    done
    log_with_timestamp "Forced update of local Keywords file from Redis"
fi
    
# Run TrendsRun.pl to generate cache files for keywords
# Note: Keywords file has already been updated from Redis above
log_with_timestamp "Running TrendsRun.pl to generate cache files for keywords from Vercel/Redis"
    cd "$TRENDS_RUN_DIR"
    
    if ./TrendsRun.pl Keywords; then
        log_with_timestamp "TrendsRun.pl completed successfully"
        
        # Upload cache files to OLD Redis database only (only for keywords in the list)
        log_with_timestamp "Uploading cache files to OLD Redis DB (only keywords in Vercel list)..."
        upload_count=0
        error_count=0
        
        # Only upload files for keywords in the Redis/Vercel keyword list
        while IFS= read -r keyword; do
            if [ -n "$keyword" ]; then
                # Normalize keyword: lowercase and remove spaces for file/Redis key lookup
                keyword_normalized=$(normalize_keyword_for_file "$keyword")
                cache_file="$CACHE_DIR/Trends.$keyword_normalized"
                if [ -f "$cache_file" ]; then
                    if upload_to_old_redis "$cache_file" "$keyword_normalized"; then
                        upload_count=$((upload_count + 1))
                    else
                        error_count=$((error_count + 1))
                    fi
                    sleep 0.5
                fi
            fi
        done <<< "$redis_keywords"
        
        log_with_timestamp "Cache upload completed: $upload_count successful, $error_count errors (uploaded to OLD Redis DB only, only keywords in Vercel list)"
    else
        log_with_timestamp "ERROR: TrendsRun.pl failed"
    fi

# Cleanup old trends-run files in OLD Redis DB (keep only the most recent one)
log_with_timestamp "Cleaning up old trends-run files in OLD Redis DB..."
trends_run_keys=$(/usr/local/bin/redis-cli -u "$OLD_REDIS_URL" KEYS "trends-run:trends-run-*" 2>/dev/null | sort -r)

if [ -n "$trends_run_keys" ]; then
    key_count=$(echo "$trends_run_keys" | wc -l | tr -d ' ')
    
    if [ "$key_count" -gt 1 ]; then
        # Keep the first one (most recent after reverse sort) and delete the rest
        most_recent=$(echo "$trends_run_keys" | head -1)
        keys_to_delete=$(echo "$trends_run_keys" | tail -n +2)
        
        deleted_count=0
        while IFS= read -r key; do
            if [ -n "$key" ]; then
                /usr/local/bin/redis-cli -u "$OLD_REDIS_URL" DEL "$key" >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    deleted_count=$((deleted_count + 1))
                    log_with_timestamp "  Deleted old trends-run from OLD DB: $key"
                fi
            fi
        done <<< "$keys_to_delete"
        
        log_with_timestamp "Cleanup complete: Kept 1 file, deleted $deleted_count old trends-run files"
        log_with_timestamp "  Most recent: $most_recent"
    else
        log_with_timestamp "Only 1 trends-run file found - no cleanup needed"
    fi
else
    log_with_timestamp "No trends-run files found in Redis"
fi

# List all Trends files in GeoPol Cache using ls -lt (newest first)
# This listing will be included in the log upload to Redis
log_with_timestamp "Listing all Trends files in GeoPol Cache (ls -lt output, newest first)..."
if [ -d "$CACHE_DIR" ]; then
    # Use ls -lt to list files sorted by modification time (newest first)
    # -L flag follows symlinks
    # Dump the raw ls -lt output directly to log file (includes total line and all file entries)
    if ls "$CACHE_DIR"/Trends.* >/dev/null 2>&1; then
        # Dump ls -lt output directly to log file
        ls -ltL "$CACHE_DIR"/Trends.* 2>/dev/null >> "$LOG_FILE"
    else
        log_with_timestamp "  No Trends files found in cache directory"
    fi
else
    log_with_timestamp "  Cache directory not found: $CACHE_DIR"
fi

# Upload last 500 lines of logs to both Redis databases (AFTER Trends files listing)
# This ensures the Trends files listing is included in the uploaded logs
log_with_timestamp "Uploading last 500 lines of logs to both Redis databases..."

# Mark that we're about to upload logs (prevents duplicate uploads in trap handler)
touch "/tmp/simple-sync-logs-uploaded-$$"

# Upload TrendsLog to both Redis databases
TRENDS_LOG="/Users/jcasal/Google Drive/FinantialScan/logs/TrendsLog"
if [ -f "$TRENDS_LOG" ]; then
    # Upload to OLD Redis
    upload_logs_to_redis "$TRENDS_LOG" "logs:TrendsLog:last500" "$OLD_REDIS_URL" "OLD Redis"
    
    # Upload to NEW Redis
    upload_logs_to_redis "$TRENDS_LOG" "logs:TrendsLog:last500" "$NEW_REDIS_URL" "NEW Redis"
else
    log_with_timestamp "  ⚠️  TrendsLog file not found: $TRENDS_LOG"
fi

# Upload simple-sync.log to both Redis databases (includes Trends files listing)
if [ -f "$LOG_FILE" ]; then
    # Upload to OLD Redis
    upload_logs_to_redis "$LOG_FILE" "logs:simple-sync:last500" "$OLD_REDIS_URL" "OLD Redis"
    
    # Upload to NEW Redis
    upload_logs_to_redis "$LOG_FILE" "logs:simple-sync:last500" "$NEW_REDIS_URL" "NEW Redis"
else
    log_with_timestamp "  ⚠️  simple-sync.log file not found: $LOG_FILE"
fi

# Clean up any duplicate lowercase keys that may have been created
log_with_timestamp "Cleaning up duplicate lowercase log keys in NEW Redis..."
/usr/local/bin/redis-cli -u "$NEW_REDIS_URL" DEL "logs:trendslog:last500" >/dev/null 2>&1

log_with_timestamp "Log upload completed"

# Remove flag file since we've successfully uploaded logs
rm -f "/tmp/simple-sync-logs-uploaded-$$"

log_with_timestamp "Simple sync completed (PID: $$)"
