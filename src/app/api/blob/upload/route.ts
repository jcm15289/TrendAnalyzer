import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = formData.get('filename') as string;
    const folder = formData.get('folder') as string || 'trends-data';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create a unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = filename || `${timestamp}-${file.name}`;
    const blobPath = `${folder}/${finalFilename}`;

    // Upload to Vercel Blob
    const blob = await put(blobPath, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    });

  } catch (error) {
    console.error('Blob upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Handle JSON data upload
export async function PUT(request: NextRequest) {
  try {
    const { data, filename, folder = 'trends-data' } = await request.json();

    if (!data || !filename) {
      return NextResponse.json(
        { error: 'Data and filename are required' },
        { status: 400 }
      );
    }

    // Convert data to JSON string
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Create a unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const finalFilename = `${timestamp}-${filename}`;
    const blobPath = `${folder}/${finalFilename}`;

    // Upload to Vercel Blob
    const result = await put(blobPath, blob, {
      access: 'public',
      addRandomSuffix: false,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      pathname: result.pathname,
      size: result.size,
      uploadedAt: result.uploadedAt,
    });

  } catch (error) {
    console.error('Blob upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload data' },
      { status: 500 }
    );
  }
}

