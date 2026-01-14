import { chromium } from 'playwright';

async function testEarningCalendar() {
  console.log('🚀 Starting earning calendar debug test...');
  
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
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Print calendar-related logs immediately
    if (text.includes('📅') || text.includes('CALENDAR')) {
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  // Collect errors
  page.on('pageerror', error => {
    console.error('❌ [PAGE ERROR]:', error.message);
  });
  
  try {
    console.log('📍 Navigating to app...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(3000);
    
    console.log('🔍 Looking for "Today\'s Earnings" button...');
    
    // Wait for the lists to be created
    await page.waitForTimeout(2000);
    
    // Try to find and click the Today's Earnings list selector
    // It should be in a <select> dropdown element
    const selectElement = page.locator('select').first();
    const hasSelect = await selectElement.count();
    
    if (hasSelect > 0) {
      console.log('📋 Found select dropdown, looking for options...');
      const options = await selectElement.locator('option').allTextContents();
      console.log('📋 Options:', options);
      
      // Try to select Today's Earnings
      const todayOption = options.findIndex(opt => opt.includes("Today's Earnings"));
      if (todayOption >= 0) {
        console.log('✅ Found "Today\'s Earnings" option at index', todayOption, ', selecting...');
        await selectElement.selectOption({ index: todayOption });
        await page.waitForTimeout(3000);
        
        // Now click the button that opens the dialog (might be labeled "View" or similar)
        const viewButton = page.locator('button:has-text("View")').first();
        const hasViewButton = await viewButton.isVisible({ timeout: 2000 }).catch(() => false);
        if (hasViewButton) {
          console.log('✅ Found "View" button, clicking...');
          await viewButton.click();
          await page.waitForTimeout(2000);
        } else {
          // Try clicking any button near the select
          console.log('🔍 No "View" button, looking for dialog trigger...');
          const dialogTrigger = page.locator('[role="combobox"]').first();
          if (await dialogTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('✅ Found combobox, clicking...');
            await dialogTrigger.click();
            await page.waitForTimeout(2000);
          }
        }
      } else {
        console.log('⚠️  "Today\'s Earnings" option not found in dropdown');
      }
    } else {
      console.log('⚠️  No select dropdown found. Looking for direct button...');
      const todaysEarningsButton = page.locator('text=Today\'s Earnings').first();
      const isVisible = await todaysEarningsButton.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (isVisible) {
        console.log('✅ Found "Today\'s Earnings" button, clicking...');
        await todaysEarningsButton.click();
        await page.waitForTimeout(2000);
      } else {
        console.log('⚠️  "Today\'s Earnings" button not found anywhere');
        const allButtons = await page.locator('button').allTextContents();
        console.log('📋 Available buttons:', allButtons.filter(t => t.trim()));
      }
    }
    
    console.log('\n📊 ============ CALENDAR LOGS ============');
    const calendarLogs = consoleLogs.filter(log => 
      log.includes('📅') || log.includes('CALENDAR') || log.includes('parsed')
    );
    
    if (calendarLogs.length === 0) {
      console.log('⚠️  No calendar logs found. All console logs:');
      consoleLogs.slice(-20).forEach(log => console.log('  ', log));
    } else {
      calendarLogs.forEach(log => console.log(log));
    }
    
    console.log('============ END CALENDAR LOGS ============\n');
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'debug/earning-calendar-screenshot.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved to debug/earning-calendar-screenshot.png');
    
    // Check what's actually rendered
    console.log('\n🔍 Checking rendered content...');
    const dialogContent = await page.locator('[role="dialog"]').textContent().catch(() => null);
    if (dialogContent) {
      console.log('📋 Dialog content (first 500 chars):', dialogContent.substring(0, 500));
    } else {
      console.log('⚠️  No dialog found');
    }
    
    // Check if "No Data Loaded" is present
    const noDataText = await page.locator('text=No Data Loaded').isVisible().catch(() => false);
    console.log('📊 "No Data Loaded" visible:', noDataText);
    
    // Check for actual earnings data
    const hasEarningsData = await page.locator('div').filter({ hasText: /\d{4}-\d{2}-\d{2}/ }).count();
    console.log('📊 Elements with date pattern found:', hasEarningsData);
    
    console.log('\n⏸️  Pausing for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
    console.log('✅ Test complete');
  }
}

testEarningCalendar().catch(console.error);

