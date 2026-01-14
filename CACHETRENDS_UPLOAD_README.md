# CacheTrends Upload to Redis - Daily Automation

Automatically upload all files from CacheTrends/* directories to Redis with daily cron job automation.

## ✅ What's Working

The CacheTrends upload system is **fully functional** and ready to use! It automatically finds and uploads all files from CacheTrends directories to Redis.

## Scripts Created

### 1. Node.js Script: `upload-cache-trends.js`
- **Full-featured** with advanced options
- **Colorized output** and detailed error handling
- **Dry-run mode** for testing
- **Automatic sample data creation**

### 2. Shell Script: `upload-cache-trends.sh`
- **Lightweight** and fast
- **Simple syntax** for quick uploads
- **Perfect for cron jobs**

### 3. Cron Setup Script: `setup-cache-trends-cron.sh`
- **Automated cron job setup**
- **Daily execution at 6:00 AM**
- **Logging and monitoring**

## ✅ Test Results

**Successfully tested with sample data:**
- ✅ Created sample CacheTrends directory
- ✅ Found 3 files to upload
- ✅ All files uploaded successfully to Redis
- ✅ Cron job configured and active

## Usage

### Manual Upload

```bash
# Upload all CacheTrends files
node upload-cache-trends.js

# Upload with custom settings
node upload-cache-trends.js --source /path/to/CacheTrends --ttl 86400

# Dry run (test without uploading)
node upload-cache-trends.js --dry-run

# Shell script version
./upload-cache-trends.sh
```

### Automatic Daily Upload

The cron job is already set up and will run daily at 6:00 AM:

```bash
# View current cron jobs
crontab -l

# View upload logs
tail -f cache-trends-upload.log

# Test the cron job manually
./upload-cache-trends.sh
```

## File Organization

Files are organized in Redis with the `cache-trends:` prefix:

- `cache-trends:trends_data.json` - AI trends data
- `cache-trends:political_trends.json` - Political trends data  
- `cache-trends:tech_trends.txt` - Technology trends data

## TTL (Time To Live)

Files are stored with automatic expiration:
- **Default**: 7 days (604800 seconds)
- **Configurable**: Use `--ttl` option
- **Automatic cleanup**: Files expire automatically

## Cron Job Details

**Schedule**: `0 6 * * *` (6:00 AM daily)
**Command**: 
```bash
cd /Users/jcasal/Google\ Drive/FinantialScan/GeoPolGTrends && ./upload-cache-trends.sh >> cache-trends-upload.log 2>&1
```

**Log File**: `cache-trends-upload.log`

## Monitoring

### View Logs
```bash
# View recent uploads
tail -f cache-trends-upload.log

# View all logs
cat cache-trends-upload.log

# Check last 10 lines
tail -10 cache-trends-upload.log
```

### Check Redis Storage
```bash
# List uploaded files
curl "http://localhost:9002/api/redis/list?folder=cache-trends&pattern=*"

# Download a specific file
curl "http://localhost:9002/api/redis/download?key=cache-trends:trends_data.json"
```

## Integration with Existing System

The CacheTrends upload system integrates seamlessly with your existing infrastructure:

- **Uses existing Redis connection** - Same Redis Cloud setup
- **Compatible with trends caching** - Won't interfere with existing cache
- **Uses existing upload scripts** - Leverages `sendfiletoRedis.js`
- **Follows existing patterns** - Similar to your other cron jobs

## Advantages

### ✅ **Immediate Availability**
- No additional setup required
- Works with existing Redis infrastructure
- Instant uploads and downloads

### ✅ **Automatic Expiration**
- Files automatically expire after TTL
- No manual cleanup needed
- Configurable retention periods

### ✅ **High Performance**
- Redis is extremely fast
- In-memory storage
- Perfect for frequently accessed data

### ✅ **Cost Effective**
- Uses existing Redis Cloud subscription
- No additional storage costs
- Efficient memory usage

## File Types Supported

- **JSON files** (.json) - Uploaded as structured data
- **Text files** (.txt, .csv, .log) - Uploaded as text content
- **Binary files** (.pdf, .png, .jpg) - Uploaded as binary files

## Troubleshooting

### Common Issues

1. **"No files found in source directory"**
   - Check if CacheTrends directory exists
   - Verify directory path is correct
   - Run with `--dry-run` to test

2. **"Upload failed"**
   - Check if development server is running
   - Verify Redis connection
   - Check file permissions

3. **"Cron job not running"**
   - Check cron service is active
   - Verify cron job syntax
   - Check log file for errors

### Debug Commands

```bash
# Test upload manually
node upload-cache-trends.js --dry-run

# Check cron job
crontab -l | grep upload-cache-trends

# Test shell script
./upload-cache-trends.sh

# Check Redis connection
curl http://localhost:9002/api/redis/list?folder=test&pattern=*
```

## Next Steps

1. **✅ Ready to use** - System is fully operational
2. **Add your CacheTrends files** - Place files in CacheTrends directory
3. **Monitor daily uploads** - Check logs for successful uploads
4. **Customize TTL** - Adjust expiration time as needed

## Summary

The CacheTrends upload system provides:
- **Automatic daily uploads** to Redis at 6:00 AM
- **File organization** with cache-trends prefix
- **Automatic expiration** with configurable TTL
- **Comprehensive logging** for monitoring
- **Easy integration** with existing infrastructure

Your CacheTrends files will now be automatically uploaded to Redis daily! 🚀
