import { BaseMonitor } from './base-monitor';

async function testPreportDirect() {
  console.log('🔍 ====== DIRECT PREPORT TEST ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);
    
    console.log('✅ Page loaded');
    
    // Set up network request listener BEFORE calling function
    const apiCalls: any[] = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('redis-get-file')) {
        const status = response.status();
        let body = null;
        try {
          body = await response.json();
        } catch (e) {
          // Not JSON
        }
        apiCalls.push({ url, status, body });
        console.log(`🌐 API CALL: ${url}`);
        console.log(`🌐 Status: ${status}`);
        if (body) {
          console.log(`🌐 Success: ${body.success}`);
          if (body.availableKeys) {
            console.log(`🌐 Available keys: ${body.availableKeys.length}`);
            console.log(`🌐 First 10 keys:`, body.availableKeys.slice(0, 10));
          }
          if (body.matchingKeys) {
            console.log(`🌐 Matching keys:`, body.matchingKeys);
          }
          if (body.error) {
            console.log(`🌐 Error: ${body.error}`);
          }
        }
      }
    });
    
    // Directly call handleViewPreport via window object or expose it
    console.log('🔍 Calling handleViewPreport directly for OGI...');
    
    await page.evaluate(() => {
      // Try to find the function in the React component
      // Since we can't access it directly, let's trigger the click event manually
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const text = row.textContent || '';
        if (text.includes('Organigram') || text.includes('OGI')) {
          const buttons = row.querySelectorAll('button');
          console.log(`Found ${buttons.length} buttons in OGI row`);
          if (buttons.length > 0) {
            const lastButton = buttons[buttons.length - 1];
            // Make button visible
            (lastButton as HTMLElement).style.opacity = '1';
            (lastButton as HTMLElement).style.visibility = 'visible';
            console.log('Clicking button...');
            (lastButton as HTMLElement).click();
            return true;
          }
        }
      }
      return false;
    });
    
    console.log('⏳ Waiting for API calls...');
    await page.waitForTimeout(15000);
    
    console.log(`\n📊 API Calls Summary: ${apiCalls.length} calls made`);
    apiCalls.forEach((call, idx) => {
      console.log(`  ${idx + 1}. ${call.url} - Status: ${call.status}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

testPreportDirect().catch(console.error);





