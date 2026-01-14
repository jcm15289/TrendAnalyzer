import { BaseMonitor } from './base-monitor';

async function main() {
  const monitor = new BaseMonitor({
    url: 'http://localhost:3000',
    captureConsole: false,
    captureNetwork: false,
  });

  try {
    await monitor.launch();
    console.log('✅ Page loaded, waiting 3 seconds...');
    await monitor.page!.waitForTimeout(3000);
    
    await monitor.page!.screenshot({ 
      path: 'debug/screenshots/initial-state.png',
      fullPage: false
    });
    console.log('📸 Screenshot saved: debug/screenshots/initial-state.png');
    
    console.log('⏳ Waiting 20 seconds for calculations...');
    await monitor.page!.waitForTimeout(20000);
    
    await monitor.page!.screenshot({ 
      path: 'debug/screenshots/after-20sec.png',
      fullPage: false
    });
    console.log('📸 Screenshot saved: debug/screenshots/after-20sec.png');
    
    const localStorageStatus = await monitor.page!.evaluate(() => {
      const dcfValues = localStorage.getItem('stockTableDcfValues');
      if (dcfValues) {
        const parsed = JSON.parse(dcfValues);
        const successCount = parsed.filter(([, val]: [string, any]) => val.status === 'success').length;
        return { total: parsed.length, success: successCount };
      }
      return { total: 0, success: 0 };
    });
    
    console.log('📊 LocalStorage status:', localStorageStatus);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

main();

