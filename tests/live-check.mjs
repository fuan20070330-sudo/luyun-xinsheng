import assert from 'node:assert/strict';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const url = process.env.LIVE_URL || 'https://fuan20070330-sudo.github.io/luyun-xinsheng/';
const playwrightSpecifier = process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : 'playwright';
const { chromium } = await import(playwrightSpecifier);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
page.on('pageerror', (error) => errors.push('pageerror: ' + error.message));
try {
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => window.__LUYUN_APP__ && window.__LUYUN_APP__.state.initialized, null, { timeout: 15000 });
  await page.waitForFunction(() => document.getElementById('connection-pill').getAttribute('data-state') === 'disconnected', null, { timeout: 10000 });
  await page.click('[data-action="run-demo"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.artifacts.length === 4 && window.__LUYUN_APP__.state.reviews.length >= 1, null, { timeout: 20000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => ({
    title: document.title,
    mode: window.__LUYUN_APP__.state.transportMode,
    facts: window.__LUYUN_APP__.state.facts.length,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    reviews: window.__LUYUN_APP__.state.reviews.length,
    riskCards: document.querySelectorAll('#risk-list .risk-card').length,
    mobileWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    protocol: document.getElementById('connection-protocol').textContent
  }));
  assert.equal(result.artifacts, 3);
  assert.ok(result.reviews >= 1);
  assert.equal(result.mobileWidth, result.viewport);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ ok: true, url, ...result }, null, 2));
} finally {
  await browser.close();
}


