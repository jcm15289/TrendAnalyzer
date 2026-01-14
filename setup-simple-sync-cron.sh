#!/bin/bash

# Setup cron job for simple sync script
# Runs every 30 seconds

SCRIPT_PATH="/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/simple-sync.sh"
CRON_JOB="* * * * * $SCRIPT_PATH"
CRON_JOB_30="* * * * * sleep 30; $SCRIPT_PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_color() {
    echo -e "${2}${1}${NC}"
}

print_color "🔧 Setting up Simple Sync Cron Job" "$BLUE"
print_color "Script: $SCRIPT_PATH" "$YELLOW"
print_color "Frequency: Every 30 seconds" "$YELLOW"
echo ""

# Check if script exists
if [ ! -f "$SCRIPT_PATH" ]; then
    print_color "❌ Script not found: $SCRIPT_PATH" "$RED"
    exit 1
fi

# Check if script is executable
if [ ! -x "$SCRIPT_PATH" ]; then
    print_color "❌ Script is not executable. Making it executable..." "$YELLOW"
    chmod +x "$SCRIPT_PATH"
fi

# Remove existing cron jobs for this script
print_color "🧹 Removing existing cron jobs for this script..." "$BLUE"
(crontab -l 2>/dev/null | grep -v "$SCRIPT_PATH") | crontab -

# Add new cron jobs (every minute and every 30 seconds)
print_color "➕ Adding new cron jobs..." "$BLUE"
(crontab -l 2>/dev/null; echo "$CRON_JOB"; echo "$CRON_JOB_30") | crontab -

# Verify cron jobs were added
print_color "✅ Cron jobs added successfully!" "$GREEN"
echo ""
print_color "📋 Current cron jobs:" "$BLUE"
crontab -l | grep "$SCRIPT_PATH"
echo ""

print_color "📊 Cron job details:" "$YELLOW"
print_color "   • Runs every minute (at :00)" "$YELLOW"
print_color "   • Runs every 30 seconds (at :30)" "$YELLOW"
print_color "   • Logs to: /Users/jcasal/Google Drive/FinantialScan/TrendKeywords/simple-sync.log" "$YELLOW"
echo ""

print_color "🔍 To monitor the sync process:" "$BLUE"
print_color "   tail -f /Users/jcasal/Google Drive/FinantialScan/TrendKeywords/simple-sync.log" "$YELLOW"
echo ""

print_color "🛑 To stop the cron job:" "$BLUE"
print_color "   crontab -e" "$YELLOW"
print_color "   (Remove the lines containing $SCRIPT_PATH)" "$YELLOW"
echo ""

print_color "🎉 Setup completed!" "$GREEN"











