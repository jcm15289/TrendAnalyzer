import { BaseMonitor } from './base-monitor';

/**
 * Test script for explain-trend functionality
 * Usage: MONITOR_URL=http://localhost:3000 npx tsx debug/test-explain-trend.ts
 */

async function main() {
  const monitor = new BaseMonitor({
    exitOnError: false,
    clearOnRefresh: false,
    captureNetwork: true,
    captureConsole: true,
    headless: false,
    url: process.env.MONITOR_URL || 'http://localhost:3000',
  });

  try {
    console.log('🎯 Starting explain-trend test...');
    console.log('📊 Monitoring console logs and network activity');
    console.log('💡 Testing the Explain Trend button functionality\n');

    await monitor.launch();
    const page = monitor['page'];
    
    if (!page) {
      throw new Error('Page not initialized');
    }

    // Capture ALL console logs from the page
    page.on('console', (msg) => {
      const text = msg.text();
      // Log all console messages that contain our debug tags or errors
      if (text.includes('[EXPLAIN]') || text.includes('[SANITIZE]') || text.includes('[GEMINI]') || 
          text.includes('Error') || text.includes('Failed') || text.includes('error') || 
          text.includes('Failed to prepare') || text.includes('sanitize')) {
        console.log(`📝 [CONSOLE.${msg.type().toUpperCase()}] ${text}`);
      }
    });

    // Wait for page to load
    console.log('⏳ Waiting for page to load...');
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch {
      console.log('⚠️ Network idle timeout, continuing anyway...');
    }

    // Wait for charts to load
    console.log('⏳ Waiting for charts to load...');
    await page.waitForTimeout(5000);

    // Look for the Explain button - it's either in a dropdown menu or as a standalone button
    console.log('🔍 Looking for Explain button...');
    
    // Scroll to top to ensure buttons are visible
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    
    // First try to find the standalone "Explain" button at the bottom of a card
    let explainButton = page.locator('button:has-text("Explain")').first();
    
    console.log(`🔍 Found ${await explainButton.count()} "Explain" buttons`);
    
    if (await explainButton.count() === 0) {
      // Try finding the three-dot menu button and clicking it to open dropdown
      console.log('🔍 Looking for three-dot menu...');
      const menuButton = page.locator('button[aria-label*="More"], button:has(svg.lucide-more-vertical)').first();
      const menuCount = await menuButton.count();
      console.log(`🔍 Found ${menuCount} menu buttons`);
      
      if (menuCount > 0) {
        console.log('✅ Found menu button, clicking...');
        await menuButton.click();
        await page.waitForTimeout(1000);
        
        // Now look for "Explain Trend" in the dropdown
        explainButton = page.locator('text="Explain Trend", button:has-text("Explain Trend")').first();
        console.log(`🔍 Found ${await explainButton.count()} "Explain Trend" buttons in dropdown`);
      }
    }
    
    if (await explainButton.count() > 0) {
      console.log('✅ Found Explain button, clicking...');
      await explainButton.scrollIntoViewIfNeeded();
      await explainButton.click();
      
      // Wait for the dialog to open
      await page.waitForTimeout(2000);
      
      // Look for "Generate Explanation" button in the dialog
      const generateButton = page.locator('button:has-text("Generate Explanation")');
      if (await generateButton.count() > 0) {
        console.log('✅ Found Generate Explanation button, clicking...');
        
        // Set up network monitoring before clicking
        let apiCallMade = false;
        let apiError = false;
        let apiResponseStatus = 0;
        
        page.on('response', async (response) => {
          if (response.url().includes('/api/explain-trend')) {
            apiCallMade = true;
            apiResponseStatus = response.status();
            console.log(`🌐 [API CALL] explain-trend: ${apiResponseStatus}`);
            
            if (apiResponseStatus >= 400) {
              apiError = true;
              try {
                const errorData = await response.json();
                console.error(`❌ [API ERROR] ${JSON.stringify(errorData)}`);
              } catch {
                const errorText = await response.text();
                console.error(`❌ [API ERROR] ${errorText}`);
              }
            } else {
              try {
                const data = await response.json();
                console.log(`✅ [API SUCCESS] Explanation length: ${data.explanation?.length || 0} chars`);
                if (data.cached) {
                  console.log('📦 [CACHE] Response was served from cache');
                }
              } catch {
                console.log('⚠️ [API] Could not parse response');
              }
            }
          }
        });
        
        await generateButton.click();
        
        // Monitor for API calls and responses
        console.log('⏳ Waiting for explanation to generate (max 30 seconds)...');
        
        // Wait for either success or error
        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(1000);
          
          // Check for errors in UI
          const errorElement = page.locator('text=/Error|Failed/i');
          if (await errorElement.count() > 0) {
            const errorText = await errorElement.textContent();
            console.error(`❌ [UI ERROR] ${errorText}`);
            break;
          }
          
          // Check for explanation text
          const explanationElement = page.locator('text=/AI Analysis|Overview|analysis/i');
          if (await explanationElement.count() > 0) {
            console.log('✅ [UI SUCCESS] Explanation appears to have been generated');
            break;
          }
          
          if (apiCallMade) {
            break;
          }
        }
        
        if (!apiCallMade) {
          console.error('❌ [TIMEOUT] No API call detected within 30 seconds');
        }
      } else {
        console.log('⚠️ Generate Explanation button not found in dialog');
      }
    } else {
      console.log('⚠️ Explain button not found');
      console.log('💡 Please manually click the Explain button to test');
    }

    console.log('\n📊 Test completed. Check console logs above for any errors.');
    console.log('💡 The browser will stay open for manual inspection.');
    console.log('⌨️  Press Ctrl+C to stop monitoring\n');

    // Keep the script running
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error);
    await monitor.close();
    process.exit(1);
  }
}

main();

