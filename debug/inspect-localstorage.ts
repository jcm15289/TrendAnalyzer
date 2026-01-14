import { BaseMonitor } from './base-monitor';

/**
 * Script to inspect localStorage contents on production or localhost
 * Usage: npx tsx debug/inspect-localstorage.ts [url]
 * 
 * Examples:
 *   npx tsx debug/inspect-localstorage.ts
 *   npx tsx debug/inspect-localstorage.ts https://stockscan-mymac.vercel.app/
 *   npx tsx debug/inspect-localstorage.ts http://localhost:3000
 */

async function main() {
  const url = process.argv[2] || 'https://stockscan-mymac.vercel.app/';
  
  const monitor = new BaseMonitor({
    exitOnError: false,
    clearOnRefresh: false,
    captureNetwork: false,
    captureConsole: true,
    headless: false,
    url,
  });

  try {
    console.log('🎯 Inspecting localStorage...');
    console.log(`🌐 URL: ${url}\n`);

    const page = await monitor.launch();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give time for data to load

    // Get comprehensive localStorage info
    const localStorageInfo = await page.evaluate(() => {
      const data: Record<string, { 
        size: number; 
        preview: string;
        type: string;
      }> = {};
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              // Try to parse as JSON to get type
              let type = 'string';
              let preview = value;
              try {
                const parsed = JSON.parse(value);
                type = Array.isArray(parsed) ? 'array' : typeof parsed;
                preview = JSON.stringify(parsed).substring(0, 200);
              } catch {
                preview = value.substring(0, 200);
              }
              
              data[key] = {
                size: value.length,
                preview: preview.length < value.length ? preview + '...' : preview,
                type
              };
            }
          } catch (e) {
            data[key] = {
              size: 0,
              preview: '<error reading>',
              type: 'error'
            };
          }
        }
      }
      
      return data;
    });

    // Get specific stock table data
    const stockTableData = await page.evaluate(() => {
      const dcfValuesRaw = localStorage.getItem('stockTableDcfValues');
      const stockTableDataRaw = localStorage.getItem('stockTableData');
      const fileInfoRaw = localStorage.getItem('stockTableFileInfo');
      
      let dcfCount = 0;
      let dcfSymbols: string[] = [];
      if (dcfValuesRaw) {
        try {
          const parsed = JSON.parse(dcfValuesRaw);
          if (Array.isArray(parsed)) {
            dcfCount = parsed.length;
            dcfSymbols = parsed.slice(0, 10).map((item: any) => item[0]);
          }
        } catch {}
      }
      
      let rowCount = 0;
      if (stockTableDataRaw) {
        try {
          const parsed = JSON.parse(stockTableDataRaw);
          rowCount = parsed?.rows?.length || 0;
        } catch {}
      }
      
      let fileDate = null;
      if (fileInfoRaw) {
        try {
          const parsed = JSON.parse(fileInfoRaw);
          fileDate = parsed?.fileDate || parsed?.lastModified;
        } catch {}
      }
      
      return { dcfCount, dcfSymbols, rowCount, fileDate };
    });

    console.log('\n📊 === LOCALSTORAGE SUMMARY ===\n');
    console.log(`Total Items: ${Object.keys(localStorageInfo).length}`);
    console.log(`Total Size: ${Object.values(localStorageInfo).reduce((sum, item) => sum + item.size, 0).toLocaleString()} bytes\n`);

    if (Object.keys(localStorageInfo).length === 0) {
      console.log('⚠️  LocalStorage is EMPTY!\n');
      console.log('This is expected for:');
      console.log('  - First visit to the site');
      console.log('  - After clearing browser data');
      console.log('  - Different domain (localhost vs production)\n');
      console.log('💡 To populate localStorage:');
      console.log('  1. Upload a CSV file');
      console.log('  2. Or click "Load Sample" button');
      console.log('  3. Wait for calculations to complete\n');
    } else {
      console.log('📋 === LOCALSTORAGE ITEMS ===\n');
      Object.entries(localStorageInfo)
        .sort((a, b) => b[1].size - a[1].size) // Sort by size
        .forEach(([key, info]) => {
          console.log(`📦 ${key}`);
          console.log(`   Type: ${info.type}`);
          console.log(`   Size: ${info.size.toLocaleString()} bytes (${(info.size / 1024).toFixed(1)} KB)`);
          console.log(`   Preview: ${info.preview}`);
          console.log('');
        });
    }

    console.log('\n💼 === STOCK TABLE SPECIFIC DATA ===\n');
    console.log(`DCF Values Count: ${stockTableData.dcfCount}`);
    if (stockTableData.dcfSymbols.length > 0) {
      console.log(`Sample Symbols: ${stockTableData.dcfSymbols.join(', ')}`);
    }
    console.log(`CSV Row Count: ${stockTableData.rowCount}`);
    console.log(`File Date: ${stockTableData.fileDate || 'Not set'}\n`);

    if (stockTableData.dcfCount === 0 && stockTableData.rowCount > 0) {
      console.log('⚠️  WARNING: CSV data exists but NO DCF calculations!');
      console.log('   This means:');
      console.log('   - Data was loaded but calculations not performed');
      console.log('   - Or calculations are still in progress');
      console.log('   - Or auto-calculate is disabled\n');
    }

    if (stockTableData.dcfCount > 0 && stockTableData.rowCount === 0) {
      console.log('⚠️  WARNING: DCF calculations exist but NO CSV data!');
      console.log('   This is an inconsistent state.\n');
    }

    console.log('✅ Inspection complete!');
    console.log('💡 Browser will stay open - close it when done or press Ctrl+C\n');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error);
    await monitor.close();
    process.exit(1);
  }
}

main();

