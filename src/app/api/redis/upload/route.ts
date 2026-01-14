import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const key = formData.get('key') as string;
    const ttlRaw = formData.get('ttl');
    const defaultTtl = 7 * 24 * 60 * 60;
    let ttl: number | undefined;

    if (ttlRaw === null) {
      ttl = defaultTtl;
    } else {
      const parsed = parseInt(ttlRaw as string, 10);
      ttl = Number.isNaN(parsed) ? defaultTtl : parsed;
    }
    const folder = (formData.get('folder') as string) || 'files';
    const metadataStr = formData.get('metadata') as string;

    if (!file || !key) {
      return NextResponse.json(
        { error: 'File and key are required' },
        { status: 400 }
      );
    }

    // Create Redis client
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        { error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer();
    const fileContent = Buffer.from(fileBuffer);
    
    // Parse provided metadata or create default
    let metadata;
    if (metadataStr) {
      try {
        const providedMetadata = JSON.parse(metadataStr);
        metadata = {
          filename: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          folder: folder,
          ...providedMetadata // Merge provided metadata
        };
      } catch (error) {
        console.warn('Failed to parse metadata, using defaults:', error);
        metadata = {
          filename: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date().toISOString(),
          folder: folder
        };
      }
    } else {
      metadata = {
        filename: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        folder: folder
      };
    }

    // Store file content and metadata
    const redisKey = `${folder}:${key}`;
    const fileData = {
      content: fileContent.toString('base64'),
      metadata: metadata
    };

    const payload = JSON.stringify(fileData);

    if (ttl !== undefined && ttl > 0) {
      await redis.setEx(redisKey, ttl, payload);
    } else {
      await redis.set(redisKey, payload);
      await redis.persist(redisKey);
    }

    return NextResponse.json({
      success: true,
      key: redisKey,
      filename: file.name,
      size: file.size,
      ttl: ttl !== undefined && ttl > 0 ? ttl : null,
      uploadedAt: metadata.uploadedAt,
      message: 'File uploaded to Redis successfully'
    });

  } catch (error) {
    console.error('Redis upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file to Redis' },
      { status: 500 }
    );
  }
}

// Handle JSON data upload
export async function PUT(request: NextRequest) {
  try {
    const { data, key, ttl: ttlInput, folder = 'data' } = await request.json();
    const defaultTtl = 7 * 24 * 60 * 60;
    let ttl: number | undefined;

    if (typeof ttlInput === 'number') {
      ttl = Number.isNaN(ttlInput) ? defaultTtl : ttlInput;
    } else if (typeof ttlInput === 'string') {
      const parsed = parseInt(ttlInput, 10);
      ttl = Number.isNaN(parsed) ? defaultTtl : parsed;
    } else if (ttlInput === undefined || ttlInput === null) {
      ttl = defaultTtl;
    } else {
      ttl = defaultTtl;
    }

    if (!data || !key) {
      return NextResponse.json(
        { error: 'Data and key are required' },
        { status: 400 }
      );
    }

    // Create Redis client
    const redis = await getRedisClient();

    if (!redis) {
      return NextResponse.json(
        { error: 'Redis connection unavailable' },
        { status: 503 },
      );
    }

    // Create metadata
    const metadata = {
      type: 'json',
      size: JSON.stringify(data).length,
      uploadedAt: new Date().toISOString(),
      folder: folder
    };

    // Store data and metadata
    const redisKey = `${folder}:${key}`;
    const redisData = {
      content: data,
      metadata: metadata
    };

    const payload = JSON.stringify(redisData);

    if (ttl !== undefined && ttl > 0) {
      await redis.setEx(redisKey, ttl, payload);
    } else {
      await redis.set(redisKey, payload);
      await redis.persist(redisKey);
    }

    return NextResponse.json({
      success: true,
      key: redisKey,
      size: metadata.size,
      ttl: ttl !== undefined && ttl > 0 ? ttl : null,
      uploadedAt: metadata.uploadedAt,
      message: 'Data uploaded to Redis successfully'
    });

  } catch (error) {
    console.error('Redis upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload data to Redis' },
      { status: 500 }
    );
  }
}
