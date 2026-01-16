#!/bin/bash
#
# hourly-deploy-wrapper.sh
# Wrapper script for hourly deployment that adds timestamps and logging
#

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_SCRIPT="$PROJECT_ROOT/deploy.sh"
LOG_DIR="$PROJECT_ROOT/scripts/logs"
LOG_FILE="$LOG_DIR/hourly-deploy.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Function to log with timestamp
log_with_timestamp() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Start logging
log_with_timestamp "========================================="
log_with_timestamp "Starting hourly deployment"
log_with_timestamp "========================================="

# Change to project root
cd "$PROJECT_ROOT" || {
    log_with_timestamp "ERROR: Failed to change to project root: $PROJECT_ROOT"
    exit 1
}

# Run the deployment script
if [ -f "$DEPLOY_SCRIPT" ]; then
    log_with_timestamp "Running: $DEPLOY_SCRIPT"
    "$DEPLOY_SCRIPT" 2>&1 | while IFS= read -r line; do
        log_with_timestamp "$line"
    done
    EXIT_CODE=${PIPESTATUS[0]}
else
    log_with_timestamp "ERROR: Deploy script not found: $DEPLOY_SCRIPT"
    EXIT_CODE=1
fi

# Log completion
if [ $EXIT_CODE -eq 0 ]; then
    log_with_timestamp "✅ Hourly deployment completed successfully"
else
    log_with_timestamp "❌ Hourly deployment failed with exit code: $EXIT_CODE"
fi

log_with_timestamp "========================================="
log_with_timestamp ""

# Rotate log file if it's larger than 10MB
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    MAX_SIZE=$((10 * 1024 * 1024)) # 10MB
    
    if [ "$LOG_SIZE" -gt "$MAX_SIZE" ]; then
        log_with_timestamp "Log file exceeds 10MB, rotating..."
        mv "$LOG_FILE" "${LOG_FILE}.old"
        touch "$LOG_FILE"
        log_with_timestamp "Log rotated. Old log saved as: ${LOG_FILE}.old"
    fi
fi

exit $EXIT_CODE
