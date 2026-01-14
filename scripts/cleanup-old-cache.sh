#!/bin/bash
#
# cleanup-old-cache.sh
# Automatically removes the oldest 1/7th of files from the Google Trends cache
# to manage disk space while keeping recent data
#
# Usage: ./cleanup-old-cache.sh
# Recommended: Run daily via cron at night (e.g., 3:00 AM)
#

# Cache directory to clean
CACHE_DIR="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/Cache"

# Log file for cleanup activities
LOG_FILE="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/logs/cache-cleanup.log"

# Create logs directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Start logging
echo "========================================" | tee -a "$LOG_FILE"
echo "Cache Cleanup Started: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"

# Check if cache directory exists
if [ ! -d "$CACHE_DIR" ]; then
    echo "ERROR: Cache directory does not exist: $CACHE_DIR" | tee -a "$LOG_FILE"
    exit 1
fi

# Change to cache directory
cd "$CACHE_DIR" || exit 1

# Count total files (excluding hidden files and directories)
TOTAL_FILES=$(find . -maxdepth 1 -type f ! -name ".*" | wc -l | tr -d ' ')

echo "Total files in cache: $TOTAL_FILES" | tee -a "$LOG_FILE"

# Check if there are files to process
if [ "$TOTAL_FILES" -eq 0 ]; then
    echo "No files to clean up." | tee -a "$LOG_FILE"
    exit 0
fi

# Calculate 1/7th of total files (rounded down)
FILES_TO_DELETE=$((TOTAL_FILES / 7))

echo "Files to delete (1/7th): $FILES_TO_DELETE" | tee -a "$LOG_FILE"

# If less than 7 files total, don't delete anything
if [ "$FILES_TO_DELETE" -eq 0 ]; then
    echo "Too few files ($TOTAL_FILES) to perform cleanup. Minimum 7 files required." | tee -a "$LOG_FILE"
    exit 0
fi

# Get the oldest files and delete them
echo "Finding oldest $FILES_TO_DELETE files..." | tee -a "$LOG_FILE"

DELETED_COUNT=0
DELETED_SIZE=0

# Create a temporary file to track deletions
TEMP_FILE=$(mktemp)

# Find oldest files by modification time (macOS compatible)
find . -maxdepth 1 -type f ! -name ".*" -exec stat -f "%m %z %N" {} \; 2>/dev/null | \
    sort -n | \
    head -n "$FILES_TO_DELETE" > "$TEMP_FILE"

# Track deleted keywords for re-fetching
DELETED_KEYWORDS=()

# Read and delete files
while read -r timestamp size filepath; do
    # Get just the filename (remove ./ prefix)
    filename="${filepath#./}"
    
    # Get file size in KB
    size_kb=$((size / 1024))
    
    # Get file modification date
    mod_date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$filename" 2>/dev/null)
    
    echo "  Deleting: $filename (Size: ${size_kb}KB, Modified: $mod_date)" | tee -a "$LOG_FILE"
    
    # Extract keyword from filename (e.g., "Trends.democracydecline" -> "democracydecline")
    # Store for re-fetching
    if [[ "$filename" =~ ^Trends\.(.+)$ ]]; then
        keyword_normalized="${BASH_REMATCH[1]}"
        DELETED_KEYWORDS+=("$keyword_normalized")
    fi
    
    # Delete the file
    if rm -f "$filename"; then
        DELETED_COUNT=$((DELETED_COUNT + 1))
        DELETED_SIZE=$((DELETED_SIZE + size))
    else
        echo "  ERROR: Failed to delete $filename" | tee -a "$LOG_FILE"
    fi
done < "$TEMP_FILE"

# Clean up temp file
rm -f "$TEMP_FILE"

# Convert deleted size to MB
DELETED_MB=$((DELETED_SIZE / 1024 / 1024))

echo "" | tee -a "$LOG_FILE"
echo "Cleanup Summary:" | tee -a "$LOG_FILE"
echo "  Files deleted: $DELETED_COUNT" | tee -a "$LOG_FILE"
echo "  Space freed: ${DELETED_MB} MB" | tee -a "$LOG_FILE"
echo "  Remaining files: $((TOTAL_FILES - DELETED_COUNT))" | tee -a "$LOG_FILE"

# Final file count
FINAL_COUNT=$(find . -maxdepth 1 -type f ! -name ".*" | wc -l | tr -d ' ')
echo "  Verified remaining files: $FINAL_COUNT" | tee -a "$LOG_FILE"

# Trigger re-fetch for deleted keywords if any were deleted
if [ ${#DELETED_KEYWORDS[@]} -gt 0 ]; then
    echo "" | tee -a "$LOG_FILE"
    echo "Triggering Google Trends re-fetch for ${#DELETED_KEYWORDS[@]} deleted keywords..." | tee -a "$LOG_FILE"
    
    # Paths for triggering re-fetch
    TRENDS_RUN_DIR="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/TrendKeywords"
    SIMPLE_SYNC_SCRIPT="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/simple-sync.sh"
    
    # Option 1: Run simple-sync.sh to trigger re-fetch (it checks for missing files)
    if [ -f "$SIMPLE_SYNC_SCRIPT" ] && [ -x "$SIMPLE_SYNC_SCRIPT" ]; then
        echo "  Running simple-sync.sh to trigger re-fetch..." | tee -a "$LOG_FILE"
        # Run in background to avoid blocking cleanup
        "$SIMPLE_SYNC_SCRIPT" >> "$LOG_FILE" 2>&1 &
        echo "  simple-sync.sh started in background (PID: $!)" | tee -a "$LOG_FILE"
    else
        echo "  WARNING: simple-sync.sh not found or not executable at $SIMPLE_SYNC_SCRIPT" | tee -a "$LOG_FILE"
        echo "  Deleted keywords will be re-fetched on next simple-sync.sh run" | tee -a "$LOG_FILE"
    fi
    
    # Log deleted keywords for reference
    echo "  Deleted keywords (will be re-fetched):" | tee -a "$LOG_FILE"
    for keyword in "${DELETED_KEYWORDS[@]}"; do
        echo "    - $keyword" | tee -a "$LOG_FILE"
    done
fi

echo "========================================" | tee -a "$LOG_FILE"
echo "Cache Cleanup Completed: $(date)" | tee -a "$LOG_FILE"
echo "========================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

exit 0

