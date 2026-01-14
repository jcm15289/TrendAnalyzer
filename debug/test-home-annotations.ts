#!/usr/bin/env tsx

import { chromium } from 'playwright';

async function testHomeAnnotations() {
  console.log('\n🧪 Testing annotations on home page...\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capture console logs
  const peakLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Peak') || text.includes('peak') || text.includes('annotation') || text.includes('Chart') || text.includes('Summaries')) {
      peakLogs.push(`[${msg.type()}] ${text}`);
      console.log(`[CONSOLE] ${msg.type()}: ${text}`);
    }
  });
  
  // Capture network requests
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('peak-summaries')) {
      const status = response.status();
      console.log(`[NETWORK] ${status} ${url}`);
      if (status === 200) {
        try {
          const data = await response.json();
          console.log(`[NETWORK] Peak summaries:`, {
            success: data.success,
            count: data.peakSummaries?.length || 0,
            message: data.message,
          });
          if (data.peakSummaries && data.peakSummaries.length > 0) {
            console.log(`[NETWORK] Annotations:`, data.peakSummaries.map((p: any) => ({ date: p.date, summary: p.summary?.substring(0, 50) })));
          }
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
    
    // Look for "boycotttrump" keyword
    console.log('\n🔍 Looking for "boycotttrump" keyword...');
    const boycotttrumpLocator = page.locator('text=boycotttrump').first();
    
    if (await boycotttrumpLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✅ Found "boycotttrump" keyword');
      await boycotttrumpLocator.scrollIntoViewIfNeeded();
      await page.waitForTimeout(3000);
      
      // Check for annotations in SVG
      const svgs = await page.locator('svg').all();
      console.log(`\n📊 Found ${svgs.length} SVG elements`);
      
      for (let i = 0; i < svgs.length; i++) {
        const svg = svgs[i];
        if (await svg.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Check if this SVG is near the boycotttrump keyword
          const svgBox = await svg.boundingBox();
          const keywordBox = await boycotttrumpLocator.boundingBox();
          
          if (svgBox && keywordBox) {
            const distance = Math.abs(svgBox.y - keywordBox.y);
            if (distance < 500) {
              console.log(`\n📊 SVG ${i + 1} is near boycotttrump (distance: ${distance}px)`);
              
              const yellowRects = await svg.locator('rect[fill="#fef3c7"], rect[fill="#fde68a"], rect[fill="#fbbf24"], rect[fill*="fef"], rect[fill*="fde"], rect[fill*="fbb"]').count();
              const texts = await svg.locator('text').count();
              
              console.log(`  Yellow rectangles (annotations): ${yellowRects}`);
              console.log(`  Text elements: ${texts}`);
              
              if (yellowRects > 0) {
                console.log(`  ✅ Found ${yellowRects} annotation boxes!`);
              } else {
                console.log(`  ⚠️  No annotation boxes found`);
              }
            }
          }
        }
      }
      
      // Take screenshot
      await boycotttrumpLocator.screenshot({ path: 'debug/boycotttrump-area.png' });
      console.log('\n📸 Screenshot saved: debug/boycotttrump-area.png');
    } else {
      console.log('⚠️  "boycotttrump" keyword not found on page');
    }
    
    // Wait for async operations
    console.log('\n⏳ Waiting 5 seconds for async operations...');
    await page.waitForTimeout(5000);
    
    // Check peak summary logs
    console.log('\n📋 Peak summary related logs:');
    peakLogs.filter(l => l.includes('PeakSummaries') || l.includes('peak-summaries')).slice(0, 30).forEach(log => {
      console.log(log);
    });
    
    // Take full page screenshot
    await page.screenshot({ path: 'debug/home-page-test.png', fullPage: true });
    console.log('\n📸 Full page screenshot saved: debug/home-page-test.png');
    
    console.log('\n⏸️  Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testHomeAnnotations().catch(console.error);








