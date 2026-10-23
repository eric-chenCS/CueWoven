// Playwright adapter for running tests/browser on branded Edge in CI.
// New headless mode: the old headless shell cannot load unpacked extensions.
// waitForFunction polls with evaluate because extension CSP blocks Playwright's eval-based polling,
// and focuses the page first because background tabs in headless Edge stop rendering.
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const launch = pw.chromium.launchPersistentContext.bind(pw.chromium);
pw.chromium.launchPersistentContext = async (dir, opts = {}) => {
  const ctx = await launch(dir, {...opts, headless: false, args: ['--headless=new', ...(opts.args || [])]});
  const patch = page => {
    page.waitForFunction = async (fn, arg, o = {}) => {
      await page.bringToFront().catch(() => {});
      const end = Date.now() + (o.timeout ?? 30000), every = typeof o.polling === 'number' ? o.polling : 100;
      for (;;) {
        const value = await page.evaluate(fn, arg);
        if (value) return value;
        if (Date.now() > end) throw Error('waitForFunction timed out');
        await new Promise(resolve => setTimeout(resolve, every));
      }
    };
  };
  ctx.pages().forEach(patch); ctx.on('page', patch);
  return ctx;
};
module.exports = pw;
