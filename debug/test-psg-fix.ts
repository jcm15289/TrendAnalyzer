import { BaseMonitor } from './base-monitor';

async function main() {
  const monitor = new BaseMonitor({
    url: 'http://localhost:3000',
    captureConsole: true,
    captureNetwork: false,
  });

  try {
    await monitor.launch();
    console.log('✅ Page loaded, waiting 30 seconds for calculations...');
    await monitor.page!.waitForTimeout(30000);
    
    // Check PSG values in localStorage
    const psgStatus = await monitor.page!.evaluate(() => {
      const dcfValues = localStorage.getItem('stockTableDcfValues');
      if (dcfValues) {
        const parsed = JSON.parse(dcfValues);
        let totalStocks = 0;
        let withPSG = 0;
        let withoutGrowth = 0;
        const samples: any[] = [];
        
        parsed.forEach(([symbol, val]: [string, any]) => {
          totalStocks++;
          if (val.psg !== null && val.psg !== undefined) {
            withPSG++;
            if (samples.length < 10) {
              samples.push({ symbol, psg: val.psg, growth: val.growthRate });
            }
          }
          if (val.growthRate === 0) {
            withoutGrowth++;
          }
        });
        
        return { totalStocks, withPSG, withoutGrowth, samples };
      }
      return null;
    });
    
    console.log('\n📊 PSG Calculation Results:');
    console.log(`   Total stocks: ${psgStatus?.totalStocks || 0}`);
    console.log(`   ✅ With PSG: ${psgStatus?.withPSG || 0}`);
    console.log(`   ❌ Without growth (PE=0): ${psgStatus?.withoutGrowth || 0}`);
    console.log(`   📈 PSG Coverage: ${((psgStatus?.withPSG || 0) / (psgStatus?.totalStocks || 1) * 100).toFixed(1)}%`);
    console.log('\n   Sample PSG values:');
    psgStatus?.samples.forEach((s: any) => {
      console.log(`      ${s.symbol}: PSG=${s.psg.toFixed(3)}, Growth=${s.growth}%`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

main();

