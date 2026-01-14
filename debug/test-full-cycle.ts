import { BaseMonitor } from './base-monitor';

async function main() {
  const monitor = new BaseMonitor({
    url: 'http://localhost:3000',
    captureConsole: true,
    captureNetwork: false,
  });

  try {
    console.log('🔵 FIRST LOAD - Starting from empty localStorage');
    await monitor.launch();
    
    console.log('⏳ Waiting 25 seconds for some calculations to complete...');
    await monitor.page!.waitForTimeout(25000);
    
    const firstCheck = await monitor.page!.evaluate(() => {
      const dcfValues = localStorage.getItem('stockTableDcfValues');
      if (dcfValues) {
        const parsed = JSON.parse(dcfValues);
        const successCount = parsed.filter(([, val]: [string, any]) => val.status === 'success').length;
        const idleCount = parsed.filter(([, val]: [string, any]) => val.status === 'idle').length;
        const loadingCount = parsed.filter(([, val]: [string, any]) => val.status === 'loading').length;
        return { total: parsed.length, success: successCount, idle: idleCount, loading: loadingCount };
      }
      return null;
    });
    
    console.log('\n📊 After first load:', firstCheck);
    
    if (!firstCheck || firstCheck.success === 0) {
      console.log('❌ No successful calculations yet, waiting longer...');
      await monitor.page!.waitForTimeout(15000);
    }
    
    console.log('\n🔄 RELOADING PAGE to test fast load...');
    await monitor.page!.reload();
    
    console.log('⏳ Waiting 5 seconds after reload...');
    await monitor.page!.waitForTimeout(5000);
    
    const secondCheck = await monitor.page!.evaluate(() => {
      const dcfValues = localStorage.getItem('stockTableDcfValues');
      if (dcfValues) {
        const parsed = JSON.parse(dcfValues);
        const successCount = parsed.filter(([, val]: [string, any]) => val.status === 'success').length;
        const idleCount = parsed.filter(([, val]: [string, any]) => val.status === 'idle').length;
        return { total: parsed.length, success: successCount, idle: idleCount };
      }
      return null;
    });
    
    console.log('\n📊 After reload:', secondCheck);
    
    if (secondCheck && secondCheck.success > 0) {
      console.log(`\n✅ SUCCESS! ${secondCheck.success} calculations preserved from localStorage!`);
      console.log(`🎯 Fast load is working - only ${secondCheck.idle} need recalculation`);
    } else {
      console.log('\n⚠️ No success status found - check if calculations completed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

main();

