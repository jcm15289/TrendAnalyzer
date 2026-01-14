'use client';

import { useState } from 'react';
import { uploadJsonData, listFiles, deleteFile, uploadTrendsData } from '@/lib/blob-storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export default function BlobStorageDemo() {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [testData, setTestData] = useState(JSON.stringify({
    keyword: 'artificial intelligence',
    trends: [
      { date: '2024-01-01', value: 85 },
      { date: '2024-01-02', value: 92 },
      { date: '2024-01-03', value: 78 },
    ],
    metadata: {
      source: 'Google Trends',
      region: 'US',
      category: 'Technology'
    }
  }, null, 2));

  const handleUploadTestData = async () => {
    setUploading(true);
    setMessage('');

    try {
      const data = JSON.parse(testData);
      const result = await uploadTrendsData(data, data.keyword, '2024-01');
      
      if (result.success) {
        setMessage(`✅ Successfully uploaded! URL: ${result.url}`);
        // Refresh the file list
        await loadFiles();
      } else {
        setMessage(`❌ Upload failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const result = await listFiles('trends-data', 20);
      if (result.success && result.blobs) {
        setFiles(result.blobs);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleDeleteFile = async (url: string) => {
    try {
      const result = await deleteFile(url);
      if (result.success) {
        setMessage('✅ File deleted successfully');
        await loadFiles();
      } else {
        setMessage(`❌ Delete failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vercel Blob Storage Demo</CardTitle>
          <CardDescription>
            Test uploading and managing files in Vercel Blob storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Test Data (JSON):
            </label>
            <Textarea
              value={testData}
              onChange={(e) => setTestData(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleUploadTestData}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Test Data'}
            </Button>
            
            <Button 
              onClick={loadFiles}
              variant="outline"
            >
              Load Files
            </Button>
          </div>

          {message && (
            <div className={`p-3 rounded-md ${
              message.includes('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stored Files</CardTitle>
          <CardDescription>
            Files currently stored in Vercel Blob
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-gray-500">No files found. Click "Load Files" to refresh.</p>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{file.filename}</div>
                    <div className="text-sm text-gray-500">
                      {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600 break-all">{file.url}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(file.url, '_blank')}
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteFile(file.url)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

