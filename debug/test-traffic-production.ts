import { chromium } from 'playwright';

async function main() {
  console.log('🚦 ====== TESTING TRAFFIC ICON ON PRODUCTION ======');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  
  let trafficLogs: string[] = [];
  
  // Monitor console for traffic icon logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('🚦') || text.includes('TRAFFIC') || text.includes('PREPORT')) {
      trafficLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  console.log('🌐 Loading production site: https://stockscan-mymac.vercel.app/');
  await page.goto('https://stockscan-mymac.vercel.app/');
  
  console.log('⏳ Waiting for page to load (20 seconds)...');
  await page.waitForTimeout(20000);
  
  // Take screenshot
  await page.screenshot({ path: 'debug/screenshots/prod-traffic-loaded.png', fullPage: true });
  console.log('📸 Screenshot: prod-traffic-loaded.png');
  
  console.log('\n🔍 Looking for company cells...');
  
  // Find any company cell (look for common ones)
  const companyCells = await page.locator('td a[href*="finance.yahoo.com"]').all();
  console.log(`🔍 Found ${companyCells.length} company cells with Yahoo Finance links`);
  
  if (companyCells.length > 0) {
    const firstCell = companyCells[0];
    const companyText = await firstCell.textContent();
    console.log(`🔍 First company: "${companyText}"`);
    
    console.log('🖱️  Hovering over first company row...');
    const row = firstCell.locator('xpath=ancestor::tr');
    await row.hover();
    await page.waitForTimeout(2000);
    
    // Take screenshot after hover
    await page.screenshot({ path: 'debug/screenshots/prod-traffic-hover.png', fullPage: true });
    console.log('📸 Screenshot: prod-traffic-hover.png');
    
    console.log('🔍 Looking for traffic icon button...');
    // Look for TrafficCone SVG
    const trafficIcon = row.locator('svg').filter({ hasText: '' }).first();
    const iconVisible = await trafficIcon.isVisible().catch(() => false);
    console.log(`🔍 Traffic icon visible: ${iconVisible}`);
    
    // Try to find button with TrafficCone
    const buttons = await row.locator('button').all();
    console.log(`🔍 Found ${buttons.length} buttons in row`);
    
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const hasTrafficIcon = await btn.locator('svg').count() > 0;
      if (hasTrafficIcon) {
        console.log(`🎯 Button ${i} has SVG icon - clicking it...`);
        await btn.click();
        await page.waitForTimeout(3000);
        
        // Take screenshot after click
        await page.screenshot({ path: 'debug/screenshots/prod-traffic-clicked.png', fullPage: true });
        console.log('📸 Screenshot: prod-traffic-clicked.png');
        break;
      }
    }
  } else {
    console.error('❌ No company cells found');
  }
  
  console.log('\n📊 ==== TRAFFIC LOGS ====');
  console.log(`Total logs: ${trafficLogs.length}`);
  trafficLogs.forEach(log => console.log(log));
  
  console.log('\n⏳ Waiting 15 seconds for any late-arriving logs...');
  await page.waitForTimeout(15000);
  
  console.log('\n📊 ==== FINAL TRAFFIC LOGS (after wait) ====');
  console.log(`Total logs: ${trafficLogs.length}`);
  trafficLogs.forEach(log => console.log(log));
  
  console.log('\n✅ Test complete - keeping browser open for 20 seconds...');
  await page.waitForTimeout(20000);
  
  await browser.close();
  console.log('🚦 ====== TEST END ======');
}

// Set a hard timeout
const timeout = setTimeout(() => {
  console.error('⏰ Test timed out after 90 seconds');
  process.exit(1);
}, 90000);

main()
  .then(() => {
    clearTimeout(timeout);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Test failed:', err);
    clearTimeout(timeout);
    process.exit(1);
  });

