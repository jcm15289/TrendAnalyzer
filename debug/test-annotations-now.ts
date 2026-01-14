#!/usr/bin/env tsx

import { chromium } from 'playwright';

async function testAnnotations() {
  console.log('\n🧪 Testing annotations on home page...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture all console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Peak') || text.includes('peak') || text.includes('annotation') || text.includes('Chart')) {
      console.log(`[CONSOLE] ${msg.type()}: ${text}`);
    }
  });
  
  // Capture network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('peak-summaries') || url.includes('explain-trend')) {
      console.log(`[NETWORK REQ] ${request.method()} ${url}`);
    }
  });
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('peak-summaries')) {
      const status = response.status();
      console.log(`[NETWORK RES] ${status} ${url}`);
      if (status === 200) {
        try {
          const data = await response.json();
          console.log(`[NETWORK RES] Data:`, JSON.stringify(data, null, 2));
        } catch (e) {
          // Not JSON
        }
      }
    }
  });
  
  try {
    console.log('📡 Navigating to http://localhost:9002...');
    await page.goto('http://localhost:9002', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('✅ Page loaded');
    
    // Look for any chart SVGs
    const svgCount = await page.locator('svg').count();
    console.log(`📊 Found ${svgCount} SVG elements on page`);
    
    // Check each SVG for annotations
    for (let i = 0; i < Math.min(svgCount, 5); i++) {
      const svg = page.locator('svg').nth(i);
      if (await svg.isVisible()) {
        const texts = await svg.locator('text').count();
        const rects = await svg.locator('rect').count();
        const groups = await svg.locator('g').count();
        
        console.log(`\nSVG ${i + 1}:`);
        console.log(`  Text elements: ${texts}`);
        console.log(`  Rectangles: ${rects}`);
        console.log(`  Groups: ${groups}`);
        
        // Look for annotation boxes (yellow/amber colored)
        const yellowRects = await svg.locator('rect[fill="#fef3c7"], rect[fill="#fde68a"], rect[fill="#fbbf24"], rect[fill*="fef"], rect[fill*="fde"]').count();
        console.log(`  Yellow/amber rectangles (annotations): ${yellowRects}`);
        
        if (yellowRects > 0) {
          console.log(`  ✅ Found ${yellowRects} potential annotation boxes!`);
        }
      }
    }
    
    // Look for "Mamdani" keyword
    console.log('\n🔍 Looking for "Mamdani" keyword...');
    const mamdaniLocator = page.locator('text=Mamdani').first();
    
    if (await mamdaniLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ Found "Mamdani" keyword');
      await mamdaniLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
      
      // Take screenshot of that area
      await mamdaniLocator.screenshot({ path: 'debug/mamdani-area.png' });
      console.log('📸 Screenshot saved: debug/mamdani-area.png');
    } else {
      console.log('⚠️  "Mamdani" keyword not found on page');
    }
    
    // Wait a bit more for any async operations
    console.log('\n⏳ Waiting 5 seconds for async operations...');
    await page.waitForTimeout(5000);
    
    // Final check
    const finalSvgCount = await page.locator('svg').count();
    console.log(`\n📊 Final SVG count: ${finalSvgCount}`);
    
    // Take full page screenshot
    await page.screenshot({ path: 'debug/full-page-test.png', fullPage: true });
    console.log('📸 Full page screenshot saved: debug/full-page-test.png');
    
    console.log('\n⏸️  Keeping browser open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testAnnotations().catch(console.error);








