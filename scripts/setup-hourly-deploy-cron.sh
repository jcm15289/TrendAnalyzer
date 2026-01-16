#!/bin/bash
#
# setup-hourly-deploy-cron.sh
# Sets up a cron job to run deployment script every hour
#
# Usage: ./scripts/setup-hourly-deploy-cron.sh
#

echo "========================================="
echo "Setting up Hourly Deployment Cron Job"
echo "========================================="

# Get the project root directory (parent of scripts directory)
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WRAPPER_SCRIPT="$PROJECT_ROOT/scripts/hourly-deploy-wrapper.sh"
LOG_DIR="$PROJECT_ROOT/scripts/logs"

# Check if wrapper script exists
if [ ! -f "$WRAPPER_SCRIPT" ]; then
    echo "ERROR: Wrapper script not found at: $WRAPPER_SCRIPT"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Make sure script is executable
chmod +x "$WRAPPER_SCRIPT"

# Cron job configuration
# Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
CRON_SCHEDULE="0 * * * *"
LOG_FILE="$LOG_DIR/hourly-deploy.log"
CRON_COMMAND="\"$WRAPPER_SCRIPT\" >> \"$LOG_FILE\" 2>&1"

# Create a temporary file for the crontab
TEMP_CRON=$(mktemp)

# Get existing crontab (ignore errors if no crontab exists)
crontab -l > "$TEMP_CRON" 2>/dev/null || true

# Check if hourly deploy job already exists
if grep -q "hourly-deploy.log" "$TEMP_CRON"; then
    echo "⚠️  Existing hourly deploy cron job found. Removing old entry..."
    grep -v "hourly-deploy.log" "$TEMP_CRON" > "${TEMP_CRON}.new"
    mv "${TEMP_CRON}.new" "$TEMP_CRON"
fi

# Add the new cron job
echo "" >> "$TEMP_CRON"
echo "# TrendAnalyzer Hourly Deployment - Runs every hour" >> "$TEMP_CRON"
echo "$CRON_SCHEDULE $CRON_COMMAND" >> "$TEMP_CRON"

# Install the new crontab
crontab "$TEMP_CRON"

# Clean up
rm "$TEMP_CRON"

echo ""
echo "✅ Cron job successfully configured!"
echo ""
echo "Schedule: Every hour at minute 0"
echo "Script: $WRAPPER_SCRIPT"
echo "Log file: $LOG_FILE"
echo ""
echo "Current crontab entries:"
echo "----------------------------------------"
crontab -l | grep -A 1 "Hourly Deployment"
echo "----------------------------------------"
echo ""
echo "To view all cron jobs: crontab -l"
echo "To remove this job: crontab -e (then delete the hourly-deploy.log line)"
echo "To test the script manually: $WRAPPER_SCRIPT"
echo "To view logs: tail -f $LOG_FILE"
echo ""

exit 0
