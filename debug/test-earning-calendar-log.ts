import { BaseMonitor } from './base-monitor';

async function testEarningCalendarLog() {
  console.log('📅 ====== TESTING EARNING CALENDAR FETCH LOG ======\n');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  let page: any;
  
  try {
    page = await monitor.launch();
    console.log('✅ Browser launched\n');
    
    // Navigate to the app
    const url = 'https://stockscan-mymac-5fackm8su-julio-casals-projects.vercel.app';
    console.log(`🌐 Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    console.log('✅ Page loaded\n');
    
    // Wait a bit for the app to initialize
    await page.waitForTimeout(3000);
    
    // Test 1: Check if Redis keys endpoint works
    console.log('📋 TEST 1: Checking Redis keys...');
    const keysResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/debug-earning-calendar-keys');
        const data = await response.json();
        return { success: true, data };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Keys response:', JSON.stringify(keysResponse, null, 2));
    
    if (keysResponse.success && keysResponse.data.keys) {
      console.log('\n📊 Available Redis keys:');
      keysResponse.data.keys.forEach((keyInfo: any) => {
        console.log(`  - ${keyInfo.key} (${keyInfo.size} bytes)`);
      });
    }
    
    // Test 2: Try fetching the log with the API directly
    console.log('\n📋 TEST 2: Fetching log via redis-get-file API...');
    const apiResponse = await page.evaluate(async () => {
      try {
        const url = '/api/redis-get-file?folder=earning-calendar&file=Calendar MarketWatch fetch Log';
        console.log('Fetching from URL:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        return { 
          success: response.ok, 
          status: response.status,
          data,
          url 
        };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message 
        };
      }
    });
    
    console.log('API response:', JSON.stringify(apiResponse, null, 2));
    
    // Test 3: Check console logs from the page
    console.log('\n📋 TEST 3: Checking browser console logs...');
    page.on('console', (msg: any) => {
      const text = msg.text();
      if (text.includes('🚦') || text.includes('📅') || text.includes('earning-calendar')) {
        console.log('  Browser console:', text);
      }
    });
    
    // Test 4: Try to click the fetch log button if it exists
    console.log('\n📋 TEST 4: Looking for fetch log button in UI...');
    
    // First, open the Redis DB section
    const hasRedisSection = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const redisLink = links.find(link => link.textContent?.includes('Redis DB'));
      if (redisLink) {
        redisLink.click();
        return true;
      }
      return false;
    });
    
    if (hasRedisSection) {
      console.log('✅ Found and clicked Redis DB link');
      await page.waitForTimeout(2000);
      
      // Take a screenshot
      await page.screenshot({ 
        path: 'debug/screenshots/redis-db-page.png',
        fullPage: true 
      });
      console.log('📸 Screenshot saved to debug/screenshots/redis-db-page.png');
    } else {
      console.log('⚠️ Could not find Redis DB link');
    }
    
    // Test 5: Direct Redis connection test
    console.log('\n📋 TEST 5: Testing direct Redis connection...');
    const redisTest = await page.evaluate(async () => {
      try {
        // Try with encoded URL
        const encodedFile = encodeURIComponent('Calendar MarketWatch fetch Log');
        const url1 = `/api/redis-get-file?folder=earning-calendar&file=${encodedFile}`;
        
        const response1 = await fetch(url1);
        const data1 = await response1.json();
        
        return {
          test: 'with_encoding',
          url: url1,
          status: response1.status,
          success: response1.ok,
          data: data1,
          hasContent: !!data1.content,
          contentLength: data1.content ? data1.content.length : 0
        };
      } catch (error: any) {
        return {
          test: 'with_encoding',
          error: error.message
        };
      }
    });
    
    console.log('Direct Redis test:', JSON.stringify(redisTest, null, 2));
    
    if (redisTest.hasContent) {
      console.log('\n✅ SUCCESS! Content retrieved. First 200 chars:');
      console.log(redisTest.data.content.substring(0, 200) + '...');
    } else {
      console.log('\n❌ FAILED! No content retrieved');
      console.log('Error details:', redisTest.data);
    }
    
    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    if (monitor) {
      await monitor.close();
    }
  }
}

testEarningCalendarLog().catch(console.error);

