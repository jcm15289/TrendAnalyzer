import { BaseMonitor } from './base-monitor';

/**
 * Monitor production site on Vercel
 * Usage: npx tsx debug/monitor-production.ts
 */

async function main() {
  const monitor = new BaseMonitor({
    exitOnError: false,
    clearOnRefresh: true,
    captureNetwork: true,
    captureConsole: true,
    headless: false,
    url: 'https://stockscan-mymac.vercel.app/',
  });

  try {
    console.log('🎯 Starting production site monitor...');
    console.log('🌐 Monitoring: https://stockscan-mymac.vercel.app/');
    console.log('📊 Watching console logs, network activity, and localStorage');
    console.log('💡 The browser will stay open and logs will appear here');
    console.log('🔄 Refresh the page to see new logs');
    console.log('⌨️  Press Ctrl+C to stop monitoring\n');

    const page = await monitor.launch();

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    console.log('\n🔍 Checking localStorage...');
    
    // Check localStorage contents
    const localStorageData = await page.evaluate(() => {
      const data: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const value = localStorage.getItem(key);
            data[key] = value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : null;
          } catch (e) {
            data[key] = '<error reading>';
          }
        }
      }
      return {
        count: localStorage.length,
        keys: Object.keys(data),
        data
      };
    });

    console.log(`\n📦 LocalStorage Status:`);
    console.log(`   Items: ${localStorageData.count}`);
    console.log(`   Keys: ${localStorageData.keys.join(', ') || 'None'}`);
    if (localStorageData.count > 0) {
      console.log(`\n📋 LocalStorage Contents:`);
      Object.entries(localStorageData.data).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    } else {
      console.log(`   ⚠️  LocalStorage is empty!`);
    }

    console.log('\n✅ Monitoring active - interact with the page to see logs...\n');

    // Keep the script running
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error);
    await monitor.close();
    process.exit(1);
  }
}

main();

