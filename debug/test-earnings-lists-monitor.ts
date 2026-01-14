import { chromium } from 'playwright';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

async function testEarningsListsMonitor() {
  console.log('🚀 Starting earnings lists monitor test...');
  console.log('📅 Testing with Pacific Time (PT) timezone...');
  
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
  const myStocksLogs: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    
    // Filter for earnings-related logs
    if (text.includes('📅') || text.includes('earnings') || text.includes('Earnings') || text.includes('CALENDAR')) {
      earningsLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
    
    // Filter for date-related logs
    if (text.includes('Pacific Time') || text.includes('PT') || text.includes('today=') || text.includes('tomorrow=') || text.includes('Today:') || text.includes('Tomorrow:')) {
      dateLogs.push(text);
      console.log(`[DATE] ${text}`);
    }
    
    // Filter for My Stocks logs
    if (text.includes('My Stocks') || text.includes('Available stock lists')) {
      myStocksLogs.push(text);
      console.log(`[MY STOCKS] ${text}`);
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
      } else {
        try {
          const json = await response.json();
          console.log(`🌐 [NETWORK] API Success - data keys:`, Object.keys(json));
          if (json.data && json.data.content) {
            const contentLength = typeof json.data.content === 'string' ? json.data.content.length : 'N/A';
            console.log(`🌐 [NETWORK] Content length: ${contentLength}`);
          }
        } catch (e) {
          // Not JSON
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
    await page.waitForTimeout(8000);
    console.log('⏳ Waited 8 seconds for data to load...');

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
      
      // Check for "Tomorrow's Earnings" option
      const tomorrowsEarningsOption = page.locator('text=Tomorrow\'s Earnings').first();
      const hasTomorrowsEarnings = await tomorrowsEarningsOption.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hasTomorrowsEarnings) {
        const optionText = await tomorrowsEarningsOption.textContent();
        console.log(`✅ Found "Tomorrow's Earnings" option: "${optionText}"`);
        earningsLogs.push(`✅ Found "Tomorrow's Earnings" option: "${optionText}"`);
      } else {
        console.log('❌ "Tomorrow\'s Earnings" option not found in dropdown!');
        earningsLogs.push('❌ "Tomorrow\'s Earnings" option not found in dropdown!');
      }
    } else {
      console.log('❌ "All Stocks" dropdown not found!');
      earningsLogs.push('❌ "All Stocks" dropdown not found!');
    }

    // Take a full page screenshot
    const screenshotPath = resolve(__dirname, 'earnings-lists-monitor-screenshot.png');
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
    const todayLog = earningsLogs.find(log => log.includes('today=') || log.includes('Today:'));
    if (todayLog) {
      console.log(`📅 Today: ${todayLog}`);
    }
    
    const tomorrowLog = earningsLogs.find(log => log.includes('tomorrow=') || log.includes('Tomorrow:'));
    if (tomorrowLog) {
      console.log(`📅 Tomorrow: ${tomorrowLog}`);
    }
    
    // Find My Stocks list
    const myStocksFoundLog = myStocksLogs.find(log => log.includes('My Stocks list found'));
    if (myStocksFoundLog) {
      console.log(`📅 My Stocks: ${myStocksFoundLog}`);
    }
    
    // Find available stock lists
    const availableListsLog = myStocksLogs.find(log => log.includes('Available stock lists'));
    if (availableListsLog) {
      console.log(`📅 Available Lists: ${availableListsLog}`);
    }
    
    // Find list creation result
    const listCreatedLog = earningsLogs.find(log => 
      log.includes("Created Today's Earnings") || 
      log.includes("Created Tomorrow's Earnings") ||
      log.includes("No earnings data for today") ||
      log.includes("My Stocks list not found") ||
      log.includes("will not be created")
    );
    if (listCreatedLog) {
      console.log(`📅 List Creation: ${listCreatedLog}`);
    }
    
    // Find earnings data parsing
    const parsingLog = earningsLogs.find(log => log.includes('Final parsed earnings data'));
    if (parsingLog) {
      console.log(`📅 Parsing: ${parsingLog}`);
    }
    
    // Find total lists created
    const totalListsLog = earningsLogs.find(log => log.includes('Total dynamic earnings lists created'));
    if (totalListsLog) {
      console.log(`📅 Total Lists: ${totalListsLog}`);
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
    const logFilePath = resolve(__dirname, 'test-earnings-lists-monitor-output.log');
    writeFileSync(logFilePath, consoleLogs.join('\n'));
    console.log(`📋 All console logs saved to ${logFilePath}`);

    const earningsLogFilePath = resolve(__dirname, 'test-earnings-lists-monitor-filtered.log');
    writeFileSync(earningsLogFilePath, earningsLogs.join('\n'));
    console.log(`📋 Filtered earnings logs saved to ${earningsLogFilePath}`);
    
    const dateLogFilePath = resolve(__dirname, 'test-earnings-lists-monitor-dates.log');
    writeFileSync(dateLogFilePath, dateLogs.join('\n'));
    console.log(`📋 Date logs saved to ${dateLogFilePath}`);
    
    const myStocksLogFilePath = resolve(__dirname, 'test-earnings-lists-monitor-mystocks.log');
    writeFileSync(myStocksLogFilePath, myStocksLogs.join('\n'));
    console.log(`📋 My Stocks logs saved to ${myStocksLogFilePath}`);
  }
}

testEarningsListsMonitor().catch(console.error);

