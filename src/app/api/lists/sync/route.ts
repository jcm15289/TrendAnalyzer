import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

const LISTS_KEY = 'geopol:lists';

export async function POST(request: Request) {
  try {
    const { lists } = await request.json();
    
    if (!Array.isArray(lists)) {
      return NextResponse.json(
        { success: false, error: 'Lists must be an array' },
        { status: 400 }
      );
    }
    
    const redis = await getRedisClient();
    await redis.set(LISTS_KEY, JSON.stringify(lists));
    
    return NextResponse.json({ 
      success: true,
      message: 'Lists synced to Redis successfully'
    });
  } catch (error) {
    console.error('Error syncing lists to Redis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync lists to Redis' },
      { status: 500 }
    );
  }
}







