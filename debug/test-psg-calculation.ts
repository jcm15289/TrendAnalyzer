import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = await context.newPage();
  
  // Monitor console logs with focus on PSG
  page.on('console', (msg) => {
    const text = msg.text();
    
    // Filter for PSG-related logs and calculation logs
    if (
      text.includes('PSG') || 
      text.includes('psg') ||
      text.includes('NNI') ||
      text.includes('Nelnet') ||
      text.includes('Using CSV data for') ||
      text.includes('PSG value for') ||
      text.includes('Formatting PSG')
    ) {
      console.log(`📝 ${text}`);
    }
  });
  
  console.log('🌐 Navigating to production site...');
  await page.goto('https://stockscan-mymac.vercel.app/');
  
  console.log('⏳ Waiting for page to load...');
  await page.waitForLoadState('networkidle', { timeout: 60000 });
  
  console.log('⏳ Waiting 30 seconds for calculations to process...');
  await page.waitForTimeout(30000);
  
  console.log('📊 Checking PSG values in the table...');
  
  // Take a screenshot
  await page.screenshot({ path: 'debug/screenshots/psg-test.png', fullPage: true });
  console.log('📸 Screenshot saved to debug/screenshots/psg-test.png');
  
  console.log('✅ Test complete. Press Ctrl+C to exit or browser will stay open for inspection.');
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(300000); // 5 minutes
  
  await browser.close();
}

main().catch(console.error);

