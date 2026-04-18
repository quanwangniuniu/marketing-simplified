/**
 * Lighthouse CI `puppeteerScript` — logs in via /login so Zustand persist populates `auth-storage`.
 * Runs before each audited URL; login runs once per `lhci` process (same browser as Lighthouse).
 *
 * This file is **browser-only** (Puppeteer). Shared env + base URL come from `lhci-lib.cjs`.
 * API registration/login/project setup runs in `lhci-ensure-project.cjs` before `lhci autorun`.
 *
 * Credentials: LHCI_AUTH_EMAIL + LHCI_AUTH_PASSWORD.
 * Base URL: LHCI_BASE_URL or LHCI_API_BASE (see lhci-lib.cjs).
 *
 * Project-scoped URLs use LHCI_TEST_PROJECT_ID from lhci-ensure-project (prerequisite script runs before autorun).
 *
 * LHCI requires this hook so Lighthouse attaches to the same Puppeteer browser (CDP port).
 */
const { getBaseUrl, getCredentials } = require('./lhci-lib.cjs');

let sessionReady = false;

/**
 * @param {import('puppeteer').Browser} browser
 * @param {{ url: string, options: unknown }} _context
 */
module.exports = async function lhciPuppeteerLogin(browser, _context) {
  const creds = getCredentials();
  if (!creds) {
    return;
  }

  if (sessionReady) {
    return;
  }

  const base = getBaseUrl();
  const page = await browser.newPage();
  try {
    const loginUrl = `${base}/login`;
    await page.goto(loginUrl, { waitUntil: 'load', timeout: 90_000 });

    await page.waitForSelector('input[name="email"]', { visible: true, timeout: 30_000 });
    await page.waitForSelector('input[name="password"]', { visible: true, timeout: 30_000 });

    await page.$eval('input[name="email"]', (el) => {
      el.value = '';
    });
    await page.$eval('input[name="password"]', (el) => {
      el.value = '';
    });

    await page.type('input[name="email"]', creds.email, { delay: 5 });
    await page.type('input[name="password"]', creds.password, { delay: 5 });

    await page.waitForFunction(
      () => {
        const button = document.querySelector('form button[type="submit"]');
        return Boolean(button) && !button.disabled;
      },
      { timeout: 30_000 }
    );

    await page.click('form button[type="submit"]');

    try {
      await page.waitForFunction(
        () => {
          try {
            const raw = localStorage.getItem('auth-storage');
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return Boolean(parsed?.state?.token);
          } catch {
            return false;
          }
        },
        { timeout: 90_000 }
      );
    } catch {
      throw new Error(
        'LHCI login did not produce auth-storage (check LHCI_AUTH_EMAIL / LHCI_AUTH_PASSWORD, API reachability, and email verification).'
      );
    }

    sessionReady = true;
  } finally {
    await page.close();
  }
};
