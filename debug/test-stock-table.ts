import { BaseMonitor } from './base-monitor';

/**
 * Test script for the stock table page
 * This demonstrates how to create a custom debugging script for a specific feature
 * 
 * Usage: npm run dev (in one terminal)
 *        npm run monitor (or npx tsx debug/test-stock-table.ts in another terminal in editor area)
 * 
 * Tell Cursor Composer:
 * "Run test-stock-table.ts and fix any console errors you find"
 */

async function testStockTable() {
  const monitor = new BaseMonitor({
    exitOnError: false,  // Set to true for automated fix loops
    clearOnRefresh: true,
    captureNetwork: true,
    captureConsole: true,
    headless: false,
  });

  try {
    console.log('🎯 Testing Stock Table Page...\n');

    const page = await monitor.launch();

    // Navigate to the main page
    console.log('📍 Step 1: Loading home page...');
    await monitor.navigateTo('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n📍 Step 2: Looking for stock table...');
    
    // Try to find the stock table
    const stockTableExists = await page.locator('table').count() > 0;
    if (stockTableExists) {
      console.log('✅ Stock table found on page');
      
      // Count rows
      const rowCount = await page.locator('tbody tr').count();
      console.log(`📊 Found ${rowCount} stock rows`);
    } else {
      console.log('⚠️  No table found - page might need interaction to load data');
    }

    // Check for any visible error messages
    const errorMessages = await page.locator('[role="alert"], .error, .alert-error').count();
    if (errorMessages > 0) {
      console.log(`⚠️  Found ${errorMessages} error message(s) on page`);
    }

    // Take a screenshot
    await monitor.screenshot('debug/screenshots/stock-table.png');

    console.log('\n✅ Test completed!');
    console.log('📝 Review the console logs above');
    console.log('📸 Screenshot saved to debug/screenshots/stock-table.png');
    console.log('\n💡 Browser will stay open - close it when done or press Ctrl+C');

    // Keep the browser open for manual inspection
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Test failed:', error);
    await monitor.close();
    process.exit(1);
  }
}

testStockTable();

