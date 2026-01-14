import { list } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'trends-data';
    const limit = parseInt(searchParams.get('limit') || '100');
    const prefix = searchParams.get('prefix') || '';

    // List blobs in the specified folder
    const { blobs } = await list({
      prefix: `${folder}/${prefix}`,
      limit,
    });

    // Transform the response to include useful metadata
    const transformedBlobs = blobs.map(blob => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      filename: blob.pathname.split('/').pop(),
      folder: blob.pathname.split('/').slice(0, -1).join('/'),
    }));

    return NextResponse.json({
      success: true,
      blobs: transformedBlobs,
      count: transformedBlobs.length,
    });

  } catch (error) {
    console.error('Blob list error:', error);
    return NextResponse.json(
      { error: 'Failed to list blobs' },
      { status: 500 }
    );
  }
}

