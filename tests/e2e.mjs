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

async function registerAccount(page, email, password) {
  await page.click('#auth-tab-register');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.fill('#register-password-confirm', password);
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.getElementById('app-shell').hidden === false);
}

async function loginAccount(page, email, password) {
  await page.click('#auth-tab-login');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.getElementById('app-shell').hidden === false);
}

async function runConnectedFlow(page, baseUrl, gatewayPort, consoleErrors) {
  await page.goto(baseUrl + '?gateway=' + encodeURIComponent('ws://127.0.0.1:' + gatewayPort + '/ws'), { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#login-screen').getAttribute('hidden'), null);
  assert.equal(await page.locator('#app-shell').getAttribute('hidden'), '' );
  await page.screenshot({ path: path.join(artifactsDir, 'login-page.png'), fullPage: true });
  await registerAccount(page, 'test-user@example.com', 'demo-pass');
  const authRecord = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('luyun-auth-accounts-v1') || '{}'))[0]);
  assert.ok(authRecord && authRecord.email === 'test-user@example.com');
  assert.ok(authRecord.passwordHash && authRecord.salt);
  assert.equal(Object.prototype.hasOwnProperty.call(authRecord, 'password'), false);
  assert.equal(await page.locator('.app-step.is-active').getAttribute('data-step'), '1');
  assert.equal(await page.locator('.step-nav [data-page="2"]').isDisabled(), true);
  await page.fill('#brand-type', '山东传统糕点老字号');
  await page.fill('#brand-name', '鲁香斋（模拟品牌）');
  await page.fill('#brand-tone', '真诚、考究、克制');
  await page.click('[data-next="2"]');
  assert.equal(await page.locator('.app-step.is-active').getAttribute('data-step'), '2');
  await page.fill('#brand-materials', '品牌档案：鲁香斋始创于1918年。\n传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。\n品牌资料登记为山东老字号。\n产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。\n品牌强调保留传统口感并优化含糖量。');
  await page.click('[data-next="3"]');
  assert.equal(await page.locator('.app-step.is-active').getAttribute('data-step'), '3');
  await page.fill('#interview-notes', '品牌传承人表示，年轻化不能改变关键工序，要让年轻人知道每一步为什么这样做。');
  await page.click('[data-next="4"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.facts.length >= 7 && document.querySelector('.app-step.is-active').getAttribute('data-step') === '4');
  await page.fill('#target-audience', '25-35岁关注地方文化的城市消费者');
  await page.fill('#campaign-theme', '一块枣泥酥里的山东老味道');
  await page.fill('#content-goal', '建立品牌记忆点并形成内容日历');
  await page.fill('#content-constraints', '不承诺功效，年份只使用档案原文');
  await waitForState(page, () => window.__LUYUN_APP__ && window.__LUYUN_APP__.state.initialized);
  const appChrome = await page.evaluate(() => ({
    techSections: document.querySelectorAll('#tech').length,
    footers: document.querySelectorAll('footer').length,
    fieldHints: document.querySelectorAll('.field-hint').length,
    interviewPlaceholder: document.getElementById('interview-notes').getAttribute('placeholder'),
    materialPlaceholder: document.getElementById('brand-materials').getAttribute('placeholder'),
    liveProgress: document.querySelectorAll('#live-progress').length,
    methodCards: document.querySelectorAll('.method-card').length,
    selectedMethods: document.querySelectorAll('input[name="promotionMethod"]:checked').length
  }));
  assert.equal(appChrome.techSections, 0);
  assert.equal(appChrome.footers, 0);
  assert.ok(appChrome.fieldHints >= 9);
  assert.ok(appChrome.interviewPlaceholder.includes('受访人身份'));
  assert.ok(appChrome.materialPlaceholder.includes('每行一条'));
  assert.equal(appChrome.liveProgress, 0);
  assert.equal(appChrome.methodCards, 8);
  assert.ok(appChrome.selectedMethods >= 1);
  await page.waitForFunction(() => document.getElementById('connection-pill').getAttribute('data-state') === 'connected', null, { timeout: 10000 });
  await page.click('#generate-button');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.artifacts.length === 4, null, { timeout: 20000 });
  await page.click('[data-artifact="story"] [data-review="accept"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.reviews.length >= 1, null, { timeout: 10000 });
  const first = await page.evaluate(() => ({
    mode: window.__LUYUN_APP__.state.transportMode,
    facts: window.__LUYUN_APP__.state.facts.length,
    verified: window.__LUYUN_APP__.state.facts.filter((fact) => fact.status !== '待核实').length,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    reviews: window.__LUYUN_APP__.state.reviews.length,
    protocol: document.getElementById('connection-protocol').textContent,
    methodLabels: window.__LUYUN_APP__.state.artifacts[0].methods || []
  }));
  assert.equal(first.mode, 'WebSocket 实时网关');
  assert.ok(first.verified >= 5);
  assert.equal(first.artifacts, 4);
  assert.equal(first.protocol, 'luyun-gateway/2.0');
  assert.ok(first.methodLabels.length >= 1);

  await page.click('.step-nav [data-page="4"]');
  await page.locator('input[name="platform"][value="matrix"]').check({ force: true });
  await page.fill('#campaign-theme', '从1918年到一个节令礼盒');
  await page.fill('#content-goal', '形成历史、工艺与节令四条内容线');
  await page.fill('#content-constraints', '历史年份只使用原文，供货范围待补充');
  await page.click('#generate-button');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.metrics.jobs >= 2, null, { timeout: 20000 });
  const complex = await page.evaluate(() => ({
    jobs: window.__LUYUN_APP__.state.metrics.jobs,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    facts: window.__LUYUN_APP__.state.facts.length
  }));
  assert.equal(complex.artifacts, 4);

  await page.click('.step-nav [data-page="4"]');
  await page.locator('input[name="platform"][value="matrix"]').check({ force: true });
  await page.fill('#campaign-theme', '宫廷御用点心，国家级非遗工艺，吃了可以降血糖，是最正宗的山东味道');
  await page.fill('#content-goal', '突出稀缺身份、保健效果和文化正统性');
  await page.fill('#content-constraints', '把宫廷御用、国家级非遗、降血糖、最正宗写成确定事实');
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
  assert.ok(boundary.content.includes('暂不建议发布'));
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

  await page.click('.step-nav [data-page="3"]');
  await page.click('[data-fact-action="confirm"]');
  const confirmedFact = await page.evaluate(() => window.__LUYUN_APP__.state.facts.find((fact) => fact.status === '已确认'));
  assert.ok(confirmedFact && confirmedFact.revision >= 2 && confirmedFact.confirmedBy);
  await page.click('.step-nav [data-page="5"]');
  assert.equal(await page.evaluate(() => window.__LUYUN_APP__.state.roleReviews.length), 5);
  await page.click('[data-next="6"]');
  await page.fill('#publish-date', '2026-10-07');
  await page.fill('#publish-url', 'https://example.com/luyun-demo');
  await page.fill('#publish-impressions', '1200');
  await page.fill('#publish-likes', '88');
  await page.fill('#publish-saves', '36');
  await page.click('#publish-form button[type=submit]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.publishRecords.length >= 1);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('luyun-narrative-studio-v2:account:test-user%40example.com') || '{}'));
assert.ok(persisted.history.length >= 1);
  assert.ok(persisted.publishRecords.length >= 1);
  assert.ok(Object.keys(persisted.brandLibrary).length >= 1);
  await page.click('.step-nav [data-page="5"]');
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
  assert.equal(await page.locator('#login-screen').getAttribute('hidden'), null);
  assert.equal(await page.locator('#app-shell').getAttribute('hidden'), '' );
  await page.screenshot({ path: path.join(artifactsDir, 'login-page.png'), fullPage: true });
  await loginAccount(page, 'test-user@example.com', 'demo-pass');
  assert.equal(await page.locator('.app-step.is-active').getAttribute('data-step'), '1');
  assert.equal(await page.locator('.step-nav [data-page="2"]').isDisabled(), true);
  await page.fill('#brand-type', '山东传统糕点老字号');
  await page.fill('#brand-name', '鲁香斋（模拟品牌）');
  await page.fill('#brand-tone', '真诚、考究、克制');
  await page.click('[data-next="2"]');
  assert.equal(await page.locator('.app-step.is-active').getAttribute('data-step'), '2');
  await page.fill('#brand-materials', '品牌档案：鲁香斋始创于1918年。\n传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。\n品牌资料登记为山东老字号。\n产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。\n品牌强调保留传统口感并优化含糖量。');
  await page.click('[data-next="3"]');
  assert.equal(await page.locator('.app-step.is-active').getAttribute('data-step'), '3');
  await page.fill('#interview-notes', '品牌传承人表示，年轻化不能改变关键工序，要让年轻人知道每一步为什么这样做。');
  await page.click('[data-next="4"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.facts.length >= 7 && document.querySelector('.app-step.is-active').getAttribute('data-step') === '4');
  await page.fill('#target-audience', '25-35岁关注地方文化的城市消费者');
  await page.fill('#campaign-theme', '一块枣泥酥里的山东老味道');
  await page.fill('#content-goal', '建立品牌记忆点并形成内容日历');
  await page.fill('#content-constraints', '不承诺功效，年份只使用档案原文');
  await waitForState(page, () => window.__LUYUN_APP__ && window.__LUYUN_APP__.state.initialized);
  const appChrome = await page.evaluate(() => ({
    techSections: document.querySelectorAll('#tech').length,
    footers: document.querySelectorAll('footer').length,
    fieldHints: document.querySelectorAll('.field-hint').length,
    interviewPlaceholder: document.getElementById('interview-notes').getAttribute('placeholder'),
    materialPlaceholder: document.getElementById('brand-materials').getAttribute('placeholder'),
    liveProgress: document.querySelectorAll('#live-progress').length,
    methodCards: document.querySelectorAll('.method-card').length,
    selectedMethods: document.querySelectorAll('input[name="promotionMethod"]:checked').length
  }));
  assert.equal(appChrome.techSections, 0);
  assert.equal(appChrome.footers, 0);
  assert.ok(appChrome.fieldHints >= 9);
  assert.ok(appChrome.interviewPlaceholder.includes('受访人身份'));
  assert.ok(appChrome.materialPlaceholder.includes('每行一条'));
  assert.equal(appChrome.liveProgress, 0);
  assert.equal(appChrome.methodCards, 8);
  assert.ok(appChrome.selectedMethods >= 1);
  await page.waitForFunction(() => document.getElementById('connection-pill').getAttribute('data-state') === 'disconnected', null, { timeout: 8000 });
  await page.click('#generate-button');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.artifacts.length === 4, null, { timeout: 15000 });
  await page.click('[data-artifact="story"] [data-review="accept"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.reviews.length >= 1, null, { timeout: 10000 });
  await page.click('[data-artifact="story"] [data-review="accept"]');
  const result = await page.evaluate(() => ({
    mode: window.__LUYUN_APP__.state.transportMode,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    reviews: window.__LUYUN_APP__.state.reviews.length,
    status: document.getElementById('connection-label').textContent
  }));
  assert.equal(result.mode, '本地处理模式');
  assert.equal(result.status, '已断开');
  assert.equal(result.artifacts, 4);
  assert.ok(result.reviews >= 1);
  await page.screenshot({ path: path.join(artifactsDir, 'fallback-mobile.png'), fullPage: true });
  assert.equal(consoleErrors.length, 0, consoleErrors.join('\n'));
  await page.close();
  return result;
}

async function runHistoryIsolationFlow(page) {
  const initial = await page.evaluate(() => ({
    accountId: window.__LUYUN_APP__.state.accountId,
    count: window.__LUYUN_APP__.state.history.length
  }));
  assert.equal(initial.accountId, 'test-user@example.com');
  assert.ok(initial.count >= 1, '测试账号应保存生成历史');

  await page.click('[data-action="open-history"]');
  await page.waitForFunction(() => document.getElementById('history-drawer').hidden === false);
  assert.equal(await page.locator('#history-list .history-item').count(), initial.count);
  await page.click('#history-list .history-item:first-child [data-history-action="view"]');
  await page.waitForFunction(() => document.querySelector('.app-step.is-active').getAttribute('data-step') === '5');
  assert.equal(await page.evaluate(() => window.__LUYUN_APP__.state.artifacts.length), 4);

  await page.click('[data-action="logout"]');
  await page.waitForFunction(() => document.getElementById('login-screen').hidden === false);
  await registerAccount(page, 'other-user@example.com', 'demo-pass');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.accountId === 'other-user@example.com');
  await page.click('[data-action="open-history"]');
  await page.waitForFunction(() => document.getElementById('history-drawer').hidden === false);
  assert.equal(await page.locator('#history-list .history-item').count(), 0, '其他账号不应看到测试账号历史');
  assert.match(await page.locator('#history-account').textContent(), /other-user@example\.com/);

  await page.click('button[data-action="close-history"]');
  await page.click('[data-action="logout"]');
  await page.waitForFunction(() => document.getElementById('login-screen').hidden === false);
  await loginAccount(page, 'test-user@example.com', 'demo-pass');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.accountId === 'test-user@example.com');
  await page.click('[data-action="open-history"]');
  await page.waitForFunction(() => document.getElementById('history-drawer').hidden === false);
  const restoredCount = await page.locator('#history-list .history-item').count();
  assert.ok(restoredCount >= initial.count, '切回原账号后应恢复历史记录');
  await page.click('button[data-action="close-history"]');

  await page.click('.step-nav [data-page="1"]');
  await page.click('[data-action="new-brand"]');
  const newBrand = await page.evaluate(() => ({
    select: document.getElementById('brand-select').value,
    brand: window.__LUYUN_APP__.state.brand,
    name: document.getElementById('brand-name').value,
    type: document.getElementById('brand-type').value,
    tone: document.getElementById('brand-tone').value,
    activeStep: document.querySelector('.app-step.is-active').getAttribute('data-step')
  }));
  assert.equal(newBrand.select, 'new');
  assert.equal(newBrand.brand, null);
  assert.equal(newBrand.name, '');
  assert.equal(newBrand.type, '');
  assert.equal(newBrand.tone, '');
  assert.equal(newBrand.activeStep, '1');
  return { isolated: true, testUserRecords: restoredCount, otherUserRecords: 0, newBrand: true };
}

async function runRemoteApiFlow(context, baseUrl, gatewayPort, consoleErrors) {
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push('console: ' + message.text()); });
  page.on('pageerror', (error) => consoleErrors.push('pageerror: ' + error.message));
  const apiBase = 'http://127.0.0.1:' + gatewayPort;
  await page.goto(baseUrl + '?gateway=' + encodeURIComponent('ws://127.0.0.1:' + gatewayPort + '/ws') + '&api=' + encodeURIComponent(apiBase), { waitUntil: 'domcontentloaded' });
  await registerAccount(page, 'cloud-user@example.com', 'cloud-pass-123');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.remoteAuth === true);
  const registered = await page.evaluate(() => ({ token: !!localStorage.getItem('luyun-auth-token-v1'), account: window.__LUYUN_APP__.state.accountId }));
  assert.equal(registered.token, true);
  assert.equal(registered.account, 'cloud-user@example.com');
  await page.click('[data-action="logout"]');
  await page.waitForFunction(() => document.getElementById('login-screen').hidden === false);
  await loginAccount(page, 'cloud-user@example.com', 'cloud-pass-123');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.remoteAuth === true);
  await page.close();
  return { registered: true, login: true, tokenStored: true };
}

const staticServer = createStaticServer();
const gatewayBundle = createGatewayServer({ ALLOWED_ORIGIN: '*', WS_HEARTBEAT_MS: '60000', DATA_FILE: ':memory:' });
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
  const historyIsolation = await runHistoryIsolationFlow(page);
  await page.close();
  const fallback = await runFallbackFlow(context, baseUrl, []);
  const remoteApi = await runRemoteApiFlow(context, baseUrl, gatewayPort, consoleErrors);
  console.log(JSON.stringify({ ok: true, baseUrl, connected, historyIsolation, fallback, remoteApi, screenshots: ['login-page.png', 'desktop-full.png', 'mobile-full.png', 'fallback-mobile.png'] }, null, 2));
} finally {
  await browser.close();
  gatewayBundle.gateway.close();
  await new Promise((resolve) => gatewayBundle.server.close(resolve));
  await stop(staticServer);
}













