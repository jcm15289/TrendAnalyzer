import { BaseMonitor } from './base-monitor';

async function testEarningsCalendar() {
  console.log('📅 ====== TESTING EARNINGS CALENDAR ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for page to fully load...');
    await page.waitForTimeout(5000);
    
    console.log('📅 Checking console logs for earnings calendar parsing...');
    await page.waitForTimeout(10000);
    
    console.log('\n✅ Test completed. Check console logs above for parsing results.');
    console.log('⏳ Keeping browser open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await monitor.close();
  }
}

testEarningsCalendar().catch(console.error);









