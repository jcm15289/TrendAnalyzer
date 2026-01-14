#!/usr/bin/env tsx

import { chromium } from 'playwright';

async function testAnnotationsDisplay() {
  console.log('\n🧪 Testing annotation display on charts...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Peak') || text.includes('peak') || text.includes('annotation') || text.includes('Chart') || text.includes('Summaries')) {
      logs.push(`[${msg.type()}] ${text}`);
      console.log(`[CONSOLE] ${msg.type()}: ${text}`);
    }
  });
  
  // Capture network requests
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('peak-summaries') || url.includes('explain-trend')) {
      const status = response.status();
      console.log(`[NETWORK] ${status} ${url}`);
      if (url.includes('peak-summaries') && status === 200) {
        try {
          const data = await response.json();
          console.log(`[NETWORK] Peak summaries response:`, {
            success: data.success,
            count: data.peakSummaries?.length || 0,
            message: data.message,
          });
        } catch (e) {
          // Not JSON
        }
      }
    }
  });
  
  try {
    console.log('📡 Navigating to http://localhost:9002...');
    await page.goto('http://localhost:9002', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    console.log('✅ Page loaded');
    
    // Wait for charts to load
    console.log('⏳ Waiting for charts to load...');
    await page.waitForTimeout(10000);
    
    // Check for SVG elements
    const svgCount = await page.locator('svg').count();
    console.log(`📊 Found ${svgCount} SVG elements`);
    
    // Check each SVG for annotations (yellow/amber rectangles)
    let totalAnnotations = 0;
    for (let i = 0; i < Math.min(svgCount, 10); i++) {
      const svg = page.locator('svg').nth(i);
      if (await svg.isVisible({ timeout: 2000 }).catch(() => false)) {
        const yellowRects = await svg.locator('rect[fill="#fef3c7"], rect[fill="#fde68a"], rect[fill="#fbbf24"], rect[fill*="fef"], rect[fill*="fde"], rect[fill*="fbb"]').count();
        const texts = await svg.locator('text').count();
        
        if (yellowRects > 0) {
          console.log(`\n✅ SVG ${i + 1}: Found ${yellowRects} annotation boxes`);
          totalAnnotations += yellowRects;
          
          // Get text elements near yellow rects
          const annotationTexts = await svg.locator('text').all();
          for (const text of annotationTexts.slice(0, 5)) {
            const textContent = await text.textContent();
            if (textContent && textContent.length > 10) {
              console.log(`   Text: ${textContent.substring(0, 60)}...`);
            }
          }
        } else {
          console.log(`⚠️  SVG ${i + 1}: No annotation boxes found (${texts} text elements)`);
        }
      }
    }
    
    console.log(`\n📊 Total annotations found: ${totalAnnotations}`);
    
    // Check console logs for peak summary fetching
    console.log('\n📋 Relevant console logs:');
    logs.filter(l => l.includes('PeakSummaries') || l.includes('peak-summaries')).slice(0, 20).forEach(log => {
      console.log(log);
    });
    
    // Take screenshot
    await page.screenshot({ path: 'debug/annotations-test.png', fullPage: true });
    console.log('\n📸 Screenshot saved: debug/annotations-test.png');
    
    console.log('\n⏸️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testAnnotationsDisplay().catch(console.error);








