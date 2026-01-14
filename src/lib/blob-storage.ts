/**
 * Vercel Blob Storage Utility Functions
 * Provides easy-to-use functions for uploading, listing, and managing files in Vercel Blob
 */

export interface BlobUploadResponse {
  success: boolean;
  url?: string;
  pathname?: string;
  size?: number;
  uploadedAt?: string;
  error?: string;
}

export interface BlobItem {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  filename: string;
  folder: string;
}

export interface BlobListResponse {
  success: boolean;
  blobs?: BlobItem[];
  count?: number;
  error?: string;
}

/**
 * Upload a file to Vercel Blob
 */
export async function uploadFile(
  file: File,
  filename?: string,
  folder: string = 'trends-data'
): Promise<BlobUploadResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (filename) formData.append('filename', filename);
    formData.append('folder', folder);

    const response = await fetch('/api/blob/upload', {
      method: 'POST',
      body: formData,
    });

    return await response.json();
  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
}

/**
 * Upload JSON data to Vercel Blob
 */
export async function uploadJsonData(
  data: any,
  filename: string,
  folder: string = 'trends-data'
): Promise<BlobUploadResponse> {
  try {
    const response = await fetch('/api/blob/upload', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data, filename, folder }),
    });

    return await response.json();
  } catch (error) {
    console.error('JSON upload error:', error);
    return { success: false, error: 'JSON upload failed' };
  }
}

/**
 * List files in a folder
 */
export async function listFiles(
  folder: string = 'trends-data',
  limit: number = 100,
  prefix?: string
): Promise<BlobListResponse> {
  try {
    const params = new URLSearchParams({
      folder,
      limit: limit.toString(),
    });
    
    if (prefix) {
      params.append('prefix', prefix);
    }

    const response = await fetch(`/api/blob/list?${params}`);
    return await response.json();
  } catch (error) {
    console.error('List error:', error);
    return { success: false, error: 'List failed' };
  }
}

/**
 * Delete a file from Vercel Blob
 */
export async function deleteFile(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/blob/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    return await response.json();
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: 'Delete failed' };
  }
}

/**
 * Upload Google Trends data
 */
export async function uploadTrendsData(
  trendsData: any,
  keyword: string,
  dateRange?: string
): Promise<BlobUploadResponse> {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${keyword}-trends-${dateRange || 'latest'}-${timestamp}.json`;
  
  return uploadJsonData(trendsData, filename, 'trends-data');
}

/**
 * Upload report data
 */
export async function uploadReport(
  reportData: any,
  reportType: string,
  date?: string
): Promise<BlobUploadResponse> {
  const timestamp = date || new Date().toISOString().split('T')[0];
  const filename = `${reportType}-report-${timestamp}.json`;
  
  return uploadJsonData(reportData, filename, 'reports');
}

/**
 * Get the latest trends data for a keyword
 */
export async function getLatestTrendsData(keyword: string): Promise<BlobItem | null> {
  try {
    const response = await listFiles('trends-data', 50, keyword);
    
    if (response.success && response.blobs && response.blobs.length > 0) {
      // Sort by upload date and get the latest
      const sorted = response.blobs.sort((a, b) => 
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );
      return sorted[0];
    }
    
    return null;
  } catch (error) {
    console.error('Get latest trends error:', error);
    return null;
  }
}

