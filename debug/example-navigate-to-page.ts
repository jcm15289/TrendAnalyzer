import { BaseMonitor } from './base-monitor';

/**
 * Example script showing how to create a custom navigation test
 * that exits on error for automated debugging
 * 
 * Usage: npx tsx debug/example-navigate-to-page.ts
 */

async function main() {
  const monitor = new BaseMonitor({
    exitOnError: true,  // Exit when console errors are detected
    clearOnRefresh: true,
    captureNetwork: true,
    captureConsole: true,
    headless: false,
  });

  try {
    console.log('🎯 Starting automated navigation test...');
    console.log('⚠️  ExitOnError is enabled - script will exit on console errors\n');

    const page = await monitor.launch();

    // Navigate to your app
    await monitor.navigateTo('http://localhost:3000');
    
    // Wait for the page to be ready
    await page.waitForLoadState('networkidle');
    
    console.log('\n✅ Navigation completed successfully!');
    console.log('📝 Review the logs above for any issues');
    console.log('💡 If there were errors, the script would have exited');

    // Keep browser open for inspection
    console.log('\n⏳ Keeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);

    await monitor.close();
  } catch (error) {
    console.error('❌ Test failed:', error);
    await monitor.close();
    process.exit(1);
  }
}

main();

