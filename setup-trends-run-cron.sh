#!/bin/bash

# Setup Cron Job for Daily TrendsRun.pl and Redis Upload
# 
# This script sets up a cron job to automatically run TrendsRun.pl and upload
# results to Redis daily at 4:00 AM, replacing the CacheTrends upload cron job.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BRIGHT='\033[1m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    echo -e "${2}${1}${NC}"
}

# Configuration
SCRIPT_DIR="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/TrendKeywords"
TRENDS_SCRIPT="$SCRIPT_DIR/run-trends-and-upload.sh"
LOG_FILE="$SCRIPT_DIR/trends-run-upload.log"

# New cron schedule (4:00 AM daily)
NEW_CRON_SCHEDULE="0 4 * * *"

print_color "🚀 Setup Daily TrendsRun.pl and Redis Upload" "$BRIGHT"
echo ""

# Check if trends script exists
if [ ! -f "$TRENDS_SCRIPT" ]; then
    print_color "❌ TrendsRun script not found: $TRENDS_SCRIPT" "$RED"
    exit 1
fi

# Make sure script is executable
chmod +x "$TRENDS_SCRIPT"

print_color "📋 New Cron Job Configuration:" "$CYAN"
echo "   Schedule: $NEW_CRON_SCHEDULE (4:00 AM daily)"
echo "   Script: $TRENDS_SCRIPT"
echo "   Log file: $LOG_FILE"
echo "   Working directory: $SCRIPT_DIR"
echo ""

# Remove old CacheTrends upload cron job if it exists
print_color "🗑️  Removing old CacheTrends upload cron job..." "$YELLOW"
if crontab -l 2>/dev/null | grep -q "upload-cache-trends.sh"; then
    # Remove the old cron job
    crontab -l 2>/dev/null | grep -v "upload-cache-trends.sh" | crontab -
    print_color "✅ Removed old CacheTrends upload cron job" "$GREEN"
else
    print_color "ℹ️  No old CacheTrends upload cron job found" "$CYAN"
fi

# Check if new cron job already exists
if crontab -l 2>/dev/null | grep -q "run-trends-and-upload.sh"; then
    print_color "⚠️  TrendsRun cron job already exists" "$YELLOW"
    echo "   Current TrendsRun cron job:"
    crontab -l | grep "run-trends-and-upload.sh"
    echo ""
    echo "To remove existing job, run: crontab -e"
    echo "To add new job, run: crontab -e"
else
    # Add the new cron job
    CRON_COMMAND="$NEW_CRON_SCHEDULE cd $SCRIPT_DIR && $TRENDS_SCRIPT >> $LOG_FILE 2>&1"
    (crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -
    print_color "✅ New TrendsRun cron job added successfully!" "$GREEN"
    echo "   The script will run daily at 4:00 AM"
fi

echo ""
print_color "📋 Current cron jobs:" "$CYAN"
crontab -l

echo ""
print_color "📝 Manual Testing:" "$YELLOW"
echo "   To test the TrendsRun script manually:"
echo "   $TRENDS_SCRIPT"
echo ""
echo "   To check if TrendsRun.pl exists:"
echo "   ls -la $SCRIPT_DIR/TrendsRun.pl"
echo ""

print_color "📊 Monitoring:" "$YELLOW"
echo "   Log file: $LOG_FILE"
echo "   To view recent logs:"
echo "   tail -f $LOG_FILE"
echo ""

print_color "🎉 Setup completed!" "$GREEN"
echo "   TrendsRun.pl will be automatically executed and results uploaded to Redis daily at 4:00 AM"
echo "   Old CacheTrends upload cron job has been removed"
