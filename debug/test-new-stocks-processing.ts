import { BaseMonitor } from './base-monitor';

async function testNewStocksProcessing() {
  console.log('🔍 ====== TESTING NEW STOCKS PROCESSING ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle', timeout: 60000 });
    
    console.log('⏳ Waiting for page to load and initial calculations...');
    await page.waitForTimeout(10000);
    
    // Check for symbols that might not have PSG
    console.log('📊 Checking for stocks without PSG...');
    const stockStatus = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const stocksWithoutPSG: Array<{symbol: string, company: string, psg: string}> = [];
      const stocksWithPSG: Array<{symbol: string, company: string, psg: string}> = [];
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 3) return;
        
        const companyCell = cells[0];
        const psgCell = cells.find((cell, idx) => {
          const header = document.querySelector(`thead th:nth-child(${idx + 1})`);
          return header?.textContent?.trim() === 'PSG';
        });
        
        if (companyCell && psgCell) {
          const company = companyCell.textContent?.trim() || '';
          const symbol = company.split('\n')[1] || company;
          const psg = psgCell.textContent?.trim() || '';
          
          if (!psg || psg === '' || psg === '—') {
            stocksWithoutPSG.push({ symbol, company, psg });
          } else {
            stocksWithPSG.push({ symbol, company, psg });
          }
        }
      });
      
      return { stocksWithoutPSG, stocksWithPSG };
    });
    
    console.log('📊 Stocks without PSG:', stockStatus.stocksWithoutPSG.length);
    console.log('📊 Stocks with PSG:', stockStatus.stocksWithPSG.length);
    
    if (stockStatus.stocksWithoutPSG.length > 0) {
      console.log('⚠️ Found stocks without PSG:', stockStatus.stocksWithoutPSG.slice(0, 10));
    }
    
    // Check console logs for calculation queue status
    console.log('📋 Checking calculation queue status...');
    
    // Wait for more processing
    console.log('⏳ Waiting 15 seconds for calculations to process...');
    await page.waitForTimeout(15000);
    
    // Check again
    const stockStatusAfter = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const stocksWithoutPSG: Array<{symbol: string, company: string, psg: string}> = [];
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 3) return;
        
        const companyCell = cells[0];
        const psgCell = cells.find((cell, idx) => {
          const header = document.querySelector(`thead th:nth-child(${idx + 1})`);
          return header?.textContent?.trim() === 'PSG';
        });
        
        if (companyCell && psgCell) {
          const company = companyCell.textContent?.trim() || '';
          const symbol = company.split('\n')[1] || company;
          const psg = psgCell.textContent?.trim() || '';
          
          if (!psg || psg === '' || psg === '—') {
            stocksWithoutPSG.push({ symbol, company, psg });
          }
        }
      });
      
      return { stocksWithoutPSG };
    });
    
    console.log('📊 Stocks without PSG after waiting:', stockStatusAfter.stocksWithoutPSG.length);
    if (stockStatusAfter.stocksWithoutPSG.length > 0) {
      console.log('⚠️ Still missing PSG for:', stockStatusAfter.stocksWithoutPSG.slice(0, 10));
    }
    
    console.log('\n⏳ Keeping browser open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await monitor.close();
  }
}

testNewStocksProcessing().catch(console.error);







