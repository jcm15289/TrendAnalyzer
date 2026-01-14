import { BaseMonitor } from './base-monitor';

/**
 * Test script for peak summaries functionality
 * Usage: MONITOR_URL=http://localhost:3000 npx tsx debug/test-peak-summaries.ts
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
    console.log('🎯 Starting peak summaries test...');
    console.log('📊 Testing peak summaries generation, storage, and display\n');

    await monitor.launch();
    const page = monitor['page'];
    
    if (!page) {
      throw new Error('Page not initialized');
    }

    // Capture console logs
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[PEAK]') || text.includes('[GEMINI]') || text.includes('peak') || 
          text.includes('PeakSummaries') || text.includes('CACHE-KEY') ||
          text.includes('explain-trend') || text.includes('peak-summaries')) {
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

    await page.waitForTimeout(5000);

    // Find and click Explain button
    console.log('🔍 Looking for Explain button...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    
    let explainButton = page.locator('button:has-text("Explain")').first();
    
    if (await explainButton.count() === 0) {
      const menuButton = page.locator('button[aria-label*="More"], button:has(svg.lucide-more-vertical)').first();
      if (await menuButton.count() > 0) {
        await menuButton.click();
        await page.waitForTimeout(1000);
        explainButton = page.locator('text="Explain Trend", button:has-text("Explain Trend")').first();
      }
    }
    
    if (await explainButton.count() > 0) {
      console.log('✅ Found Explain button, clicking...');
      await explainButton.scrollIntoViewIfNeeded();
      await explainButton.click();
      await page.waitForTimeout(2000);
      
      // Click Generate Explanation
      const generateButton = page.locator('button:has-text("Generate Explanation")');
      if (await generateButton.count() > 0) {
        console.log('✅ Found Generate Explanation button, clicking...');
        
        // Monitor API calls
        let explainApiCalled = false;
        let peakSummariesApiCalled = false;
        let explainResponse: any = null;
        let peakSummariesResponse: any = null;
        
        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('/api/explain-trend')) {
            explainApiCalled = true;
            console.log(`🌐 [API] explain-trend: ${response.status()}`);
            if (response.status() === 200) {
              try {
                explainResponse = await response.json();
                console.log(`✅ [API] explain-trend response:`, {
                  success: explainResponse.success,
                  hasExplanation: !!explainResponse.explanation,
                  peakSummariesCount: explainResponse.peakSummaries?.length || 0,
                  cached: explainResponse.cached,
                });
              } catch (e) {
                console.error('❌ [API] Failed to parse explain-trend response');
              }
            }
          }
          if (url.includes('/api/peak-summaries')) {
            peakSummariesApiCalled = true;
            console.log(`🌐 [API] peak-summaries: ${response.status()}`);
            if (response.status() === 200) {
              try {
                peakSummariesResponse = await response.json();
                console.log(`✅ [API] peak-summaries response:`, {
                  success: peakSummariesResponse.success,
                  peakCount: peakSummariesResponse.peakSummaries?.length || 0,
                });
              } catch (e) {
                console.error('❌ [API] Failed to parse peak-summaries response');
              }
            }
          }
        });
        
        await generateButton.click();
        
        // Wait for explanation to generate
        console.log('⏳ Waiting for explanation (max 60 seconds)...');
        for (let i = 0; i < 60; i++) {
          await page.waitForTimeout(1000);
          
          // Check for peak summaries in dialog
          const peakSection = page.locator('text=/Peak Event Summaries/i');
          if (await peakSection.count() > 0) {
            console.log('✅ Found Peak Event Summaries section in dialog!');
            const peakItems = await page.locator('[class*="bg-white rounded border"]').count();
            console.log(`📊 Found ${peakItems} peak summary items`);
            break;
          }
          
          // Check for error
          const errorElement = page.locator('text=/Error|Failed/i').first();
          if (await errorElement.count() > 0) {
            const errorText = await errorElement.textContent();
            console.error(`❌ [UI ERROR] ${errorText}`);
            break;
          }
          
          if (explainApiCalled && i > 10) {
            break;
          }
        }
        
        // Check chart for peak labels
        console.log('\n🔍 Checking chart for peak labels...');
        await page.waitForTimeout(2000);
        const chart = page.locator('svg.recharts-surface');
        if (await chart.count() > 0) {
          console.log('✅ Chart found');
          // Check for ReferenceLine elements (peak markers)
          const peakLines = await page.locator('line[stroke="#FF6B6B"]').count();
          console.log(`📊 Found ${peakLines} peak reference lines on chart`);
        }
        
        console.log('\n📊 Test Summary:');
        console.log(`- Explain API called: ${explainApiCalled ? '✅' : '❌'}`);
        console.log(`- Peak Summaries API called: ${peakSummariesApiCalled ? '✅' : '❌'}`);
        if (explainResponse) {
          console.log(`- Explanation generated: ${explainResponse.success ? '✅' : '❌'}`);
          console.log(`- Peak summaries in response: ${explainResponse.peakSummaries?.length || 0}`);
        }
        if (peakSummariesResponse) {
          console.log(`- Peak summaries from API: ${peakSummariesResponse.peakSummaries?.length || 0}`);
        }
      } else {
        console.log('⚠️ Generate Explanation button not found');
      }
    } else {
      console.log('⚠️ Explain button not found');
    }

    console.log('\n📊 Test completed. Check console logs above for details.');
    console.log('💡 The browser will stay open for manual inspection.');
    console.log('⌨️  Press Ctrl+C to stop monitoring\n');

    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Error:', error);
    await monitor.close();
    process.exit(1);
  }
}

main();
