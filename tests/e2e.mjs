import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createServer: createGatewayServer } = require('../server/src/server.js');
const root = path.resolve('.');
const prefix = '/luyun-xinsheng/';
const artifactsDir = path.join(root, 'tests', 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const playwrightSpecifier = process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : 'playwright';
const { chromium } = await import(playwrightSpecifier);

const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png'
};

function createStaticServer() {
  return http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith(prefix)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    let relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    if (relative.endsWith('/')) relative += 'index.html';
    const target = path.resolve(root, relative);
    if (!target.startsWith(root)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    fs.readFile(target, (error, data) => {
      if (error) { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(200, { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(data);
    });
  });
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function stop(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function waitForState(page, expression, timeout = 20000) {
  await page.waitForFunction(expression, null, { timeout });
}

async function runConnectedFlow(page, baseUrl, gatewayPort, consoleErrors) {
  await page.goto(baseUrl + '?gateway=' + encodeURIComponent('ws://127.0.0.1:' + gatewayPort + '/ws'), { waitUntil: 'networkidle' });
  await waitForState(page, () => window.__LUYUN_APP__ && window.__LUYUN_APP__.state.initialized);
  const appChrome = await page.evaluate(() => ({
    techSections: document.querySelectorAll('#tech').length,
    footers: document.querySelectorAll('footer').length,
    fieldHints: document.querySelectorAll('.field-hint').length,
    interviewPlaceholder: document.getElementById('interview-notes').getAttribute('placeholder'),
    materialPlaceholder: document.getElementById('brand-materials').getAttribute('placeholder')
  }));
  assert.equal(appChrome.techSections, 0);
  assert.equal(appChrome.footers, 0);
  assert.ok(appChrome.fieldHints >= 9);
  assert.ok(appChrome.interviewPlaceholder.includes('受访人身份'));
  assert.ok(appChrome.materialPlaceholder.includes('每行一条'));
  await page.waitForFunction(() => document.getElementById('connection-pill').getAttribute('data-state') === 'connected', null, { timeout: 10000 });
  await page.click('[data-action="run-demo"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.artifacts.length === 4, null, { timeout: 20000 });
  await page.waitForFunction(() => window.__LUYUN_APP__.state.reviews.length >= 1, null, { timeout: 10000 });
  const first = await page.evaluate(() => ({
    mode: window.__LUYUN_APP__.state.transportMode,
    facts: window.__LUYUN_APP__.state.facts.length,
    verified: window.__LUYUN_APP__.state.facts.filter((fact) => fact.status !== '待核实').length,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    reviews: window.__LUYUN_APP__.state.reviews.length,
    protocol: document.getElementById('connection-protocol').textContent
  }));
  assert.equal(first.mode, 'WebSocket 实时网关');
  assert.equal(first.verified, 7);
  assert.equal(first.artifacts, 4);
  assert.equal(first.protocol, 'luyun-gateway/1.0');

  await page.click('[data-case="complex"]');
  await page.click('#generate-button');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.metrics.jobs >= 2, null, { timeout: 20000 });
  const complex = await page.evaluate(() => ({
    jobs: window.__LUYUN_APP__.state.metrics.jobs,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    facts: window.__LUYUN_APP__.state.facts.length
  }));
  assert.equal(complex.artifacts, 4);

  await page.click('[data-case="boundary"]');
  await page.click('#generate-button');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.metrics.jobs >= 3, null, { timeout: 20000 });
  const boundary = await page.evaluate(() => ({
    high: window.__LUYUN_APP__.state.risks.filter((risk) => risk.level === 'high').length,
    terms: window.__LUYUN_APP__.state.risks.filter((risk) => risk.level === 'high').map((risk) => risk.term),
    content: window.__LUYUN_APP__.state.artifacts[0].content,
    cards: document.querySelectorAll('#risk-list [data-level="high"]').length
  }));
  assert.ok(boundary.high >= 3, '边界输入至少 3 个高风险');
  assert.ok(boundary.terms.includes('宫廷御用'));
  assert.ok(boundary.terms.includes('国家级非遗'));
  assert.ok(boundary.terms.includes('降血糖'));
  assert.ok(boundary.content.includes('发布拦截'));
  assert.equal(boundary.cards, boundary.high);

  await page.click('[data-artifact="story"] [data-review="edit"]');
  await page.waitForFunction(() => document.querySelector('[data-artifact="story"]').classList.contains('is-editing'), null, { timeout: 5000 });
  const original = await page.evaluate(() => window.__LUYUN_APP__.state.artifacts.find((artifact) => artifact.id === 'story').originalContent);
  await page.fill('[data-artifact="story"] .artifact-textarea', '人工复核稿：仅保留已核实内容。所有未证实称号与功效表述均不进入发布文案。');
  await page.click('[data-artifact="story"] [data-review="save"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.reviews.length >= 2, null, { timeout: 10000 });
  const editReview = await page.evaluate(() => ({
    content: window.__LUYUN_APP__.state.artifacts.find((artifact) => artifact.id === 'story').content,
    original: window.__LUYUN_APP__.state.artifacts.find((artifact) => artifact.id === 'story').originalContent,
    review: window.__LUYUN_APP__.state.reviews[0]
  }));
  assert.equal(editReview.original, original);
  assert.notEqual(editReview.content, original);
  assert.equal(editReview.review.action, 'edit');
  assert.equal(editReview.review.before.length > 0, true);

  const downloadPromise = page.waitForEvent('download');
  await page.click('#export-markdown');
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /老字号叙事工坊.*品牌确认包\.md$/);
  await page.screenshot({ path: path.join(artifactsDir, 'desktop-full.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const offenders = await page.evaluate(() => Array.from(document.querySelectorAll('*')).map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName, className: String(el.className).slice(0,80), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), scrollWidth: el.scrollWidth }; }).filter((item) => item.right > window.innerWidth + 1 || item.left < -1 || item.scrollWidth > window.innerWidth + 1).slice(0, 20));
  const mobile = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  assert.ok(mobile.scrollWidth <= mobile.innerWidth, '390px 视图不应产生横向滚动：' + JSON.stringify(offenders));
  await page.screenshot({ path: path.join(artifactsDir, 'mobile-full.png'), fullPage: true });
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  return { first, complex, boundary, editReview: { retainedOriginal: true, action: editReview.review.action }, mobile };
}

async function runFallbackFlow(context, baseUrl, consoleErrors) {
  const page = await context.newPage();
  await page.goto(baseUrl + '?gateway=' + encodeURIComponent('ws://127.0.0.1:1/ws'), { waitUntil: 'domcontentloaded' });
  await waitForState(page, () => window.__LUYUN_APP__ && window.__LUYUN_APP__.state.initialized);
  const appChrome = await page.evaluate(() => ({
    techSections: document.querySelectorAll('#tech').length,
    footers: document.querySelectorAll('footer').length,
    fieldHints: document.querySelectorAll('.field-hint').length,
    interviewPlaceholder: document.getElementById('interview-notes').getAttribute('placeholder'),
    materialPlaceholder: document.getElementById('brand-materials').getAttribute('placeholder')
  }));
  assert.equal(appChrome.techSections, 0);
  assert.equal(appChrome.footers, 0);
  assert.ok(appChrome.fieldHints >= 9);
  assert.ok(appChrome.interviewPlaceholder.includes('受访人身份'));
  assert.ok(appChrome.materialPlaceholder.includes('每行一条'));
  await page.waitForFunction(() => document.getElementById('connection-pill').getAttribute('data-state') === 'disconnected', null, { timeout: 8000 });
  await page.click('[data-action="run-demo"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.artifacts.length === 4 && window.__LUYUN_APP__.state.reviews.length >= 1, null, { timeout: 15000 });
  const result = await page.evaluate(() => ({
    mode: window.__LUYUN_APP__.state.transportMode,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    reviews: window.__LUYUN_APP__.state.reviews.length,
    status: document.getElementById('connection-label').textContent
  }));
  assert.equal(result.mode, '本地演示模式');
  assert.equal(result.status, '已断开');
  assert.equal(result.artifacts, 4);
  assert.ok(result.reviews >= 1);
  await page.screenshot({ path: path.join(artifactsDir, 'fallback-mobile.png'), fullPage: true });
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  await page.close();
  return result;
}

const staticServer = createStaticServer();
const gatewayBundle = createGatewayServer({ ALLOWED_ORIGIN: '*', WS_HEARTBEAT_MS: '60000' });
const staticPort = await listen(staticServer);
const gatewayPort = await listen(gatewayBundle.server);
const baseUrl = 'http://127.0.0.1:' + staticPort + prefix;
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const consoleErrors = [];
const page = await context.newPage();
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push('console: ' + message.text()); });
page.on('pageerror', (error) => consoleErrors.push('pageerror: ' + error.message));

try {
  const connected = await runConnectedFlow(page, baseUrl, gatewayPort, consoleErrors);
  await page.close();
  const fallback = await runFallbackFlow(context, baseUrl, []);
  console.log(JSON.stringify({ ok: true, baseUrl, connected, fallback, screenshots: ['desktop-full.png', 'mobile-full.png', 'fallback-mobile.png'] }, null, 2));
} finally {
  await browser.close();
  gatewayBundle.gateway.close();
  await new Promise((resolve) => gatewayBundle.server.close(resolve));
  await stop(staticServer);
}






