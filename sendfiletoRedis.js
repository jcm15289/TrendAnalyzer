#!/usr/bin/env node

/**
 * Send File to Redis Database
 * 
 * Usage:
 *   node sendfiletoRedis.js <file_path> [options]
 * 
 * Options:
 *   --key <key>         Redis key (default: filename)
 *   --folder <folder>   Redis folder prefix (default: 'files')
 *   --ttl <seconds>     Time to live in seconds (default: 604800 = 7 days)
 *   --server <url>      Server URL (default: http://localhost:9002)
 *   --help             Show this help message
 * 
 * Examples:
 *   node sendfiletoRedis.js data.json
 *   node sendfiletoRedis.js report.pdf --key my-report --folder reports
 *   node sendfiletoRedis.js trends.json --key ai-trends-2024 --ttl 86400
 *   node sendfiletoRedis.js data.json --server https://your-app.vercel.app
 */

const fs = require('fs');
const path = require('path');

// Use built-in fetch in Node.js 18+ or import node-fetch for older versions
let fetch;
try {
  fetch = globalThis.fetch;
} catch (error) {
  fetch = require('node-fetch');
}

// Configuration
const DEFAULT_SERVER = 'https://geopol-gtrends.vercel.app';
const DEFAULT_FOLDER = 'files';
const DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function showHelp() {
  console.log(colorize('Send File to Redis Database', 'bright'));
  console.log('');
  console.log('Usage:');
  console.log('  node sendfiletoRedis.js <file_path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --key <key>         Redis key (default: filename)');
  console.log('  --folder <folder>   Redis folder prefix (default: files)');
  console.log('  --ttl <seconds>     Time to live in seconds (default: 604800 = 7 days)');
  console.log('  --server <url>      Server URL (default: http://localhost:9002)');
  console.log('  --help             Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node sendfiletoRedis.js data.json');
  console.log('  node sendfiletoRedis.js report.pdf --key my-report --folder reports');
  console.log('  node sendfiletoRedis.js trends.json --key ai-trends-2024 --ttl 86400');
  console.log('  node sendfiletoRedis.js data.json --server https://your-app.vercel.app');
  console.log('');
  console.log('File Types Supported:');
  console.log('  - JSON files (.json) - uploaded as JSON data');
  console.log('  - Text files (.txt, .csv, .log) - uploaded as files');
  console.log('  - Binary files (.pdf, .png, .jpg, etc.) - uploaded as files');
  console.log('');
  console.log('TTL Examples:');
  console.log('  3600     = 1 hour');
  console.log('  86400    = 1 day');
  console.log('  604800   = 7 days (default)');
  console.log('  2592000  = 30 days');
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const filePath = args[0];
  const options = {
    key: null,
    folder: DEFAULT_FOLDER,
    ttl: DEFAULT_TTL,
    server: DEFAULT_SERVER
  };

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--key':
        options.key = value;
        break;
      case '--folder':
        options.folder = value;
        break;
      case '--ttl':
        options.ttl = parseInt(value);
        break;
      case '--server':
        options.server = value;
        break;
      default:
        console.error(colorize(`Unknown option: ${flag}`, 'red'));
        process.exit(1);
    }
  }

  return { filePath, options };
}

function getFileInfo(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);
  
  return {
    path: filePath,
    size: stats.size,
    extension: ext,
    basename: basename,
    isJson: ext === '.json',
    isText: ['.txt', '.csv', '.log', '.md', '.html', '.css', '.js', '.ts'].includes(ext),
    createdTime: stats.birthtime.toISOString(),
    modifiedTime: stats.mtime.toISOString(),
    uploadTime: new Date().toISOString()
  };
}

async function uploadFile(fileInfo, options) {
  const { server, folder, key, ttl } = options;
  const finalKey = key || fileInfo.basename;
  
  console.log(colorize('📤 Uploading file to Redis...', 'blue'));
  console.log(`   File: ${fileInfo.path}`);
  console.log(`   Size: ${formatFileSize(fileInfo.size)}`);
  console.log(`   Key: ${folder}:${finalKey}`);
  console.log(`   TTL: ${formatTTL(ttl)}`);
  console.log(`   Server: ${server}`);
  console.log(`   File Created: ${new Date(fileInfo.createdTime).toLocaleString()}`);
  console.log(`   File Modified: ${new Date(fileInfo.modifiedTime).toLocaleString()}`);
  console.log(`   Upload Time: ${new Date(fileInfo.uploadTime).toLocaleString()}`);
  console.log('');

  let response;
  
  if (fileInfo.isJson) {
    // Upload as JSON data
    console.log(colorize('📋 Uploading as JSON data...', 'cyan'));
    const jsonData = JSON.parse(fs.readFileSync(fileInfo.path, 'utf8'));
    
    response = await fetch(`${server}/api/redis/upload`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: jsonData,
        key: finalKey,
        folder: folder,
        ttl: ttl,
        metadata: {
          fileCreated: fileInfo.createdTime,
          fileModified: fileInfo.modifiedTime,
          uploadTime: fileInfo.uploadTime,
          originalPath: fileInfo.path,
          fileSize: fileInfo.size
        }
      }),
    });
  } else {
    // Upload as file
    console.log(colorize('📁 Uploading as file...', 'cyan'));
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(fileInfo.path);
    const blob = new Blob([fileBuffer]);
    
    formData.append('file', blob, fileInfo.basename);
    formData.append('key', finalKey);
    formData.append('folder', folder);
    formData.append('ttl', ttl.toString());
    formData.append('metadata', JSON.stringify({
      fileCreated: fileInfo.createdTime,
      fileModified: fileInfo.modifiedTime,
      uploadTime: fileInfo.uploadTime,
      originalPath: fileInfo.path,
      fileSize: fileInfo.size
    }));

    response = await fetch(`${server}/api/redis/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  const result = await response.json();
  
  if (result.success) {
    console.log(colorize('✅ Upload successful!', 'green'));
    console.log(`   Redis Key: ${result.key}`);
    console.log(`   Size: ${formatFileSize(result.size)}`);
    console.log(`   TTL: ${formatTTL(result.ttl)}`);
    console.log(`   Uploaded: ${new Date(result.uploadedAt).toLocaleString()}`);
    if (result.metadata) {
      console.log(`   File Created: ${new Date(result.metadata.fileCreated).toLocaleString()}`);
      console.log(`   File Modified: ${new Date(result.metadata.fileModified).toLocaleString()}`);
      console.log(`   Upload Time: ${new Date(result.metadata.uploadTime).toLocaleString()}`);
    }
    return result;
  } else {
    throw new Error(result.error || 'Upload failed');
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTTL(seconds) {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  return `${Math.floor(seconds / 86400)} days`;
}

async function testConnection(server) {
  try {
    console.log(colorize('🔍 Testing server connection...', 'yellow'));
    const response = await fetch(`${server}/api/redis/list?folder=test&pattern=*`);
    const result = await response.json();
    
    if (result.success) {
      console.log(colorize('✅ Server connection successful!', 'green'));
      return true;
    } else {
      console.log(colorize('❌ Server connection failed', 'red'));
      return false;
    }
  } catch (error) {
    console.log(colorize('❌ Cannot connect to server', 'red'));
    console.log(`   Error: ${error.message}`);
    console.log(`   Make sure the server is running at: ${server}`);
    return false;
  }
}

async function listFiles(server, folder = 'files') {
  try {
    console.log(colorize('📋 Listing files in Redis...', 'yellow'));
    const response = await fetch(`${server}/api/redis/list?folder=${folder}&pattern=*`);
    const result = await response.json();
    
    if (result.success) {
      console.log(colorize(`✅ Found ${result.count} files in folder '${folder}'`, 'green'));
      if (result.files.length > 0) {
        console.log('');
        result.files.forEach((file, index) => {
          console.log(`   ${index + 1}. ${file.filename}`);
          console.log(`      Key: ${file.key}`);
          console.log(`      Size: ${formatFileSize(file.size)}`);
          console.log(`      TTL: ${formatTTL(file.ttl)}`);
          console.log(`      Uploaded: ${new Date(file.uploadedAt).toLocaleString()}`);
          console.log('');
        });
      }
      return result;
    } else {
      console.log(colorize('❌ Failed to list files', 'red'));
      return null;
    }
  } catch (error) {
    console.log(colorize('❌ Error listing files:', 'red'), error.message);
    return null;
  }
}

async function main() {
  try {
    console.log(colorize('🚀 Send File to Redis Database', 'bright'));
    console.log('');

    const { filePath, options } = parseArgs();
    
    // Test server connection first
    const serverOk = await testConnection(options.server);
    if (!serverOk) {
      process.exit(1);
    }
    
    console.log('');
    
    // Get file information
    const fileInfo = getFileInfo(filePath);
    
    // Upload the file
    const result = await uploadFile(fileInfo, options);
    
    console.log('');
    console.log(colorize('🎉 Upload completed successfully!', 'green'));
    console.log(`   Your file is now stored in Redis with key: ${result.key}`);
    
    // Optionally list files in the folder
    console.log('');
    await listFiles(options.server, options.folder);
    
  } catch (error) {
    console.error('');
    console.error(colorize('❌ Error:', 'red'), error.message);
    process.exit(1);
  }
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

module.exports = { uploadFile, testConnection, listFiles, getFileInfo };
