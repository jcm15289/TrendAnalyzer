import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ 
    headless: true,
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let nniLogs: string[] = [];
  
  // Capture ALL console logs
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('NNI') || 
      text.includes('Nelnet') ||
      text.includes('PSG') ||
      text.includes('psg')
    ) {
      nniLogs.push(text);
      console.log(text);
    }
  });
  
  console.log('🌐 Loading localhost:3000...');
  try {
    await page.goto('http://localhost:3000');
    console.log('⏳ Waiting for calculations...');
    await page.waitForTimeout(45000); // 45 seconds for calculations
    
    console.log('\n📊 ==== NNI SPECIFIC LOGS ====');
    nniLogs.forEach(log => console.log(log));
    
    console.log('\n🔍 Checking PSG column configuration...');
    const psgColumnConfig = await page.evaluate(() => {
      const stored = localStorage.getItem('stockTableColumns');
      if (stored) {
        const columns = JSON.parse(stored);
        const psgCol = columns.find((c: any) => c.id === 'PSG');
        return psgCol;
      }
      return null;
    });
    
    console.log('PSG Column Config:', JSON.stringify(psgColumnConfig, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  await browser.close();
}

main().catch(console.error);

