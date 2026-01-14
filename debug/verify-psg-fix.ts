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
  
  let psgLogs: string[] = [];
  
  // Monitor console for PSG-related logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('CVNA') || 
      text.includes('CYBR') ||
      text.includes('Carvana') ||
      text.includes('Cyberark') ||
      text.includes('Starting PSG') ||
      text.includes('PSG calculation') ||
      text.includes('Using Growth Rate for PSG') ||
      text.includes('Final PSG value')
    ) {
      psgLogs.push(text);
      console.log(text);
    }
  });
  
  console.log('🌐 Loading production site (https://stockscan-mymac.vercel.app/)...');
  await page.goto('https://stockscan-mymac.vercel.app/');
  
  console.log('⏳ Waiting for page to load and calculations...');
  await page.waitForTimeout(45000); // 45 seconds
  
  console.log('\n📊 ==== CAPTURED PSG LOGS ====');
  console.log(`Total logs: ${psgLogs.length}`);
  psgLogs.forEach(log => console.log(log));
  
  // Take screenshot
  await page.screenshot({ path: 'debug/screenshots/psg-verification.png', fullPage: true });
  console.log('\n📸 Screenshot saved to debug/screenshots/psg-verification.png');
  
  console.log('\n✅ Test complete. Browser will stay open for 2 minutes for manual inspection.');
  await page.waitForTimeout(120000);
  
  await browser.close();
}

main().catch(console.error);

