import { BaseMonitor } from './base-monitor';

async function main() {
  const monitor = new BaseMonitor({
    url: 'http://localhost:3000',
    captureConsole: true,
    captureNetwork: false,
  });

  try {
    await monitor.launch();
    console.log('✅ Page loaded, waiting 15 seconds to capture logs...');
    
    await monitor.page!.waitForTimeout(15000);
    
    console.log('\n📊 Checking localStorage status...');
    const localStorageCheck = await monitor.page!.evaluate(() => {
      const dcfValues = localStorage.getItem('stockTableDcfValues');
      if (dcfValues) {
        try {
          const parsed = JSON.parse(dcfValues);
          const successCount = parsed.filter(([, val]: [string, any]) => val.status === 'success').length;
          return { found: true, total: parsed.length, success: successCount };
        } catch (e) {
          return { found: true, error: 'Failed to parse' };
        }
      }
      return { found: false };
    });
    
    console.log('LocalStorage status:', localStorageCheck);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

main();

