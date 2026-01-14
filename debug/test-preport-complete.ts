import { BaseMonitor } from './base-monitor';

async function testPreportComplete() {
  console.log('🔍 ====== COMPREHENSIVE PREPORT TEST ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000); // Wait for page to fully load
    
    console.log('✅ Page loaded, waiting for table...');
    await page.waitForTimeout(5000);
    
    // Set up network request listener BEFORE clicking
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
        console.log(`🌐 API CALL: ${url} - Status: ${status}`);
        if (body) {
          const bodyStr = JSON.stringify(body);
          console.log(`🌐 API RESPONSE: ${bodyStr.substring(0, 500)}`);
          if (body.availableKeys) {
            console.log(`🌐 Available keys count: ${body.availableKeys.length}`);
            console.log(`🌐 First 10 keys:`, body.availableKeys.slice(0, 10));
          }
          if (body.matchingKeys) {
            console.log(`🌐 Matching keys:`, body.matchingKeys);
          }
        }
      }
    });
    
    // Find and click OGI traffic icon
    console.log('🔍 Looking for OGI (Organigram) traffic icon...');
    
    // Find the OGI row using Playwright
    const ogiRow = await page.locator('tbody tr').filter({ hasText: /OGI|Organigram/i }).first();
    const rowCount = await page.locator('tbody tr').count();
    console.log(`🔍 Found ${rowCount} rows in table`);
    
    if (await ogiRow.count() > 0) {
      console.log('✅ Found OGI row');
      
      // Get company name and symbol from the row
      const companyName = await ogiRow.locator('td').nth(0).textContent() || 'Organigram';
      const symbol = await ogiRow.locator('td').nth(1).textContent() || 'OGI';
      console.log(`🔍 Company: "${companyName}", Symbol: "${symbol}"`);
      
      // Force button to be visible by removing opacity class
      await ogiRow.evaluate((row) => {
        const buttons = row.querySelectorAll('button');
        buttons.forEach(btn => {
          (btn as HTMLElement).style.opacity = '1';
          (btn as HTMLElement).style.visibility = 'visible';
        });
      });
      
      // Hover over the row to make the button visible
      await ogiRow.hover();
      await page.waitForTimeout(1000);
      
      // Find and click the button in the last cell
      const lastCell = ogiRow.locator('td').last();
      const button = lastCell.locator('button').first();
      
      const buttonCount = await lastCell.locator('button').count();
      console.log(`🔍 Found ${buttonCount} buttons in last cell`);
      
      if (buttonCount > 0) {
        // Check if button is visible
        const isVisible = await button.isVisible();
        console.log(`🔍 Button visible: ${isVisible}`);
        
        // Force click even if not visible
        console.log('🔍 Clicking traffic icon button...');
        await button.click({ force: true });
        console.log('✅ Button clicked');
      } else {
        console.log('⚠️ No button found in last cell');
        // Debug: check what's in the last cell
        const lastCellText = await lastCell.textContent();
        console.log(`🔍 Last cell content: "${lastCellText}"`);
      }
    } else {
      console.log('⚠️ OGI row not found');
    }
    
    // Wait for API calls and dialog
    console.log('⏳ Waiting for API calls and dialog (15 seconds)...');
    await page.waitForTimeout(15000);
    
    // Print all API calls captured
    console.log(`\n📊 API Calls Summary: ${apiCalls.length} calls made`);
    apiCalls.forEach((call, idx) => {
      console.log(`  ${idx + 1}. ${call.url}`);
      console.log(`     Status: ${call.status}`);
      if (call.body) {
        console.log(`     Success: ${call.body.success}`);
        if (call.body.availableKeys) {
          console.log(`     Available keys: ${call.body.availableKeys.length}`);
        }
        if (call.body.matchingKeys) {
          console.log(`     Matching keys: ${call.body.matchingKeys.length}`);
        }
      }
    });
    
    // Check if dialog appeared
    const dialogInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const dialogText = dialog.textContent || '';
        const hasError = dialogText.includes('Report Not Found') || dialogText.includes('Error');
        const hasContent = dialog.querySelector('iframe') || dialog.querySelector('[class*="html"]') || dialog.innerHTML.includes('<!DOCTYPE');
        return { visible: true, hasError, hasContent, text: dialogText.substring(0, 300) };
      }
      return { visible: false, hasError: false, hasContent: false, text: '' };
    });
    
    console.log(`\n🔍 Dialog info:`, dialogInfo);
    
    console.log('✅ Test completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await monitor.close();
  }
}

testPreportComplete().catch(console.error);

