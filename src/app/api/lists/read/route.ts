import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

const LISTS_KEY = 'geopol:lists';

export async function GET() {
  try {
    const redis = await getRedisClient();
    const listsData = await redis.get(LISTS_KEY);
    
    if (listsData) {
      const lists = JSON.parse(listsData);
      return NextResponse.json({ 
        success: true, 
        lists,
        source: 'redis'
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      lists: [],
      source: 'empty'
    });
  } catch (error) {
    console.error('Error reading lists from Redis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read lists from Redis' },
      { status: 500 }
    );
  }
}







