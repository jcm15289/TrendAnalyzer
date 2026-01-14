import { BaseMonitor } from './base-monitor';

/**
 * Simple monitor for your local development server
 * Usage: npx tsx debug/monitor-localhost.ts
 */

async function main() {
  const monitor = new BaseMonitor({
    exitOnError: false,
    clearOnRefresh: true,
    captureNetwork: true,
    captureConsole: true,
    headless: false,
    url: process.env.MONITOR_URL || 'http://localhost:9002',
  });

  try {
    console.log('🎯 Starting localhost monitor...');
    console.log('📊 Monitoring console logs and network activity');
    console.log('💡 The browser will stay open and logs will appear here');
    console.log('🔄 Refresh the page to see new logs');
    console.log('⌨️  Press Ctrl+C to stop monitoring\n');

    await monitor.launch();

    // Keep the script running
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error);
    await monitor.close();
    process.exit(1);
  }
}

main();

