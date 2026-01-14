import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cacheDir = path.join(process.cwd(), '..', 'Cache_TrendKeywords');
    const localFiles: Record<string, any> = {};
    
    if (!fs.existsSync(cacheDir)) {
      return NextResponse.json({
        success: true,
        files: {},
        message: 'Cache directory not found'
      });
    }
    
    try {
      const files = fs.readdirSync(cacheDir);
      const trendFiles = files.filter(file => file.startsWith('Trends.'));
      
      for (const file of trendFiles) {
        const filePath = path.join(cacheDir, file);
        const stats = fs.statSync(filePath);
        const keyword = file.replace('Trends.', '');
        
        localFiles[keyword] = {
          filename: file,
          path: filePath,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          size: stats.size,
          exists: true
        };
      }
    } catch (error) {
      console.error('Error reading local files:', error);
      return NextResponse.json({
        success: false,
        error: 'Error reading local files',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      files: localFiles,
      count: Object.keys(localFiles).length
    });

  } catch (error) {
    console.error('Local files API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
