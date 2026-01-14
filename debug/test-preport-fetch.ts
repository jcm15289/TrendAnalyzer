import { BaseMonitor } from './base-monitor';

async function testPreportFetch() {
  console.log('🔍 ====== TESTING PREPORT FETCH ======');
  
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
    await page.waitForTimeout(5000); // Wait for page to load
    
    console.log('✅ Page loaded');
    
    // Wait for the table to appear and calculations to start
    await page.waitForTimeout(10000);
    
    // Try to find and click a traffic icon (Activity icon) for FIVN or Five9
    console.log('🔍 Looking for traffic icon for Five9 (FIVN)...');
    
    // Execute JavaScript to find and click the traffic icon for FIVN
    const clicked = await page.evaluate(() => {
      // Find the row for FIVN (Five9)
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      let fivnRow: HTMLElement | null = null;
      
      for (const row of rows) {
        const text = row.textContent || '';
        if (text.includes('Five9') || text.includes('FIVN')) {
          fivnRow = row as HTMLElement;
          console.log('🔍 Found FIVN row');
          break;
        }
      }
      
      if (fivnRow) {
        // Look for Activity icon in this row - try the last cell first
        const cells = Array.from(fivnRow.querySelectorAll('td'));
        if (cells.length > 0) {
          const lastCell = cells[cells.length - 1];
          
          // Look for button in last cell
          const button = lastCell.querySelector('button');
          if (button) {
            console.log('🔍 Clicking button in last cell of FIVN row...');
            (button as HTMLElement).click();
            return true;
          }
          
          // Also try to find Activity icon
          const icons = Array.from(lastCell.querySelectorAll('svg'));
          console.log(`🔍 Found ${icons.length} SVG icons in last cell`);
          
          for (const icon of icons) {
            const button = icon.closest('button');
            if (button) {
              console.log('🔍 Clicking button with icon in last cell...');
              (button as HTMLElement).click();
              return true;
            }
          }
        }
      } else {
        console.log('⚠️ FIVN row not found');
      }
      
      return false;
    });
    
    console.log(`🔍 Click result: ${clicked}`);
    
    // Wait for dialog to appear and check console logs
    await page.waitForTimeout(8000);
    
    // Check if dialog appeared
    const dialogVisible = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return !!dialog;
    });
    
    console.log(`🔍 Dialog visible: ${dialogVisible}`);
    
    // Wait a bit more to capture all logs
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

testPreportFetch().catch(console.error);

