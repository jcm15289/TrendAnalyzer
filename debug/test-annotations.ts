#!/usr/bin/env tsx

/**
 * Test if annotations appear on the home page for a keyword
 * Usage: tsx debug/test-annotations.ts <keyword>
 */

import { chromium } from 'playwright';

async function testAnnotations(keyword: string) {
  console.log(`\n🧪 Testing annotations for: "${keyword}"\n`);
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to localhost
    console.log('Navigating to http://localhost:9002...');
    await page.goto('http://localhost:9002', { waitUntil: 'networkidle' });
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Check if keyword is visible on the page
    console.log(`Looking for keyword "${keyword}" on the page...`);
    const keywordElement = await page.locator(`text=${keyword}`).first();
    
    if (await keywordElement.isVisible()) {
      console.log(`✅ Found keyword "${keyword}" on the page`);
      
      // Scroll to the element
      await keywordElement.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      
      // Look for SVG annotations (peak annotation boxes)
      const annotations = await page.locator('svg >> g >> text').count();
      console.log(`Found ${annotations} text elements in SVG`);
      
      // Look for peak annotation boxes (rectangles with specific classes or attributes)
      const rects = await page.locator('svg >> rect').count();
      console.log(`Found ${rects} rectangles in SVG`);
      
      // Check console logs for peak-related messages
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('PeakChart') || text.includes('PeakSummaries') || text.includes('peak')) {
          console.log(`[CONSOLE] ${text}`);
        }
      });
      
      // Wait a bit more for annotations to load
      await page.waitForTimeout(3000);
      
      // Take a screenshot
      await page.screenshot({ path: `debug/annotations-test-${keyword}.png`, fullPage: true });
      console.log(`📸 Screenshot saved to debug/annotations-test-${keyword}.png`);
      
      // Check again after waiting
      const annotationsAfter = await page.locator('svg >> g >> text').count();
      const rectsAfter = await page.locator('svg >> rect').count();
      console.log(`After waiting: ${annotationsAfter} text elements, ${rectsAfter} rectangles`);
      
    } else {
      console.log(`❌ Keyword "${keyword}" not found on the page`);
    }
    
    // Keep browser open for inspection
    console.log('\n⏸️  Keeping browser open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

const keyword = process.argv[2];
if (!keyword) {
  console.error('Usage: tsx debug/test-annotations.ts <keyword>');
  process.exit(1);
}

testAnnotations(keyword).catch(console.error);








