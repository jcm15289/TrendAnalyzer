import { chromium } from 'playwright';

async function main() {
  const url = process.argv[2] || 'http://localhost:3000';
  console.log(`🔍 Checking localStorage for: ${url}\n`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  const storage = await page.evaluate(() => {
    const dcfRaw = localStorage.getItem('stockTableDcfValues');
    const dataRaw = localStorage.getItem('stockTableData');
    
    let dcfCount = 0;
    let sampleSymbols: string[] = [];
    
    if (dcfRaw) {
      try {
        const parsed = JSON.parse(dcfRaw);
        if (Array.isArray(parsed)) {
          dcfCount = parsed.length;
          sampleSymbols = parsed.slice(0, 5).map((item: any) => item[0]);
        }
      } catch {}
    }
    
    let rowCount = 0;
    if (dataRaw) {
      try {
        const parsed = JSON.parse(dataRaw);
        rowCount = parsed?.rows?.length || 0;
      } catch {}
    }
    
    return {
      hasDcf: !!dcfRaw,
      hasData: !!dataRaw,
      dcfCount,
      rowCount,
      sampleSymbols,
      totalSize: Object.keys(localStorage).reduce((sum, key) => {
        const val = localStorage.getItem(key);
        return sum + (val ? val.length : 0);
      }, 0)
    };
  });
  
  console.log('📊 === LOCALSTORAGE STATUS ===\n');
  
  if (!storage.hasDcf && !storage.hasData) {
    console.log('❌ LocalStorage is EMPTY');
    console.log('   This is normal for:');
    console.log('   • First visit ever');
    console.log('   • After clearing browser data');
    console.log('   • Different domain\n');
  } else {
    console.log('✅ LocalStorage contains data!\n');
    console.log(`  CSV Data: ${storage.hasData ? '✅ Yes' : '❌ No'} (${storage.rowCount} rows)`);
    console.log(`  DCF Values: ${storage.hasDcf ? '✅ Yes' : '❌ No'} (${storage.dcfCount} calculations)`);
    console.log(`  Total Size: ${(storage.totalSize / 1024).toFixed(1)} KB`);
    
    if (storage.sampleSymbols.length > 0) {
      console.log(`\n  Sample symbols with calculations:`);
      storage.sampleSymbols.forEach((sym: string) => console.log(`    - ${sym}`));
    }
  }
  
  console.log('\n✅ Check complete!');
  await browser.close();
}

main().catch(console.error);

