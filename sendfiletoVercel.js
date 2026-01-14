#!/usr/bin/env node

/**
 * Send File to Vercel Blob Storage
 * 
 * Usage:
 *   node sendfiletoVercel.js <file_path> [options]
 * 
 * Options:
 *   --folder <folder>     Target folder in blob storage (default: 'trends-data')
 *   --filename <name>     Custom filename (default: original filename)
 *   --server <url>        Server URL (default: http://localhost:9002)
 *   --help               Show this help message
 * 
 * Examples:
 *   node sendfiletoVercel.js data.json
 *   node sendfiletoVercel.js report.pdf --folder reports
 *   node sendfiletoVercel.js trends.json --filename ai-trends-2024.json
 *   node sendfiletoVercel.js data.json --server https://your-app.vercel.app
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
const DEFAULT_SERVER = 'http://localhost:9002';
const DEFAULT_FOLDER = 'trends-data';

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
  console.log(colorize('Send File to Vercel Blob Storage', 'bright'));
  console.log('');
  console.log('Usage:');
  console.log('  node sendfiletoVercel.js <file_path> [options]');
  console.log('');
  console.log('Options:');
  console.log('  --folder <folder>     Target folder in blob storage (default: trends-data)');
  console.log('  --filename <name>     Custom filename (default: original filename)');
  console.log('  --server <url>        Server URL (default: http://localhost:9002)');
  console.log('  --help               Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node sendfiletoVercel.js data.json');
  console.log('  node sendfiletoVercel.js report.pdf --folder reports');
  console.log('  node sendfiletoVercel.js trends.json --filename ai-trends-2024.json');
  console.log('  node sendfiletoVercel.js data.json --server https://your-app.vercel.app');
  console.log('');
  console.log('File Types Supported:');
  console.log('  - JSON files (.json) - uploaded as JSON data');
  console.log('  - Text files (.txt, .csv, .log) - uploaded as text');
  console.log('  - Binary files (.pdf, .png, .jpg, etc.) - uploaded as files');
}

function parseArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    process.exit(0);
  }

  const filePath = args[0];
  const options = {
    folder: DEFAULT_FOLDER,
    filename: null,
    server: DEFAULT_SERVER
  };

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--folder':
        options.folder = value;
        break;
      case '--filename':
        options.filename = value;
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
    isText: ['.txt', '.csv', '.log', '.md', '.html', '.css', '.js', '.ts'].includes(ext)
  };
}

async function uploadFile(fileInfo, options) {
  const { server, folder, filename } = options;
  const finalFilename = filename || fileInfo.basename;
  
  console.log(colorize('📤 Uploading file...', 'blue'));
  console.log(`   File: ${fileInfo.path}`);
  console.log(`   Size: ${formatFileSize(fileInfo.size)}`);
  console.log(`   Target: ${folder}/${finalFilename}`);
  console.log(`   Server: ${server}`);
  console.log('');

  let response;
  
  if (fileInfo.isJson) {
    // Upload as JSON data
    console.log(colorize('📋 Uploading as JSON data...', 'cyan'));
    const jsonData = JSON.parse(fs.readFileSync(fileInfo.path, 'utf8'));
    
    response = await fetch(`${server}/api/blob/upload`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: jsonData,
        filename: finalFilename,
        folder: folder
      }),
    });
  } else {
    // Upload as file
    console.log(colorize('📁 Uploading as file...', 'cyan'));
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(fileInfo.path);
    const blob = new Blob([fileBuffer]);
    
    formData.append('file', blob, finalFilename);
    formData.append('filename', finalFilename);
    formData.append('folder', folder);

    response = await fetch(`${server}/api/blob/upload`, {
      method: 'POST',
      body: formData,
    });
  }

  const result = await response.json();
  
  if (result.success) {
    console.log(colorize('✅ Upload successful!', 'green'));
    console.log(`   URL: ${result.url}`);
    console.log(`   Size: ${formatFileSize(result.size)}`);
    console.log(`   Uploaded: ${new Date(result.uploadedAt).toLocaleString()}`);
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

async function testConnection(server) {
  try {
    console.log(colorize('🔍 Testing server connection...', 'yellow'));
    const response = await fetch(`${server}/api/blob/list?folder=test&limit=1`);
    const result = await response.json();
    
    if (result.error && result.error.includes('BLOB_READ_WRITE_TOKEN')) {
      console.log(colorize('⚠️  Server is running but needs BLOB_READ_WRITE_TOKEN', 'yellow'));
      console.log('   Please set up the environment variable and restart the server');
      return false;
    } else if (result.success) {
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

async function main() {
  try {
    console.log(colorize('🚀 Send File to Vercel Blob Storage', 'bright'));
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
    console.log(`   You can access your file at: ${result.url}`);
    
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

module.exports = { uploadFile, testConnection, getFileInfo };
