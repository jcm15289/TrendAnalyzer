import { BaseMonitor } from './base-monitor';

async function testEarningsFormat() {
  console.log('📅 ====== TESTING EARNINGS CALENDAR FORMAT ======');
  
  const monitor = new BaseMonitor({
    headless: false,
    captureConsole: true,
    captureNetwork: true
  });
  
  try {
    const page = await monitor.launch();
    
    console.log('🌐 Loading production site...');
    await page.goto('https://stockscan-mymac.vercel.app/', { waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(3000);
    
    // Fetch the earnings calendar data directly
    console.log('📅 Fetching earnings calendar data from API...');
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/earning-calendar', { cache: 'no-store' });
        const data = await res.json();
        return data;
      } catch (e) {
        return { error: e.message };
      }
    });
    
    if (response.success && response.data?.content) {
      const content = response.data.content;
      console.log(`\n✅ Got ${response.data.lineCount} lines of data`);
      console.log(`\n📄 First 2000 characters of raw data:`);
      console.log(content.substring(0, 2000));
      
      console.log(`\n📄 Last 1000 characters of raw data:`);
      console.log(content.substring(content.length - 1000));
      
      // Split into lines and analyze
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      console.log(`\n📊 Total lines: ${lines.length}`);
      
      // Find header separators
      console.log(`\n🔍 Searching for header separators...`);
      const headerPatterns = ['Symbol', 'Fiscal Quarter', 'EPS Forecast', 'EPS Actual', 'Surprise'];
      let headerCount = 0;
      const headerPositions: number[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('symbol') && line.includes('fiscal') && line.includes('quarter')) {
          headerCount++;
          headerPositions.push(i);
          console.log(`\n📅 Header separator #${headerCount} found at line ${i}:`);
          // Show context around header
          for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 10); j++) {
            const marker = j === i ? '>>> ' : '    ';
            console.log(`${marker}${j}: ${lines[j]}`);
          }
        }
      }
      
      console.log(`\n📊 Found ${headerCount} header separators at positions: ${headerPositions.join(', ')}`);
      
      // Find day headers
      console.log(`\n🔍 Searching for day headers...`);
      const dayHeaders: Array<{ line: number; text: string }> = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d+,\s+\d{4}/)) {
          dayHeaders.push({ line: i, text: line });
          console.log(`📅 Day header found at line ${i}: ${line}`);
        }
      }
      
      console.log(`\n📊 Found ${dayHeaders.length} day headers`);
      
      // Analyze structure
      if (headerPositions.length > 0) {
        console.log(`\n📊 Analyzing structure between headers...`);
        for (let i = 0; i < Math.min(headerPositions.length, 3); i++) {
          const start = headerPositions[i];
          const end = i < headerPositions.length - 1 ? headerPositions[i + 1] : lines.length;
          console.log(`\n📅 Section ${i + 1} (lines ${start}-${end}):`);
          console.log(`   First 10 lines after header:`);
          for (let j = start; j < Math.min(start + 10, end); j++) {
            console.log(`   ${j}: ${lines[j]}`);
          }
        }
      }
      
    } else {
      console.log(`❌ Failed to fetch data:`, response);
    }
    
    console.log('\n⏳ Keeping browser open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await monitor.close();
  }
}

testEarningsFormat().catch(console.error);









