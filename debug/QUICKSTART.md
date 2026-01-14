# Quick Start Guide

Get started with Chrome DevTools monitoring in 2 minutes!

## Setup Complete! ✅

The Chrome DevTools monitoring system is now installed in your project.

## Try It Now

### 1. Start Your Dev Server

In your first terminal:
```bash
npm run dev
```

Wait for it to start on http://localhost:3000

### 2. Run the Monitor

**Important**: Open a **new terminal in the editor area** (not embedded in composer):
- Click the `+` icon in the terminal panel
- Right-click the new terminal → "Move Terminal into Editor Area"

Then run:
```bash
npm run monitor
```

Or:
```bash
npx tsx debug/monitor-localhost.ts
```

A Chrome browser will open and you'll see:
- 📝 All console logs (log, info, warn, error)
- 🌐 Network requests and responses
- ❌ JavaScript errors with stack traces
- ⚠️ Failed API calls

### 3. Interact with Your App

- Click around your app in the opened browser
- Watch the terminal fill with live logs
- Every console.log, error, and network call appears instantly

### 4. Use with Cursor Composer

Now tell Composer things like:

> "What console errors do you see in the monitor terminal?"

> "Fix the console errors shown in the terminal"

> "Based on the network logs, why is the API call failing?"

Composer can now read the terminal output and help debug!

## Example Workflows

### Debug a Specific Page

Create a custom test (or use the stock table example):

```bash
npx tsx debug/test-stock-table.ts
```

### Automated Error Fixing

Tell Composer:

> "Run the monitor, find any console errors, fix them, and re-run until there are no errors"

Composer will:
1. ✅ Run the monitoring script
2. 📖 Read the console output
3. 🔧 Fix errors in your code
4. 🔄 Re-run and verify
5. ♻️ Repeat until clean

### Custom Test Scripts

Create your own test in `debug/`:

```typescript
import { BaseMonitor } from './base-monitor';

async function testMyFeature() {
  const monitor = new BaseMonitor({
    exitOnError: true,  // Auto-exit on errors
    url: 'http://localhost:3000/my-page'
  });

  const page = await monitor.launch();
  
  // Simulate user actions
  await page.click('#my-button');
  await page.waitForSelector('.result');
  
  await monitor.screenshot('debug/screenshots/my-feature.png');
  await monitor.close();
}

testMyFeature();
```

## Pro Tips

1. **Keep the terminal in the editor area** - This lets Composer reference it across sessions with `@terminal`

2. **Use exitOnError for automation** - Set `exitOnError: true` to automatically stop when errors occur

3. **Create specific test scripts** - Make a script for each problematic feature

4. **Take screenshots** - Visual context helps debugging: `await monitor.screenshot('path.png')`

5. **Let Composer iterate** - It can automatically run → fix → verify → repeat

## Available Scripts

```bash
npm run monitor              # Monitor localhost:3000
npm run monitor:example      # Example with auto-navigation
npx tsx debug/test-stock-table.ts    # Test your stock table
```

## Troubleshooting

**Q: Browser doesn't open**
- A: Run `npx playwright install chromium`

**Q: Composer can't see terminal output**
- A: Move terminal to editor area (right-click → "Move Terminal into Editor Area")

**Q: Script exits immediately**
- A: Check if `exitOnError: true` and there are console errors

**Q: Port 3000 connection refused**
- A: Make sure `npm run dev` is running first

## Learn More

See [README.md](./README.md) for detailed documentation and advanced usage.

## What's Next?

1. Try running `npm run monitor` now!
2. Open your app in the browser
3. Watch the logs appear in the terminal
4. Ask Composer to help debug based on what it sees

Happy debugging! 🎉

