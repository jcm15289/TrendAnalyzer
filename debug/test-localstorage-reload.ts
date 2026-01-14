import { BaseMonitor } from './base-monitor';

async function main() {
  const monitor = new BaseMonitor({
    url: 'http://localhost:3000',
    captureConsole: true,
    captureNetwork: false,
  });

  try {
    await monitor.launch();
    console.log('✅ Page loaded (first load)');
    
    // Wait for calculations to start
    console.log('⏳ Waiting 10 seconds for calculations to complete...');
    await monitor.page!.waitForTimeout(10000);
    
    // Check localStorage after calculations
    console.log('\n📦 Checking localStorage after calculations:');
    const localStorageAfterCalc = await monitor.page!.evaluate(() => {
      const keys = Object.keys(localStorage);
      const data: Record<string, any> = {};
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (key === 'stockTableDcfValues') {
          try {
            const parsed = JSON.parse(value || '[]');
            data[key] = {
              length: parsed.length,
              sample: parsed.slice(0, 3).map(([sym, val]: [string, any]) => ({
                symbol: sym,
                status: val.status,
                hasGrowthRate: val.growthRate !== null
              }))
            };
          } catch (e) {
            data[key] = value;
          }
        } else {
          data[key] = value?.substring(0, 100);
        }
      });
      return data;
    });
    
    console.log(JSON.stringify(localStorageAfterCalc, null, 2));
    
    // Reload the page
    console.log('\n🔄 Reloading page to test localStorage loading...');
    await monitor.page!.reload();
    
    // Wait for page to load and log localStorage usage
    console.log('⏳ Waiting 5 seconds to observe localStorage loading logs...');
    await monitor.page!.waitForTimeout(5000);
    
    console.log('\n📦 Checking localStorage after reload:');
    const localStorageAfterReload = await monitor.page!.evaluate(() => {
      const keys = Object.keys(localStorage);
      const data: Record<string, any> = {};
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (key === 'stockTableDcfValues') {
          try {
            const parsed = JSON.parse(value || '[]');
            data[key] = {
              length: parsed.length,
              sample: parsed.slice(0, 3).map(([sym, val]: [string, any]) => ({
                symbol: sym,
                status: val.status,
                hasGrowthRate: val.growthRate !== null
              }))
            };
          } catch (e) {
            data[key] = value;
          }
        } else {
          data[key] = value?.substring(0, 100);
        }
      });
      return data;
    });
    
    console.log(JSON.stringify(localStorageAfterReload, null, 2));
    
    console.log('\n✅ Test complete! Check console logs above to see if localStorage was used on reload.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

main();

