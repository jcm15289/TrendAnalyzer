# Vercel Blob Storage Setup

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

## Getting Your Vercel Blob Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project
3. Go to Settings → Environment Variables
4. Add a new variable:
   - Name: `BLOB_READ_WRITE_TOKEN`
   - Value: Your blob token (get from Vercel Blob settings)
   - Environment: Production, Preview, Development

## API Endpoints Created

### Upload Files
- **POST** `/api/blob/upload` - Upload files via FormData
- **PUT** `/api/blob/upload` - Upload JSON data

### List Files
- **GET** `/api/blob/list?folder=trends-data&limit=100` - List files in a folder

### Delete Files
- **DELETE** `/api/blob/delete` - Delete a file by URL

## Usage Examples

### Upload JSON Data
```javascript
import { uploadJsonData } from '@/lib/blob-storage';

const result = await uploadJsonData(
  { keyword: 'AI', trends: [...] },
  'ai-trends.json',
  'trends-data'
);
```

### Upload File
```javascript
import { uploadFile } from '@/lib/blob-storage';

const result = await uploadFile(file, 'my-file.json', 'trends-data');
```

### List Files
```javascript
import { listFiles } from '@/lib/blob-storage';

const result = await listFiles('trends-data', 50);
```

## Testing

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Run the test script:
   ```bash
   node test-blob-upload.js
   ```

3. Or use the demo component by adding it to a page:
   ```jsx
   import BlobStorageDemo from '@/components/BlobStorageDemo';
   
   export default function TestPage() {
     return <BlobStorageDemo />;
   }
   ```

## File Organization

Files are organized in folders:
- `trends-data/` - Google Trends data
- `reports/` - Generated reports
- `exports/` - Data exports

## Automatic Daily Uploads

To set up daily uploads, you can:

1. **Use the cron script** (local):
   ```bash
   ./setup-cron.sh
   ```

2. **Use GitHub Actions** (recommended):
   - Push to GitHub
   - The workflow will run daily at 6 AM UTC

3. **Use Vercel Cron Jobs**:
   - Add to `vercel.json`:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/daily-upload",
         "schedule": "0 6 * * *"
       }
     ]
   }
   ```

