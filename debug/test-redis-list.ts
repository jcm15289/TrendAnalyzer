import { BaseMonitor } from './base-monitor';

async function testRedisList() {
  console.log('🔍 ====== TESTING REDIS LIST FOLDERS ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    
    console.log('✅ Page loaded');
    
    // Set up network listener for API calls
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('redis-list-folders')) {
        const status = response.status();
        console.log(`🌐 API CALL: ${url} - Status: ${status}`);
        
        try {
          const body = await response.json();
          console.log(`🌐 API RESPONSE:`, JSON.stringify(body).substring(0, 500));
          if (body.success && body.data) {
            const folders = Object.keys(body.data);
            console.log(`🌐 Found ${folders.length} folders:`, folders);
          }
        } catch (e) {
          const text = await response.text();
          console.log(`🌐 API RESPONSE (not JSON):`, text.substring(0, 200));
        }
      }
    });
    
    // Find and click the "List Redis DB" button
    console.log('🔍 Looking for "List Redis DB" button...');
    
    const button = await page.locator('button').filter({ hasText: /List Redis DB/i });
    const buttonCount = await button.count();
    console.log(`🔍 Found ${buttonCount} button(s) with "List Redis DB" text`);
    
    if (buttonCount > 0) {
      console.log('🔍 Clicking button...');
      await button.first().click();
      console.log('✅ Button clicked');
      
      // Wait for API call and dialog
      await page.waitForTimeout(5000);
      
      // Check if dialog appeared
      const dialogVisible = await page.evaluate(() => {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        return dialogs.length > 0;
      });
      
      console.log(`🔍 Dialog visible: ${dialogVisible}`);
    } else {
      console.log('⚠️ Button not found');
    }
    
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

testRedisList().catch(console.error);





