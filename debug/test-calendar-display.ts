import { BaseMonitor } from './base-monitor';

async function testCalendarDisplay() {
  console.log('📅 ====== TESTING CALENDAR DISPLAY ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(5000);
    
    // Click the earnings calendar button
    console.log('📅 Looking for earnings calendar button...');
    await page.waitForSelector('button[aria-label="Earnings Calendar"]', { timeout: 10000 });
    await page.click('button[aria-label="Earnings Calendar"]');
    
    console.log('⏳ Waiting for calendar dialog to open...');
    await page.waitForTimeout(3000);
    
    // Check if calendar content is visible
    console.log('📅 Checking calendar content...');
    const calendarContent = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { found: false, reason: 'No dialog found' };
      
      const title = dialog.querySelector('h2')?.textContent;
      const hasContent = dialog.textContent?.includes('Monday') || dialog.textContent?.includes('2025');
      const itemCount = dialog.querySelectorAll('li').length;
      const dateCount = dialog.querySelectorAll('h4').length;
      
      return {
        found: true,
        title,
        hasContent,
        itemCount,
        dateCount,
        textPreview: dialog.textContent?.substring(0, 500)
      };
    });
    
    console.log('📅 Calendar content check:', JSON.stringify(calendarContent, null, 2));
    
    console.log('\n⏳ Keeping browser open for 20 seconds for inspection...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await monitor.close();
  }
}

testCalendarDisplay().catch(console.error);







