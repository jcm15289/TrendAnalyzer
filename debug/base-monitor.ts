import { chromium, Browser, BrowserContext, Page } from 'playwright';

export interface MonitorConfig {
  exitOnError?: boolean;
  clearOnRefresh?: boolean;
  captureNetwork?: boolean;
  captureConsole?: boolean;
  headless?: boolean;
  url?: string;
}

export class BaseMonitor {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected config: MonitorConfig;

  constructor(config: MonitorConfig = {}) {
    this.config = {
      exitOnError: false,
      clearOnRefresh: true,
      captureNetwork: true,
      captureConsole: true,
      headless: false,
      ...config,
    };
  }

  async launch(): Promise<Page> {
    console.log('🚀 Launching browser...');
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: ['--start-maximized'],
    });

    this.context = await this.browser.newContext({
      viewport: null,
    });

    this.page = await this.context.newPage();

    this.setupConsoleMonitoring();
    this.setupNetworkMonitoring();
    this.setupErrorHandling();

    if (this.config.url) {
      await this.navigateTo(this.config.url);
    }

    return this.page;
  }

  private setupConsoleMonitoring() {
    if (!this.config.captureConsole || !this.page) return;

    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();
      
      const emojiMap: Record<string, string> = {
        log: '📝',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        debug: '🐛',
      };
      const emoji = emojiMap[type] || '📋';

      console.log(`${emoji} [CONSOLE.${type.toUpperCase()}] ${text}`);
      if (location.url) {
        console.log(`   at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
      }

      if (this.config.exitOnError && type === 'error') {
        console.error('🛑 Console error detected, exiting...');
        this.close();
        process.exit(1);
      }
    });
  }

  private setupNetworkMonitoring() {
    if (!this.config.captureNetwork || !this.page) return;

    this.page.on('request', (request) => {
      console.log(`🌐 [REQUEST] ${request.method()} ${request.url()}`);
    });

    this.page.on('response', (response) => {
      const status = response.status();
      const emoji = status >= 200 && status < 300 ? '✅' : 
                     status >= 400 ? '❌' : '⚠️';
      console.log(`${emoji} [RESPONSE] ${status} ${response.url()}`);
      
      if (status >= 400) {
        console.error(`   Error response: ${status} ${response.statusText()}`);
      }
    });

    this.page.on('requestfailed', (request) => {
      console.error(`❌ [REQUEST FAILED] ${request.url()}`);
      console.error(`   Failure: ${request.failure()?.errorText}`);
    });
  }

  private setupErrorHandling() {
    if (!this.page) return;

    this.page.on('pageerror', (error) => {
      console.error('❌ [PAGE ERROR]', error.message);
      console.error('   Stack:', error.stack);

      if (this.config.exitOnError) {
        console.error('🛑 Page error detected, exiting...');
        this.close();
        process.exit(1);
      }
    });

    this.page.on('crash', () => {
      console.error('💥 [PAGE CRASH] The page has crashed!');
      if (this.config.exitOnError) {
        this.close();
        process.exit(1);
      }
    });
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    
    console.log(`🔗 Navigating to: ${url}`);
    
    if (this.config.clearOnRefresh) {
      console.clear();
      console.log('🧹 Console cleared');
    }

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log('✅ Page loaded');
  }

  async reload(): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    
    if (this.config.clearOnRefresh) {
      console.clear();
      console.log('🧹 Console cleared');
    }

    console.log('🔄 Reloading page...');
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    console.log('✅ Page reloaded');
  }

  async waitForNavigation(): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async screenshot(path: string): Promise<void> {
    if (!this.page) throw new Error('Browser not launched');
    await this.page.screenshot({ path, fullPage: true });
    console.log(`📸 Screenshot saved: ${path}`);
  }

  async evaluate(script: string): Promise<any> {
    if (!this.page) throw new Error('Browser not launched');
    return await this.page.evaluate(script);
  }

  async close(): Promise<void> {
    console.log('👋 Closing browser...');
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  getPage(): Page {
    if (!this.page) throw new Error('Browser not launched. Call launch() first.');
    return this.page;
  }
}

