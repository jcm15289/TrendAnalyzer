import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚦 ====== TRAFFIC ICON TEST START ======');
  
  // Create a minimal CSV with just a few stocks
  const csvContent = `Company,Symbol,PE,PEG,PS,PM,GM,Growth,LastQG
Veeva,VEEV,45,2.1,12,25,70,21,8
Okta,OKTA,88,-0.1,6,3,73,32,14
Salesforce,CRM,30,3.2,5,15,75,18,10`;
  
  const csvPath = '/tmp/test-traffic.csv';
  fs.writeFileSync(csvPath, csvContent);
  console.log('✅ Created test CSV with VEEV, OKTA, CRM');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = await context.newPage();
  page.setDefaultTimeout(60000); // Increase timeout to 60 seconds
  
  let trafficIconLogs: string[] = [];
  let preportLogs: string[] = [];
  
  // Monitor console for traffic icon and preport logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('🚦')) {
      trafficIconLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
    if (text.includes('TRAFFIC ICON CLICKED')) {
      trafficIconLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  console.log('🌐 Loading localhost:3000...');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  console.log('📤 Uploading CSV...');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(csvPath);
  
  console.log('⏳ Waiting for table to render (10 seconds)...');
  await page.waitForTimeout(10000);
  
  // Take screenshot of the table
  await page.screenshot({ path: 'debug/screenshots/traffic-icon-before.png', fullPage: true });
  console.log('📸 Screenshot saved: traffic-icon-before.png');
  
  console.log('\n🔍 Looking for company cells (Veeva, Okta, Salesforce)...');
  
  // Try to find and hover over the first company row to see the traffic icon
  const companyCell = page.locator('text=Veeva').first();
  const isVisible = await companyCell.isVisible();
  console.log(`🔍 Veeva cell visible: ${isVisible}`);
  
  if (isVisible) {
    console.log('🖱️  Hovering over Veeva row...');
    const row = companyCell.locator('xpath=ancestor::tr');
    await row.hover();
    await page.waitForTimeout(1000);
    
    // Take screenshot after hover
    await page.screenshot({ path: 'debug/screenshots/traffic-icon-hover.png', fullPage: true });
    console.log('📸 Screenshot saved: traffic-icon-hover.png');
    
    console.log('🔍 Looking for traffic icon button...');
    // Look for the TrafficCone icon button
    const trafficButton = row.locator('button').filter({ has: page.locator('svg') }).first();
    const buttonVisible = await trafficButton.isVisible();
    console.log(`🔍 Traffic icon button visible: ${buttonVisible}`);
    
    if (buttonVisible) {
      console.log('👆 Clicking traffic icon...');
      await trafficButton.click();
      await page.waitForTimeout(3000); // Wait for dialog to appear
      
      // Take screenshot after click
      await page.screenshot({ path: 'debug/screenshots/traffic-icon-clicked.png', fullPage: true });
      console.log('📸 Screenshot saved: traffic-icon-clicked.png');
    } else {
      console.error('❌ Traffic icon button not visible');
      
      // Debug: Print all buttons in the row
      const allButtons = await row.locator('button').all();
      console.log(`🔍 Found ${allButtons.length} buttons in row`);
      for (let i = 0; i < allButtons.length; i++) {
        const btnText = await allButtons[i].textContent();
        console.log(`  Button ${i}: "${btnText}"`);
      }
    }
  } else {
    console.error('❌ Veeva cell not found');
  }
  
  console.log('\n📊 ==== TRAFFIC ICON LOGS ====');
  console.log(`Total traffic icon logs: ${trafficIconLogs.length}`);
  trafficIconLogs.forEach(log => console.log(log));
  
  console.log('\n✅ Test complete - keeping browser open for 10 seconds for inspection...');
  await page.waitForTimeout(10000);
  
  await browser.close();
  fs.unlinkSync(csvPath); // Clean up
  
  console.log('🚦 ====== TRAFFIC ICON TEST END ======');
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

