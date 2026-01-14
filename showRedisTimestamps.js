#!/usr/bin/env node

/**
 * Show Redis Timestamps - Display comprehensive timestamp information
 * 
 * Usage:
 *   node showRedisTimestamps.js [options]
 * 
 * Options:
 *   --local-only     Show only local file timestamps
 *   --redis-only     Show only Redis timestamps
 *   --help          Show this help message
 * 
 * Examples:
 *   node showRedisTimestamps.js
 *   node showRedisTimestamps.js --local-only
 *   node showRedisTimestamps.js --redis-only
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('redis');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

function showHelp() {
  console.log(colorize('Show Redis Timestamps', 'bright'));
  console.log('');
  console.log('Usage:');
  console.log('  node showRedisTimestamps.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --local-only     Show only local file timestamps');
  console.log('  --redis-only     Show only Redis timestamps');
  console.log('  --help          Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node showRedisTimestamps.js');
  console.log('  node showRedisTimestamps.js --local-only');
  console.log('  node showRedisTimestamps.js --redis-only');
  console.log('');
  console.log('This script shows:');
  console.log('  - Local file creation and modification times');
  console.log('  - Redis upload timestamps');
  console.log('  - Time differences between events');
  console.log('  - File sizes and data integrity');
}

async function getLocalFileInfo() {
  const cacheDir = path.join('..', 'Cache_TrendKeywords');
  const localFiles = {};
  
  if (!fs.existsSync(cacheDir)) {
    console.log(colorize('⚠️  Local cache directory not found:', 'yellow'), cacheDir);
    return localFiles;
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
        created: stats.birthtime,
        modified: stats.mtime,
        size: stats.size,
        exists: true
      };
    }
  } catch (error) {
    console.log(colorize('❌ Error reading local files:', 'red'), error.message);
  }
  
  return localFiles;
}

async function getRedisInfo() {
  const redis = createClient({
    url: process.env.REDIS_URL || 'redis://default:gxrWrXy1C5QJxXjO0sQzAh8JddnAm3il@redis-18997.c289.us-west-1-2.ec2.redns.redis-cloud.com:18997'
  });
  
  const redisData = {};
  
  try {
    await redis.connect();
    const keys = await redis.keys('cache-trends:Trends.*');
    
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        const keyword = key.replace('cache-trends:Trends.', '');
        
        redisData[keyword] = {
          key: key,
          filename: parsed.metadata?.filename || 'Unknown',
          size: parsed.metadata?.size || 0,
          type: parsed.metadata?.type || 'Unknown',
          folder: parsed.metadata?.folder || 'Unknown',
          uploaded: parsed.metadata?.uploadedAt ? new Date(parsed.metadata.uploadedAt) : null,
          exists: true
        };
      }
    }
    
    await redis.disconnect();
  } catch (error) {
    console.log(colorize('❌ Error connecting to Redis:', 'red'), error.message);
  }
  
  return redisData;
}

function showLocalFiles(localFiles) {
  console.log(colorize('📁 Local Cache Files', 'bright'));
  console.log('=' .repeat(60));
  
  if (Object.keys(localFiles).length === 0) {
    console.log(colorize('No local cache files found', 'yellow'));
    return;
  }
  
  const sortedFiles = Object.entries(localFiles).sort((a, b) => a[1].created - b[1].created);
  
  sortedFiles.forEach(([keyword, info], index) => {
    console.log(`\n${index + 1}. ${colorize(keyword.toUpperCase(), 'cyan')}`);
    console.log(`   File: ${info.filename}`);
    console.log(`   Size: ${formatFileSize(info.size)}`);
    console.log(`   Created: ${colorize(info.created.toLocaleString(), 'green')} (${formatTimeAgo(info.created)})`);
    console.log(`   Modified: ${colorize(info.modified.toLocaleString(), 'yellow')} (${formatTimeAgo(info.modified)})`);
    
    const timeDiff = info.modified - info.created;
    const diffMins = Math.floor(timeDiff / (1000 * 60));
    const diffSecs = Math.floor((timeDiff % (1000 * 60)) / 1000);
    console.log(`   Creation to Modification: ${diffMins}m ${diffSecs}s`);
  });
}

function showRedisData(redisData) {
  console.log(colorize('\n☁️  Redis Database', 'bright'));
  console.log('=' .repeat(60));
  
  if (Object.keys(redisData).length === 0) {
    console.log(colorize('No Redis data found', 'yellow'));
    return;
  }
  
  const sortedData = Object.entries(redisData).sort((a, b) => a[1].uploaded - b[1].uploaded);
  
  sortedData.forEach(([keyword, info], index) => {
    console.log(`\n${index + 1}. ${colorize(keyword.toUpperCase(), 'cyan')}`);
    console.log(`   Redis Key: ${info.key}`);
    console.log(`   Filename: ${info.filename}`);
    console.log(`   Size: ${formatFileSize(info.size)}`);
    console.log(`   Type: ${info.type}`);
    console.log(`   Folder: ${info.folder}`);
    console.log(`   Uploaded: ${colorize(info.uploaded.toLocaleString(), 'green')} (${formatTimeAgo(info.uploaded)})`);
  });
}

function showComparison(localFiles, redisData) {
  console.log(colorize('\n🔄 Comparison & Analysis', 'bright'));
  console.log('=' .repeat(60));
  
  const allKeywords = new Set([...Object.keys(localFiles), ...Object.keys(redisData)]);
  const sortedKeywords = Array.from(allKeywords).sort();
  
  sortedKeywords.forEach((keyword, index) => {
    const local = localFiles[keyword];
    const redis = redisData[keyword];
    
    console.log(`\n${index + 1}. ${colorize(keyword.toUpperCase(), 'cyan')}`);
    
    if (local && redis) {
      // Both exist - show comparison
      console.log(`   ${colorize('✅ Both local and Redis', 'green')}`);
      console.log(`   Local Size: ${formatFileSize(local.size)}`);
      console.log(`   Redis Size: ${formatFileSize(redis.size)}`);
      console.log(`   Size Match: ${local.size === redis.size ? colorize('✅ Yes', 'green') : colorize('❌ No', 'red')}`);
      
      if (redis.uploaded) {
        const timeFromModToUpload = redis.uploaded - local.modified;
        const hours = Math.floor(timeFromModToUpload / (1000 * 60 * 60));
        const minutes = Math.floor((timeFromModToUpload % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeFromModToUpload % (1000 * 60)) / 1000);
        
        console.log(`   File Modified: ${local.modified.toLocaleString()}`);
        console.log(`   Redis Upload: ${redis.uploaded.toLocaleString()}`);
        console.log(`   Time Gap: ${hours}h ${minutes}m ${seconds}s`);
      }
    } else if (local && !redis) {
      console.log(`   ${colorize('📁 Local only', 'yellow')} - Not uploaded to Redis`);
    } else if (!local && redis) {
      console.log(`   ${colorize('☁️  Redis only', 'blue')} - Local file not found`);
    }
  });
}

function showSummary(localFiles, redisData) {
  console.log(colorize('\n📊 Summary', 'bright'));
  console.log('=' .repeat(60));
  
  const localCount = Object.keys(localFiles).length;
  const redisCount = Object.keys(redisData).length;
  const bothCount = Object.keys(localFiles).filter(key => redisData[key]).length;
  const localOnlyCount = localCount - bothCount;
  const redisOnlyCount = redisCount - bothCount;
  
  console.log(`Local Files: ${colorize(localCount.toString(), 'green')}`);
  console.log(`Redis Entries: ${colorize(redisCount.toString(), 'blue')}`);
  console.log(`Both Local & Redis: ${colorize(bothCount.toString(), 'cyan')}`);
  console.log(`Local Only: ${colorize(localOnlyCount.toString(), 'yellow')}`);
  console.log(`Redis Only: ${colorize(redisOnlyCount.toString(), 'magenta')}`);
  
  if (bothCount > 0) {
    const sizeMatches = Object.keys(localFiles).filter(key => {
      const local = localFiles[key];
      const redis = redisData[key];
      return local && redis && local.size === redis.size;
    }).length;
    
    console.log(`Size Matches: ${colorize(sizeMatches.toString(), sizeMatches === bothCount ? 'green' : 'yellow')}/${bothCount}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  console.log(colorize('🕒 Redis Timestamps Viewer', 'bright'));
  console.log(colorize('=' .repeat(50), 'gray'));
  
  const showLocal = !args.includes('--redis-only');
  const showRedis = !args.includes('--local-only');
  
  let localFiles = {};
  let redisData = {};
  
  if (showLocal) {
    localFiles = await getLocalFileInfo();
    showLocalFiles(localFiles);
  }
  
  if (showRedis) {
    redisData = await getRedisInfo();
    showRedisData(redisData);
  }
  
  if (showLocal && showRedis) {
    showComparison(localFiles, redisData);
    showSummary(localFiles, redisData);
  }
  
  console.log(colorize('\n✨ Done!', 'green'));
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(colorize('❌ Uncaught Exception:', 'red'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(colorize('❌ Unhandled Rejection at:', 'red'), promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { getLocalFileInfo, getRedisInfo, showLocalFiles, showRedisData, showComparison, showSummary };
