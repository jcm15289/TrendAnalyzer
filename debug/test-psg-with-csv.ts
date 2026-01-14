import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  // Create a minimal CSV with CVNA and CYBR
  const csvContent = `Company,Symbol,PE,PEG,PS,PM,GM,Growth,LastQG
Carvana,CVNA,88,-0.1,3,3,21,41,14
Cyberark,CYBR,0,4.7,22,-14,76,46,3`;
  
  const csvPath = '/tmp/test-psg.csv';
  fs.writeFileSync(csvPath, csvContent);
  console.log('✅ Created test CSV with CVNA and CYBR');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = await context.newPage();
  
  let psgLogs: string[] = [];
  
  // Monitor console for PSG logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('CVNA') || 
      text.includes('CYBR') ||
      text.includes('PSG')
    ) {
      psgLogs.push(text);
      console.log(`[BROWSER] ${text}`);
    }
  });
  
  console.log('🌐 Loading localhost...');
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  console.log('📤 Uploading CSV...');
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(csvPath);
  
  console.log('⏳ Waiting for calculations (60 seconds)...');
  await page.waitForTimeout(60000);
  
  console.log('\n📊 ==== PSG CALCULATION LOGS ====');
  console.log(`Total PSG-related logs: ${psgLogs.length}`);
  
  // Filter for key logs
  const cvnaLogs = psgLogs.filter(l => l.includes('CVNA'));
  const cybrLogs = psgLogs.filter(l => l.includes('CYBR'));
  
  console.log(`\n=== CVNA Logs (${cvnaLogs.length}) ===`);
  cvnaLogs.forEach(log => console.log(log));
  
  console.log(`\n=== CYBR Logs (${cybrLogs.length}) ===`);
  cybrLogs.forEach(log => console.log(log));
  
  // Take screenshot
  await page.screenshot({ path: 'debug/screenshots/psg-test-results.png', fullPage: true });
  console.log('\n📸 Screenshot saved');
  
  // Check table for PSG values
  console.log('\n🔍 Checking table for PSG values...');
  const tableText = await page.textContent('body');
  console.log('CVNA in table:', tableText?.includes('CVNA') ? 'YES' : 'NO');
  console.log('CYBR in table:', tableText?.includes('CYBR') ? 'YES' : 'NO');
  
  console.log('\n✅ Test complete');
  await page.waitForTimeout(10000); // Keep browser open 10 more seconds
  
  await browser.close();
  fs.unlinkSync(csvPath); // Clean up
}

main().catch(console.error);

