# Chrome DevTools Monitor for Cursor Composer

This setup enables Cursor's composer agent to have live access to Chrome console logs and network activity for advanced debugging.

## Features

- 📝 **Console Monitoring**: Capture all console.log, console.error, console.warn, etc.
- 🌐 **Network Monitoring**: Track all HTTP requests and responses
- ❌ **Error Detection**: Automatically exit on console errors (optional)
- 🔄 **Auto-reload Support**: Clear console on page refresh
- 📸 **Screenshot Capability**: Capture page state
- 🎯 **Custom Scripts**: Extend BaseMonitor for specific test scenarios

## Quick Start

### 1. Monitor Your Local Development Server

Start your Next.js app:
```bash
npm run dev
```

In a **separate terminal in the editor area** (important!), run:
```bash
npx tsx debug/monitor-localhost.ts
```

This will:
- Open a Chrome browser to http://localhost:3000
- Display all console logs and network activity in the terminal
- Keep running until you press Ctrl+C

### 2. Use with Cursor Composer

**Important**: The terminal must be in the **editor area**, not embedded in composer chat.

To move a terminal to the editor area:
1. If composer opens an embedded terminal, click "Move to panel"
2. Right-click the terminal in the terminal panel
3. Select "Move Terminal into Editor Area"

Now Cursor Composer can access the terminal output across sessions!

### 3. Example Debugging Workflow

Tell the Composer:

> "Run the localhost monitor, then tell me what console errors you see"

Or:

> "Monitor the browser, navigate to /stock-table, and fix any console errors"

The agent will:
1. Execute the monitoring script
2. Read the console output in real-time
3. Identify errors from the terminal
4. Fix the code
5. Ask you to refresh the browser to verify the fix

## Scripts

### `monitor-localhost.ts`
Basic monitor for your local dev server. Keeps running and logging everything.

```bash
npx tsx debug/monitor-localhost.ts
```

### `example-navigate-to-page.ts`
Example showing automated navigation with error detection. Exits on first console error.

```bash
npx tsx debug/example-navigate-to-page.ts
```

## Creating Custom Scripts

Extend `BaseMonitor` for your specific debugging needs:

```typescript
import { BaseMonitor } from './base-monitor';

async function debugMyComponent() {
  const monitor = new BaseMonitor({
    exitOnError: true,  // Exit on console errors
    url: 'http://localhost:3000/my-page'
  });

  const page = await monitor.launch();
  
  // Your custom test logic
  await page.click('#my-button');
  await page.waitForSelector('.result');
  
  // Get data from the page
  const data = await monitor.evaluate(() => {
    return document.querySelector('.result')?.textContent;
  });
  
  console.log('Result:', data);
  
  await monitor.close();
}

debugMyComponent();
```

## Configuration Options

```typescript
{
  exitOnError: false,      // Exit script when console errors occur
  clearOnRefresh: true,    // Clear terminal on page refresh/navigation
  captureNetwork: true,    // Monitor network requests
  captureConsole: true,    // Monitor console logs
  headless: false,         // Run browser in headless mode
  url: 'http://...'        // Initial URL to navigate to
}
```

## Advanced Usage

### Automated Fix Loop

Tell Composer:

> "Run monitor-localhost.ts, identify any console errors, fix them, then re-run the monitor until there are no errors"

The Composer will iteratively:
1. Run the monitor script
2. Read errors from the terminal output
3. Fix the code
4. Re-run the monitor
5. Repeat until clean

### Debugging Specific User Flows

Create a custom script for a problematic user flow:

```typescript
// debug/test-create-stock-list.ts
import { BaseMonitor } from './base-monitor';

async function testCreateStockList() {
  const monitor = new BaseMonitor({
    exitOnError: true,
    url: 'http://localhost:3000'
  });

  const page = await monitor.launch();
  
  // Simulate the user flow
  await page.click('[data-testid="create-list-button"]');
  await page.fill('input[name="listName"]', 'Test List');
  await page.click('button[type="submit"]');
  
  await page.waitForSelector('.success-message');
  
  await monitor.close();
}

testCreateStockList();
```

Then ask Composer:

> "Run test-create-stock-list.ts and fix any errors that appear"

## Tips

1. **Keep terminals in the editor area** so Composer can reference them with `@terminal`
2. **Use `exitOnError: true`** for automated debugging workflows
3. **Create specific test scripts** for problematic features
4. **Let Composer iterate** - it can run → fix → run cycles automatically
5. **Take screenshots** during critical moments: `await monitor.screenshot('debug.png')`

## Troubleshooting

### Browser doesn't open
- Make sure Playwright is installed: `npm install -D playwright`
- Install browser binaries: `npx playwright install chromium`

### Composer can't see terminal output
- Ensure the terminal is in the **editor area**, not embedded in chat
- Reference it with `@terminal` in Composer

### Script exits immediately
- Check if `exitOnError: true` is enabled and console errors exist
- Make sure your dev server is running on the expected port

## Resources

- [Original Forum Tutorial](https://forum.cursor.com/t/tutorial-supercharged-cursor-composer-agent-with-chrome-devtools/51394)
- [Playwright Documentation](https://playwright.dev/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

