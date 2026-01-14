#!/bin/bash
#
# setup-cache-cleanup-cron.sh
# Sets up a cron job to run cache cleanup script daily at 3:00 AM
#
# Usage: ./setup-cache-cleanup-cron.sh
#

echo "========================================="
echo "Setting up Cache Cleanup Cron Job"
echo "========================================="

# Path to the cleanup script
CLEANUP_SCRIPT="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/cleanup-old-cache.sh"

# Check if script exists
if [ ! -f "$CLEANUP_SCRIPT" ]; then
    echo "ERROR: Cleanup script not found at: $CLEANUP_SCRIPT"
    exit 1
fi

# Make sure script is executable
chmod +x "$CLEANUP_SCRIPT"

# Cron job configuration
# Run at 3:00 AM daily
CRON_SCHEDULE="0 3 * * *"
CRON_COMMAND="cd /Users/jcasal/Google\\ Drive/FinantialScan/GeoPolGTrends/scripts && ./cleanup-old-cache.sh"

# Create a temporary file for the crontab
TEMP_CRON=$(mktemp)

# Get existing crontab (ignore errors if no crontab exists)
crontab -l > "$TEMP_CRON" 2>/dev/null || true

# Check if cleanup job already exists
if grep -q "cleanup-old-cache.sh" "$TEMP_CRON"; then
    echo "⚠️  Existing cache cleanup cron job found. Removing old entry..."
    grep -v "cleanup-old-cache.sh" "$TEMP_CRON" > "${TEMP_CRON}.new"
    mv "${TEMP_CRON}.new" "$TEMP_CRON"
fi

# Add the new cron job
echo "" >> "$TEMP_CRON"
echo "# Google Trends Cache Cleanup - Runs daily at 3:00 AM" >> "$TEMP_CRON"
echo "$CRON_SCHEDULE $CRON_COMMAND" >> "$TEMP_CRON"

# Install the new crontab
crontab "$TEMP_CRON"

# Clean up
rm "$TEMP_CRON"

echo ""
echo "✅ Cron job successfully configured!"
echo ""
echo "Schedule: Daily at 3:00 AM"
echo "Script: $CLEANUP_SCRIPT"
echo "Action: Deletes oldest 1/7th of cache files"
echo ""
echo "Current crontab entries:"
echo "----------------------------------------"
crontab -l | grep -A 1 "Cache Cleanup"
echo "----------------------------------------"
echo ""
echo "To view all cron jobs: crontab -l"
echo "To remove this job: crontab -e (then delete the cleanup-old-cache.sh line)"
echo "To test the script manually: $CLEANUP_SCRIPT"
echo ""
echo "Log file location: /Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/logs/cache-cleanup.log"
echo ""

exit 0

