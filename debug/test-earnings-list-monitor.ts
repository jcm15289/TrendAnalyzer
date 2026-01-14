import { chromium } from 'playwright';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

async function testEarningsListMonitor() {
  console.log('🚀 Starting earnings list monitor test...');
  console.log('📅 Testing with Pacific Time (PT) configuration...');
  
  const browser = await chromium.launch({ 
    headless: false, // Set to false for visual debugging
    slowMo: 500 // Slow down execution for better observation
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Collect all console logs
  const consoleLogs: string[] = [];
  const earningsLogs: string[] = [];
  const dateLogs: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Filter for earnings-related logs
    if (text.includes('📅') || text.includes('earnings') || text.includes('Earnings') || text.includes('CALENDAR') || text.includes('Pacific Time') || text.includes('PT')) {
      earningsLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
    
    // Filter for date-related logs
    if (text.includes('today=') || text.includes('tomorrow=') || text.includes('Today:') || text.includes('Tomorrow:')) {
      dateLogs.push(text);
      console.log(`[DATE] ${text}`);
    }
  });
  
  // Collect errors
  page.on('pageerror', error => {
    console.error('❌ [PAGE ERROR]:', error.message);
    consoleLogs.push(`❌ [PAGE ERROR]: ${error.message}`);
  });

  // Collect network requests
  page.on('request', request => {
    if (request.url().includes('/api/earning-calendar')) {
      console.log(`🌐 [NETWORK] Request: ${request.method()} ${request.url()}`);
      consoleLogs.push(`🌐 [NETWORK] Request: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/api/earning-calendar')) {
      console.log(`🌐 [NETWORK] Response: ${response.status()} ${response.url()}`);
      consoleLogs.push(`🌐 [NETWORK] Response: ${response.status()} ${response.url()}`);
      if (!response.ok()) {
        try {
          const text = await response.text();
          console.error(`🌐 [NETWORK] API Error Body: ${text.substring(0, 500)}`);
          consoleLogs.push(`🌐 [NETWORK] API Error Body: ${text.substring(0, 500)}`);
        } catch (e) {
          console.error(`🌐 [NETWORK] Could not read error body: ${e}`);
          consoleLogs.push(`🌐 [NETWORK] Could not read error body: ${e}`);
        }
      }
    }
  });
  
  try {
    console.log('📍 Navigating to app...');
    await page.goto('http://localhost:3000', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log('✅ App loaded.');

    // Wait for the page to fully load
    await page.waitForTimeout(5000);
    console.log('⏳ Waited 5 seconds for data to load...');

    // Check for "All Stocks" dropdown
    const allStocksButton = page.locator('button:has-text("All Stocks")').first();
    const hasAllStocks = await allStocksButton.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (hasAllStocks) {
      console.log('✅ Found "All Stocks" dropdown.');
      
      // Click to open dropdown
      await allStocksButton.click();
      await page.waitForTimeout(2000);
      console.log('✅ Clicked "All Stocks" dropdown.');
      
      // Check for "Today's Earnings" option
      const todaysEarningsOption = page.locator('text=Today\'s Earnings').first();
      const hasTodaysEarnings = await todaysEarningsOption.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasTodaysEarnings) {
        const optionText = await todaysEarningsOption.textContent();
        console.log(`✅ Found "Today's Earnings" option: "${optionText}"`);
        earningsLogs.push(`✅ Found "Today's Earnings" option: "${optionText}"`);
        
        // Extract count if present
        const countMatch = optionText?.match(/\((\d+)\)/);
        if (countMatch) {
          const count = parseInt(countMatch[1], 10);
          console.log(`📊 Count shown: ${count}`);
          if (count === 0) {
            console.log('❌ PROBLEM: Count is 0!');
            earningsLogs.push('❌ PROBLEM: Count is 0!');
          }
        }
      } else {
        console.log('❌ "Today\'s Earnings" option not found in dropdown!');
        earningsLogs.push('❌ "Today\'s Earnings" option not found in dropdown!');
        
        // List all available options
        const allOptions = await page.locator('[role="option"]').allTextContents();
        console.log('📋 Available options:', allOptions);
        earningsLogs.push(`📋 Available options: ${allOptions.join(', ')}`);
      }
    } else {
      console.log('❌ "All Stocks" dropdown not found!');
      earningsLogs.push('❌ "All Stocks" dropdown not found!');
    }

    // Take a full page screenshot
    const screenshotPath = resolve(__dirname, 'earnings-list-monitor-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved to ${screenshotPath}`);

    // Extract key information from logs
    console.log('\n📊 ============ KEY FINDINGS ============');
    
    // Find PT date logs
    const ptDateLog = dateLogs.find(log => log.includes('Pacific Time') || log.includes('PT'));
    if (ptDateLog) {
      console.log(`📅 PT Date: ${ptDateLog}`);
    }
    
    // Find today/tomorrow dates
    const todayLog = earningsLogs.find(log => log.includes('today='));
    if (todayLog) {
      console.log(`📅 Today: ${todayLog}`);
    }
    
    const tomorrowLog = earningsLogs.find(log => log.includes('tomorrow='));
    if (tomorrowLog) {
      console.log(`📅 Tomorrow: ${tomorrowLog}`);
    }
    
    // Find My Stocks list
    const myStocksLog = earningsLogs.find(log => log.includes('My Stocks'));
    if (myStocksLog) {
      console.log(`📅 My Stocks: ${myStocksLog}`);
    }
    
    // Find list creation result
    const listCreatedLog = earningsLogs.find(log => 
      log.includes("Created Today's Earnings") || 
      log.includes("No earnings data for today") ||
      log.includes("My Stocks list not found")
    );
    if (listCreatedLog) {
      console.log(`📅 List Creation: ${listCreatedLog}`);
    }
    
    // Find earnings data parsing
    const parsingLog = earningsLogs.find(log => log.includes('Final parsed earnings data'));
    if (parsingLog) {
      console.log(`📅 Parsing: ${parsingLog}`);
    }
    
    console.log('============ END KEY FINDINGS ============\n');

    // Wait for manual inspection
    console.log('⏸️  Pausing for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    consoleLogs.push(`❌ Test failed: ${error.message}`);
  } finally {
    await browser.close();
    console.log('✅ Browser closed.');

    // Save all console logs to files
    const logFilePath = resolve(__dirname, 'test-earnings-list-monitor-output.log');
    writeFileSync(logFilePath, consoleLogs.join('\n'));
    console.log(`📋 All console logs saved to ${logFilePath}`);

    const earningsLogFilePath = resolve(__dirname, 'test-earnings-list-monitor-filtered.log');
    writeFileSync(earningsLogFilePath, earningsLogs.join('\n'));
    console.log(`📋 Filtered earnings logs saved to ${earningsLogFilePath}`);
    
    const dateLogFilePath = resolve(__dirname, 'test-earnings-list-monitor-dates.log');
    writeFileSync(dateLogFilePath, dateLogs.join('\n'));
    console.log(`📋 Date logs saved to ${dateLogFilePath}`);
  }
}

testEarningsListMonitor().catch(console.error);

