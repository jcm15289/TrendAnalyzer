# Send File to Vercel Blob Storage

Two scripts to easily upload files to Vercel Blob storage from the command line.

## Scripts Available

### 1. Node.js Version: `sendfiletoVercel.js`
Full-featured script with advanced options and error handling.

### 2. Shell Version: `sendfiletoVercel.sh`
Lightweight shell script for quick uploads.

## Prerequisites

1. **Development Server Running**
   ```bash
   npm run dev
   ```

2. **Vercel Blob Token Setup**
   - Get token from [Vercel Dashboard](https://vercel.com/dashboard)
   - Create `.env.local` file:
   ```bash
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
   ```
   - Restart development server

## Usage

### Node.js Script

```bash
# Basic usage
node sendfiletoVercel.js <file_path>

# With options
node sendfiletoVercel.js <file_path> [options]

# Options:
#   --folder <folder>     Target folder (default: trends-data)
#   --filename <name>     Custom filename
#   --server <url>        Server URL (default: http://localhost:9002)
#   --help               Show help
```

**Examples:**
```bash
# Upload JSON file
node sendfiletoVercel.js data.json

# Upload to reports folder
node sendfiletoVercel.js report.pdf --folder reports

# Custom filename
node sendfiletoVercel.js trends.json --filename ai-trends-2024.json

# Different server
node sendfiletoVercel.js data.json --server https://your-app.vercel.app
```

### Shell Script

```bash
# Basic usage
./sendfiletoVercel.sh <file_path>

# With folder
./sendfiletoVercel.sh <file_path> <folder>

# With folder and custom filename
./sendfiletoVercel.sh <file_path> <folder> <filename>
```

**Examples:**
```bash
# Upload JSON file
./sendfiletoVercel.sh data.json

# Upload to reports folder
./sendfiletoVercel.sh report.pdf reports

# Custom filename
./sendfiletoVercel.sh trends.json trends-data ai-trends-2024.json
```

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

Files are organized in folders:

- `trends-data/` - Google Trends data and analysis
- `reports/` - Generated reports and summaries
- `exports/` - Data exports and backups
- `uploads/` - General file uploads

## Testing

### Test with Sample Data
```bash
# Create sample data
echo '{"test": "data", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > test.json

# Upload it
./sendfiletoVercel.sh test.json

# Or with Node.js script
node sendfiletoVercel.js test.json
```

### Test Server Connection
```bash
# Check if server is running
curl http://localhost:9002/api/blob/list

# Should return: {"error":"Failed to list blobs"} (if no token)
# Or: {"success":true,"blobs":[],"count":0} (if token is set)
```

## Error Handling

### Common Issues

1. **"Cannot connect to server"**
   - Make sure development server is running: `npm run dev`
   - Check if server is on correct port (default: 9002)

2. **"Upload failed: Failed to upload data"**
   - Check if `BLOB_READ_WRITE_TOKEN` is set in `.env.local`
   - Restart development server after setting token

3. **"File not found"**
   - Check file path is correct
   - Use absolute path if needed

4. **"Invalid JSON"**
   - Validate JSON syntax before uploading
   - Use a JSON validator tool

### Debug Mode

For the Node.js script, you can add debug logging:
```bash
DEBUG=* node sendfiletoVercel.js data.json
```

## Integration with Daily Automation

### Cron Job Example
```bash
# Add to crontab for daily uploads at 6 AM
0 6 * * * cd /path/to/GeoPolGTrends && ./sendfiletoVercel.sh daily-report.json reports
```

### GitHub Actions Example
```yaml
- name: Upload daily data
  run: |
    cd GeoPolGTrends
    ./sendfiletoVercel.sh data.json trends-data daily-$(date +%Y-%m-%d).json
```

## API Endpoints Used

The scripts use these API endpoints:

- `POST /api/blob/upload` - Upload files via FormData
- `PUT /api/blob/upload` - Upload JSON data
- `GET /api/blob/list` - List files (for connection testing)

## Security Notes

- Never commit `.env.local` file to version control
- Use environment variables in production
- Rotate Vercel Blob tokens regularly
- Validate file types and sizes before upload

## Troubleshooting

### Check Server Status
```bash
# Test if server responds
curl -I http://localhost:9002

# Test blob API
curl http://localhost:9002/api/blob/list
```

### Check Environment Variables
```bash
# In your project directory
cat .env.local | grep BLOB_READ_WRITE_TOKEN
```

### Check File Permissions
```bash
# Make scripts executable
chmod +x sendfiletoVercel.sh
chmod +x sendfiletoVercel.js
```

## Support

If you encounter issues:

1. Check the server logs in your terminal
2. Verify environment variables are set
3. Test with the sample data file
4. Check file permissions and paths

