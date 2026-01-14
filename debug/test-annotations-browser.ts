#!/usr/bin/env tsx

/**
 * Test annotations with browser automation
 * Checks Redis, tests API, and verifies annotations appear on page
 * Usage: tsx debug/test-annotations-browser.ts <keyword>
 */

import { chromium } from 'playwright';

async function testAnnotations(keyword: string) {
  console.log(`\n🧪 Testing annotations for: "${keyword}"\n`);
  
  // Step 1: Check API endpoint
  console.log('📡 Step 1: Checking API endpoint...');
  try {
    const apiUrl = `http://localhost:9002/api/peak-summaries?keywords=${encodeURIComponent(keyword)}`;
    console.log(`Fetching: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    const result = await response.json();
    
    console.log('API Response:', JSON.stringify(result, null, 2));
    
    if (result.success && result.peakSummaries && result.peakSummaries.length > 0) {
      console.log(`✅ Found ${result.peakSummaries.length} peak summaries in Redis`);
      result.peakSummaries.forEach((peak: any, idx: number) => {
        console.log(`  Peak ${idx + 1}: ${peak.date} - ${peak.summary?.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ No peak summaries found in Redis');
      console.log('   This means annotations cannot be displayed.');
      console.log('   Generate an AI analysis first to create peak summaries.');
      return;
    }
  } catch (error) {
    console.error('❌ Error checking API:', error);
    return;
  }
  
  // Step 2: Test with browser
  console.log('\n🌐 Step 2: Testing with browser...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('PeakChart') || text.includes('PeakSummaries') || text.includes('peak')) {
      console.log(`[BROWSER CONSOLE] ${text}`);
    }
  });
  
  // Capture network requests
  const networkRequests: string[] = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('peak-summaries')) {
      networkRequests.push(`REQUEST: ${request.method()} ${url}`);
      console.log(`[NETWORK] ${request.method()} ${url}`);
    }
  });
  
  page.on('response', response => {
    const url = response.url();
    if (url.includes('peak-summaries')) {
      networkRequests.push(`RESPONSE: ${response.status()} ${url}`);
      console.log(`[NETWORK] ${response.status()} ${url}`);
    }
  });
  
  try {
    console.log('Navigating to http://localhost:9002...');
    await page.goto('http://localhost:9002', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Look for keyword
    console.log(`Looking for keyword "${keyword}"...`);
    const keywordLocator = page.locator(`text=${keyword}`).first();
    
    if (await keywordLocator.isVisible({ timeout: 5000 })) {
      console.log(`✅ Found keyword "${keyword}"`);
      
      // Scroll to it
      await keywordLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      
      // Wait for chart to load
      console.log('Waiting for chart to load...');
      await page.waitForTimeout(3000);
      
      // Check for annotations in SVG
      const svg = page.locator('svg').first();
      if (await svg.isVisible()) {
        console.log('✅ SVG chart found');
        
        // Count annotation elements
        const texts = await svg.locator('text').count();
        const rects = await svg.locator('rect').count();
        const groups = await svg.locator('g').count();
        
        console.log(`  Text elements: ${texts}`);
        console.log(`  Rectangles: ${rects}`);
        console.log(`  Groups: ${groups}`);
        
        // Look for peak annotation boxes (they should have specific attributes)
        const annotationRects = await svg.locator('rect[fill="#fef3c7"], rect[fill="#fde68a"], rect[fill="#fbbf24"]').count();
        console.log(`  Yellow annotation boxes: ${annotationRects}`);
        
        if (annotationRects > 0 || texts > 10) {
          console.log('✅ Annotations appear to be present!');
        } else {
          console.log('⚠️  No annotation boxes found');
          console.log('   Checking console logs for clues...');
          
          // Filter relevant console logs
          const peakLogs = consoleLogs.filter(log => 
            log.includes('PeakChart') || 
            log.includes('PeakSummaries') || 
            log.includes('peak') ||
            log.includes('annotation')
          );
          
          if (peakLogs.length > 0) {
            console.log('\nRelevant console logs:');
            peakLogs.forEach(log => console.log(`  ${log}`));
          }
        }
      } else {
        console.log('❌ SVG chart not found');
      }
      
      // Take screenshot
      const screenshotPath = `debug/annotations-test-${keyword}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot saved: ${screenshotPath}`);
      
    } else {
      console.log(`❌ Keyword "${keyword}" not found on page`);
    }
    
    // Keep browser open for inspection
    console.log('\n⏸️  Keeping browser open for 15 seconds for inspection...');
    console.log('   Check the page visually for annotations');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Browser test error:', error);
  } finally {
    await browser.close();
  }
  
  // Summary
  console.log('\n📊 Test Summary:');
  console.log(`  Network requests to peak-summaries API: ${networkRequests.length}`);
  networkRequests.forEach(req => console.log(`    ${req}`));
}

const keyword = process.argv[2];
if (!keyword) {
  console.error('Usage: tsx debug/test-annotations-browser.ts <keyword>');
  process.exit(1);
}

testAnnotations(keyword).catch(console.error);








