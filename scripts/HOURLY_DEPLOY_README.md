# Hourly Deployment Cron Job

This directory contains scripts to set up an hourly cron job that runs the deployment script and logs the output.

## Files

- `setup-hourly-deploy-cron.sh` - Script to set up the cron job
- `hourly-deploy-wrapper.sh` - Wrapper script that runs the deployment with enhanced logging
- `logs/hourly-deploy.log` - Log file where all output is stored

## Setup

Run the setup script to install the cron job:

```bash
./scripts/setup-hourly-deploy-cron.sh
```

This will:
1. Create the `scripts/logs` directory if it doesn't exist
2. Make the wrapper script executable
3. Add a cron job that runs every hour at minute 0 (1:00, 2:00, 3:00, etc.)
4. Configure logging to `scripts/logs/hourly-deploy.log`

## Schedule

The cron job runs **every hour** at minute 0:
- 1:00 AM
- 2:00 AM
- 3:00 AM
- ... and so on

## Logs

All output is logged to `scripts/logs/hourly-deploy.log` with timestamps.

The log file automatically rotates when it exceeds 10MB:
- Current log: `scripts/logs/hourly-deploy.log`
- Old log: `scripts/logs/hourly-deploy.log.old`

## Viewing Logs

To view the latest logs:
```bash
tail -f scripts/logs/hourly-deploy.log
```

To view all logs:
```bash
cat scripts/logs/hourly-deploy.log
```

## Manual Testing

To test the wrapper script manually:
```bash
./scripts/hourly-deploy-wrapper.sh
```

## Managing the Cron Job

### View current cron jobs
```bash
crontab -l
```

### Edit cron jobs
```bash
crontab -e
```

### Remove the hourly deploy job
1. Run `crontab -e`
2. Find the line containing `hourly-deploy.log`
3. Delete that line
4. Save and exit

## What It Does

The cron job runs `deploy.sh` every hour, which:
1. Gets the current version from `package.json`
2. Stages all changes
3. Commits with version and timestamp
4. Pushes to GitHub (which triggers Vercel deployment if GitHub integration is enabled)

## Notes

- The cron job will run even if there are no changes to commit
- All output (stdout and stderr) is logged to the log file
- Each log entry includes a timestamp
- The log file rotates automatically when it exceeds 10MB
