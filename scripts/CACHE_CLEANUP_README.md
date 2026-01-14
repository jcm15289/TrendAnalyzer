# Google Trends Cache Cleanup Automation

Automatically manages disk space by removing the oldest 1/7th of cached Google Trends files daily.

## 📁 What It Does

The cache cleanup system automatically:
- Counts all files in the cache directory
- Calculates 1/7th of that total
- Deletes the oldest files based on modification time
- Logs all cleanup activities
- Runs automatically every night at 3:00 AM

## 📂 Files Created

### 1. Cleanup Script: `cleanup-old-cache.sh`
**Location**: `/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/cleanup-old-cache.sh`

**Features**:
- Automatically calculates how many files to delete (1/7th of total)
- Deletes only the oldest files by modification time
- Won't delete if fewer than 7 files exist
- Logs all deletions with timestamps and file sizes
- Reports space freed in MB
- Safe error handling

**Target Directory**: `/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/Cache`

### 2. Cron Setup Script: `setup-cache-cleanup-cron.sh`
**Location**: `/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/setup-cache-cleanup-cron.sh`

**Features**:
- Installs cron job automatically
- Runs cleanup daily at 3:00 AM
- Removes old cleanup cron jobs if they exist
- Displays current cron configuration

## 🚀 Setup Instructions

### Option 1: Automatic Setup (Recommended)
Run the setup script to install the cron job:

```bash
cd "/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts"
./setup-cache-cleanup-cron.sh
```

### Option 2: Manual Setup
1. Make the cleanup script executable:
```bash
chmod +x cleanup-old-cache.sh
```

2. Add to crontab manually:
```bash
crontab -e
```

3. Add this line:
```
0 3 * * * cd /Users/jcasal/Google\ Drive/FinantialScan/GeoPolGTrends/scripts && ./cleanup-old-cache.sh
```

## 🧪 Testing

Test the cleanup script manually before relying on the cron job:

```bash
cd "/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts"
./cleanup-old-cache.sh
```

## 📊 Cron Schedule

**Schedule**: `0 3 * * *` (3:00 AM daily)

This timing:
- Runs during low-usage hours
- Avoids interfering with trends data fetching
- Completes before morning data analysis

## 📝 Log Files

**Log Location**: `/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/logs/cache-cleanup.log`

**Log Contents**:
- Timestamp of each cleanup run
- Total files in cache before cleanup
- Number of files to be deleted (1/7th calculation)
- List of deleted files with sizes and modification dates
- Total space freed (in MB)
- Final file count after cleanup
- Any errors encountered

**Example Log Entry**:
```
========================================
Cache Cleanup Started: Wed Nov  5 03:00:01 PST 2025
========================================
Total files in cache: 350
Files to delete (1/7th): 50
Finding oldest 50 files...
  Deleting: cache_file_old_1.json (Size: 125KB, Modified: 2025-10-01 14:23:15)
  Deleting: cache_file_old_2.json (Size: 132KB, Modified: 2025-10-01 15:12:43)
  ...

Cleanup Summary:
  Files deleted: 50
  Space freed: 6 MB
  Remaining files: 300
  Verified remaining files: 300
========================================
Cache Cleanup Completed: Wed Nov  5 03:00:03 PST 2025
========================================
```

## 🔍 Monitoring

### Check if cron job is running:
```bash
crontab -l | grep cleanup-old-cache
```

### View recent cleanup activity:
```bash
tail -50 "/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/logs/cache-cleanup.log"
```

### Check cache directory size:
```bash
du -sh "/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/Cache"
```

### Count files in cache:
```bash
ls -1 "/Users/jcasal/Google Drive/FinantialScan/GeoPolGTrends/scripts/Cache" | wc -l
```

## ⚙️ How It Works

### Algorithm
1. **Count Phase**: Count all files in cache directory (excluding hidden files)
2. **Calculate Phase**: Divide total by 7 (rounded down)
3. **Safety Check**: If fewer than 7 files, skip cleanup
4. **Sort Phase**: Sort all files by modification time (oldest first)
5. **Delete Phase**: Delete the calculated number of oldest files
6. **Log Phase**: Record all actions and summary statistics

### Example Scenarios

| Total Files | Files Deleted (1/7th) | Files Remaining |
|-------------|------------------------|-----------------|
| 6           | 0 (too few)            | 6               |
| 70          | 10                     | 60              |
| 350         | 50                     | 300             |
| 700         | 100                    | 600             |
| 1400        | 200                    | 1200            |

### Safety Features
- Only deletes regular files (not directories)
- Skips hidden files (starting with .)
- Won't delete if fewer than 7 files exist
- Logs all deletions for audit trail
- Uses safe modification time sorting
- Error handling for failed deletions

## 🛠️ Customization

### Change Cleanup Time
Edit the cron schedule in `setup-cache-cleanup-cron.sh`:
- Current: `0 3 * * *` (3:00 AM daily)
- Example: `0 2 * * *` (2:00 AM daily)
- Example: `30 4 * * *` (4:30 AM daily)

### Change Deletion Ratio
Edit the calculation in `cleanup-old-cache.sh`:
- Current: `FILES_TO_DELETE=$((TOTAL_FILES / 7))` (1/7th)
- Example: `FILES_TO_DELETE=$((TOTAL_FILES / 10))` (1/10th - more conservative)
- Example: `FILES_TO_DELETE=$((TOTAL_FILES / 5))` (1/5th - more aggressive)

### Change Minimum Files Threshold
Edit the safety check in `cleanup-old-cache.sh`:
- Current: Requires at least 7 files
- Adjust the condition: `if [ "$FILES_TO_DELETE" -eq 0 ]`

## 🗑️ Uninstall

To remove the cron job:
```bash
crontab -e
# Delete the line containing "cleanup-old-cache.sh"
```

Or use this command:
```bash
(crontab -l | grep -v "cleanup-old-cache.sh") | crontab -
```

## 📈 Benefits

1. **Automatic Space Management**: No manual intervention needed
2. **Gradual Cleanup**: Removes only 1/7th at a time, preserving recent data
3. **Logged Activity**: Full audit trail of all deletions
4. **Safe Operation**: Multiple safety checks prevent accidental data loss
5. **Predictable**: Always keeps the 6/7ths newest files
6. **Low Impact**: Runs during off-peak hours

## ⚠️ Notes

- The script targets only the `scripts/Cache` directory
- Other cache directories (like `Cache_TrendKeywords`) are not affected
- Files are sorted by modification time (not creation time)
- The cleanup preserves the newest 6/7ths of files
- If you need to preserve specific files, move them out of the cache directory

## 🔗 Related Systems

This cleanup system complements other automation:
- **TrendsRun**: Fetches fresh trends data daily
- **Redis Upload**: Backs up trends to Redis with 7-day TTL
- Together they ensure fresh data while managing disk space

## 📞 Support

To check if cleanup is working properly:
1. Check the log file for recent entries
2. Verify cron job exists: `crontab -l`
3. Monitor cache directory size over several days
4. Run manual test: `./cleanup-old-cache.sh`

