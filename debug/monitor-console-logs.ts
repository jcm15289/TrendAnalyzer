import { chromium, ConsoleMessage } from 'playwright';
import { appendFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

async function runMonitor() {
  console.log('🧪 Starting company description monitor...');

  const logPath = resolve(__dirname, 'browser-console.log');
  writeFileSync(logPath, '', 'utf-8');

  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const targetUrl = process.env.MONITOR_URL ?? 'http://localhost:3000';
  console.log(`🌐 Navigating to ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {
    console.warn('⚠️ networkidle state not reached within 30s (likely due to dev server HMR). Continuing anyway.');
  });

  const persistConsoleMessage = (msg: ConsoleMessage) => {
    const text = `[${new Date().toISOString()}] [${msg.type().toUpperCase()}] ${msg.text()}`;
    appendFileSync(logPath, text + '\n', 'utf-8');
  };

  page.on('console', msg => {
    const text = `[BROWSER] ${msg.type().toUpperCase()}: ${msg.text()}`;
    console.log(text);
    persistConsoleMessage(msg);
  });

  console.log('⏸️ Monitoring console output for 30 seconds...');
  await page.waitForTimeout(30_000);

  await browser.close();
  console.log('✅ Monitor finished.');
  console.log(`📝 Browser console log saved to ${logPath}`);
}

runMonitor().catch(error => {
  console.error('❌ Monitor error:', error);
  process.exitCode = 1;
});
