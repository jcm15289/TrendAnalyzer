import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ 
    headless: true,
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let targetLogs: string[] = [];
  
  // Capture ALL console logs for CYBR and CVNA
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('CYBR') || 
      text.includes('Cyberark') ||
      text.includes('CVNA') ||
      text.includes('Carvana') ||
      (text.includes('PSG') && (text.includes('CYBR') || text.includes('CVNA')))
    ) {
      targetLogs.push(text);
      console.log(text);
    }
  });
  
  console.log('🌐 Loading localhost:3000...');
  try {
    await page.goto('http://localhost:3000');
    console.log('⏳ Waiting for calculations (60 seconds)...');
    await page.waitForTimeout(60000);
    
    console.log('\n📊 ==== CYBR & CVNA SPECIFIC LOGS ====');
    targetLogs.forEach(log => console.log(log));
    
    console.log('\n🔍 Total relevant logs captured:', targetLogs.length);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  await browser.close();
}

main().catch(console.error);

