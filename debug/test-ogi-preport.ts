import { BaseMonitor } from './base-monitor';

async function testOGIPreport() {
  console.log('🔍 ====== TESTING OGI PREPORT FETCH ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    // Navigate to the production site
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(8000); // Wait for page to load
    
    console.log('✅ Page loaded');
    
    // Wait for table to appear
    await page.waitForTimeout(5000);
    
    // Find and click OGI traffic icon
    console.log('🔍 Looking for OGI (Organigram) traffic icon...');
    
    const clicked = await page.evaluate(() => {
      // Find the row for OGI
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      let ogiRow: HTMLElement | null = null;
      
      for (const row of rows) {
        const text = row.textContent || '';
        if (text.includes('Organigram') || text.includes('OGI')) {
          ogiRow = row as HTMLElement;
          console.log('🔍 Found OGI row');
          break;
        }
      }
      
      if (ogiRow) {
        // Look for button in last cell (traffic icon)
        const cells = Array.from(ogiRow.querySelectorAll('td'));
        if (cells.length > 0) {
          const lastCell = cells[cells.length - 1];
          const button = lastCell.querySelector('button');
          if (button) {
            console.log('🔍 Clicking OGI traffic icon button...');
            (button as HTMLElement).click();
            return true;
          }
        }
      }
      return false;
    });
    
    console.log(`🔍 Click result: ${clicked}`);
    
    // Wait for API calls and dialog
    await page.waitForTimeout(10000);
    
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

testOGIPreport().catch(console.error);





