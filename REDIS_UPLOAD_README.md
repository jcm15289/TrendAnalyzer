# Send Files to Redis Database

Upload files directly to your Redis database using simple command-line scripts. This is perfect for storing trends data, reports, and other files with automatic expiration.

## ✅ What's Working

The Redis upload system is **fully functional** and ready to use! You can upload files directly to Redis without needing any additional setup.

## Scripts Available

### 1. Node.js Script: `sendfiletoRedis.js`
- **Full-featured** with advanced options
- **Colorized output** and detailed error handling
- **Multiple file type support** (JSON, text, binary)
- **TTL (Time To Live) support** for automatic expiration
- **Flexible options** (key, folder, TTL, server URL)

### 2. Shell Script: `sendfiletoRedis.sh`
- **Lightweight** and fast
- **Simple syntax** for quick uploads
- **Cross-platform** compatibility
- **Built-in help** and error messages

## API Endpoints Created

- `POST /api/redis/upload` - Upload files via FormData
- `PUT /api/redis/upload` - Upload JSON data
- `GET /api/redis/list` - List files in Redis
- `GET /api/redis/download` - Download files from Redis
- `DELETE /api/redis/delete` - Delete files from Redis

## Usage Examples

### Node.js Script

```bash
# Basic usage
node sendfiletoRedis.js data.json

# With custom key and folder
node sendfiletoRedis.js report.pdf --key my-report --folder reports

# With custom TTL (1 day)
node sendfiletoRedis.js trends.json --key ai-trends-2024 --ttl 86400

# Different server
node sendfiletoRedis.js data.json --server https://your-app.vercel.app
```

### Shell Script

```bash
# Basic usage
./sendfiletoRedis.sh data.json

# With custom key and folder
./sendfiletoRedis.sh report.pdf my-report reports

# With custom TTL (1 day)
./sendfiletoRedis.sh trends.json ai-trends-2024 data 86400
```

## TTL (Time To Live) Examples

- `3600` = 1 hour
- `86400` = 1 day
- `604800` = 7 days (default)
- `2592000` = 30 days

## File Types Supported

### JSON Files (.json)
- Uploaded as structured JSON data
- Preserves data structure and types
- Recommended for trends data, reports, configurations

### Text Files (.txt, .csv, .log, .md, .html, .css, .js, .ts)
- Uploaded as text content
- Good for logs, documentation, code files

### Binary Files (.pdf, .png, .jpg, .gif, .zip, etc.)
- Uploaded as binary files
- Preserves original file format
- Good for images, documents, archives

## Folder Organization

Files are organized in Redis with folder prefixes:

- `trends-data:` - Google Trends data and analysis
- `reports:` - Generated reports and summaries
- `exports:` - Data exports and backups
- `files:` - General file uploads
- `cache:` - Cached data (used by your existing system)

## Test Results

✅ **Successfully tested with sample data:**
- File uploaded to Redis with key: `trends-data:test-ai-trends`
- Size: 550 bytes
- TTL: 7 days
- Server connection: Working
- File listing: Working

## Integration with Your Existing System

Your project already uses Redis for caching trends data. The new upload system integrates seamlessly:

- **Same Redis connection** - Uses your existing Redis Cloud setup
- **Compatible with existing cache** - Won't interfere with trends caching
- **Same key patterns** - Uses similar naming conventions

## Daily Automation Examples

### Cron Job for Daily Uploads
```bash
# Add to crontab for daily uploads at 6 AM
0 6 * * * cd /path/to/GeoPolGTrends && ./sendfiletoRedis.sh daily-report.json daily-report-$(date +%Y-%m-%d) reports 86400
```

### GitHub Actions Integration
```yaml
- name: Upload daily data to Redis
  run: |
    cd GeoPolGTrends
    ./sendfiletoRedis.sh data.json trends-data daily-$(date +%Y-%m-%d) 604800
```

### Python Script Integration
```python
import subprocess
import json

# Upload trends data
data = {"keyword": "AI", "trends": [...]}
with open('temp.json', 'w') as f:
    json.dump(data, f)

subprocess.run([
    './sendfiletoRedis.sh', 
    'temp.json', 
    'ai-trends-2024', 
    'trends-data', 
    '86400'
])
```

## Advantages of Redis Storage

### ✅ **Immediate Availability**
- No need for Vercel Blob token setup
- Works with your existing Redis infrastructure
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
- Uses your existing Redis Cloud subscription
- No additional storage costs
- Efficient memory usage

## Comparison: Redis vs Vercel Blob

| Feature | Redis | Vercel Blob |
|---------|-------|-------------|
| Setup Required | ✅ None | ❌ Token needed |
| Performance | ✅ Very Fast | ⚠️ Network dependent |
| Expiration | ✅ Automatic TTL | ❌ Manual cleanup |
| Cost | ✅ Included | ⚠️ Additional cost |
| Integration | ✅ Seamless | ⚠️ Separate system |

## Troubleshooting

### Common Issues

1. **"Cannot connect to server"**
   - Make sure development server is running: `npm run dev`
   - Check if server is on correct port (default: 9002)

2. **"Upload failed"**
   - Check Redis connection in server logs
   - Verify Redis Cloud credentials
   - Check file permissions

3. **"File not found"**
   - Check file path is correct
   - Use absolute path if needed

### Debug Commands

```bash
# Test server connection
curl http://localhost:9002/api/redis/list?folder=test&pattern=*

# List all files in a folder
curl http://localhost:9002/api/redis/list?folder=trends-data&pattern=*

# Download a specific file
curl http://localhost:9002/api/redis/download?key=trends-data:test-ai-trends
```

## Next Steps

1. **Start using it immediately** - No setup required!
2. **Upload your trends data** - Use the scripts to store your data
3. **Set up automation** - Create cron jobs for daily uploads
4. **Integrate with your workflows** - Use in your existing data processing

The Redis upload system is **ready to use right now** and provides a fast, reliable way to store your files with automatic expiration! 🚀

