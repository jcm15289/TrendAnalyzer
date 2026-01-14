import { chromium } from 'playwright';

async function testEarningsList() {
  console.log('🚀 Starting earnings list debug test...');
  console.log('📅 Today is November 6, 2025');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Collect all console logs
  const consoleLogs: string[] = [];
  const earningsLogs: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Filter for earnings-related logs
    if (text.includes('📅') || text.includes('earnings') || text.includes('Earnings')) {
      earningsLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Collect errors
  page.on('pageerror', error => {
    console.error('❌ [PAGE ERROR]:', error.message);
  });
  
  try {
    console.log('📍 Navigating to local app...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(5000);
    
    console.log('\n📊 ============ EARNINGS LOGS ============');
    earningsLogs.forEach(log => console.log(log));
    console.log('============ END EARNINGS LOGS ============\n');
    
    // Check what dates are in earningsData
    console.log('🔍 Checking earningsData in browser...');
    const earningsDataInfo = await page.evaluate(() => {
      // Try to find earningsData from the component state
      // This is tricky since it's in React state, but we can check the console logs
      return {
        message: 'Check console logs above for earningsData details'
      };
    });
    
    // Wait a bit more for data to load
    console.log('⏳ Waiting for earnings data to load...');
    await page.waitForTimeout(3000);
    
    // Check console logs again
    console.log('\n📊 ============ UPDATED EARNINGS LOGS ============');
    earningsLogs.forEach(log => console.log(log));
    console.log('============ END UPDATED EARNINGS LOGS ============\n');
    
    // Look for the "Today's Earnings" list in the UI
    console.log('🔍 Looking for "Today\'s Earnings" list...');
    
    // Try to find it in a select dropdown
    const selectElement = page.locator('select').first();
    const hasSelect = await selectElement.count();
    
    if (hasSelect > 0) {
      console.log('📋 Found select dropdown, checking options...');
      const options = await selectElement.locator('option').allTextContents();
      console.log('📋 Available options:', options);
      
      const todayOption = options.findIndex(opt => opt.includes("Today's Earnings"));
      if (todayOption >= 0) {
        console.log(`✅ Found "Today's Earnings" option at index ${todayOption}`);
        const optionText = options[todayOption];
        console.log(`📋 Option text: "${optionText}"`);
        
        // Extract the count if present (e.g., "Today's Earnings (77)")
        const match = optionText.match(/Today's Earnings\s*\((\d+)\)/);
        if (match) {
          const count = parseInt(match[1], 10);
          console.log(`📊 Count shown: ${count}`);
          if (count === 0) {
            console.log('❌ PROBLEM: Count is 0!');
          } else {
            console.log(`✅ Count is ${count} - list should have stocks`);
          }
        }
      } else {
        console.log('❌ "Today\'s Earnings" option not found in dropdown');
      }
    } else {
      console.log('⚠️  No select dropdown found');
    }
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'debug/earnings-list-screenshot.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved to debug/earnings-list-screenshot.png');
    
    // Extract key information from logs
    console.log('\n📊 ============ KEY FINDINGS ============');
    
    // Find today's date from logs
    const todayLog = earningsLogs.find(log => log.includes('today='));
    if (todayLog) {
      console.log(`📅 Today's date from logs: ${todayLog}`);
    }
    
    // Find dates in earningsData
    const datesLog = earningsLogs.find(log => log.includes('Dates found:') || log.includes('All dates in earningsData'));
    if (datesLog) {
      console.log(`📅 Dates in earningsData: ${datesLog}`);
    }
    
    // Find if today's date was found
    const todayFoundLog = earningsLogs.find(log => log.includes('Checking for today') || log.includes('Found') || log.includes('NOT FOUND'));
    if (todayFoundLog) {
      console.log(`📅 Today check result: ${todayFoundLog}`);
    }
    
    // Find list creation result
    const listCreatedLog = earningsLogs.find(log => log.includes("Created Today's Earnings") || log.includes("No earnings data for today"));
    if (listCreatedLog) {
      console.log(`📅 List creation: ${listCreatedLog}`);
    }
    
    console.log('============ END KEY FINDINGS ============\n');
    
    console.log('\n⏸️  Pausing for 30 seconds for manual inspection...');
    console.log('💡 Check the browser console for detailed logs');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    console.log('✅ Test complete');
  }
}

testEarningsList().catch(console.error);

