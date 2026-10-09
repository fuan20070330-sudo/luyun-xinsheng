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
  const liveEmail = 'live-' + Date.now() + '@example.com';
  await page.click('#auth-tab-register');
  await page.fill('#login-email', liveEmail);
  await page.fill('#login-password', 'demo-pass-123');
  await page.fill('#register-password-confirm', 'demo-pass-123');
  await page.click('#auth-submit');
  await page.waitForFunction(() => document.getElementById('app-shell').hidden === false && window.__LUYUN_APP__.state.remoteAuth === true);
  const remoteSession = await page.evaluate(async () => {
    const response = await fetch(window.LUYUN_CONFIG.apiBaseUrl + '/api/auth/me', { credentials: 'include' });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(remoteSession.status, 200);
  assert.equal(remoteSession.body.user.email, liveEmail);
  await page.fill('#brand-type', '山东传统糕点老字号');
  await page.fill('#brand-name', '鲁香斋（模拟品牌）');
  await page.fill('#brand-tone', '真诚、考究、克制');
  await page.click('[data-next="2"]');
  await page.fill('#brand-materials', '品牌档案：鲁香斋始创于1918年。\n传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。\n品牌资料登记为山东老字号。\n产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。\n品牌强调保留传统口感并优化含糖量。');
  await page.click('[data-next="3"]');
  await page.fill('#interview-notes', '品牌传承人表示，年轻化不能改变关键工序，要让年轻人知道每一步为什么这样做。');
  await page.click('[data-next="4"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.facts.length >= 7 && document.querySelector('.app-step.is-active').getAttribute('data-step') === '4');
  await page.click('.step-nav [data-page="3"]');
  await page.click('[data-action="verify-facts"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.facts.some((fact) => fact.verificationMethod && !['not-configured', 'no-source'].includes(fact.verificationMethod)), null, { timeout: 35000 });
  await page.click('.step-nav [data-page="4"]');
  await page.fill('#target-audience', '25-35岁关注地方文化的城市消费者');
  await page.fill('#campaign-theme', '一块枣泥酥里的山东老味道');
  await page.fill('#content-goal', '建立品牌记忆点并形成内容日历');
  await page.fill('#content-constraints', '不承诺功效，年份只使用档案原文');
  await page.click('#generate-button');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.artifacts.length === 4, null, { timeout: 20000 });
  await page.click('[data-artifact="story"] [data-review="accept"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.reviews.length >= 1, null, { timeout: 10000 });
  await page.click('[data-action="open-history"]');
  await page.waitForFunction(() => document.getElementById('history-drawer').hidden === false);
  const historyRecords = await page.locator('#history-list .history-item').count();
  assert.ok(historyRecords >= 1, '线上账号应保存生成历史');
  await page.click('button[data-action="close-history"]');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => ({
    title: document.title,
    mode: window.__LUYUN_APP__.state.transportMode,
    facts: window.__LUYUN_APP__.state.facts.length,
    categories: Array.from(new Set(window.__LUYUN_APP__.state.facts.map((fact) => fact.category))),
    interviewInput: document.getElementById('interview-notes').value.length,
    artifacts: window.__LUYUN_APP__.state.artifacts.length,
    reviews: window.__LUYUN_APP__.state.reviews.length,
    riskCards: document.querySelectorAll('#risk-list .risk-card').length,
    mobileWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    protocol: document.getElementById('connection-protocol').textContent,
    activeStep: document.querySelector('.app-step.is-active').getAttribute('data-step'),
    loginHidden: document.getElementById('login-screen').hidden,
    liveProgress: document.querySelectorAll('#live-progress').length,
    roleReviews: window.__LUYUN_APP__.state.roleReviews.length,
    publishForm: !!document.getElementById('publish-form'),
    methodCards: document.querySelectorAll('.method-card').length,
    techSections: document.querySelectorAll('#tech').length,
    footers: document.querySelectorAll('footer').length,
    fieldHints: document.querySelectorAll('.field-hint').length,
    historyRecords: window.__LUYUN_APP__.state.history.length,
    newBrandButton: !!document.querySelector('[data-action="new-brand"]'),
    remoteAuth: window.__LUYUN_APP__.state.remoteAuth,
    verificationMethod: window.__LUYUN_APP__.state.facts.find((fact) => fact.verificationMethod)?.verificationMethod,
    manifest: !!document.querySelector('link[rel="manifest"]'),
    serviceWorkerSupported: 'serviceWorker' in navigator,
    qualityScore: window.__LUYUN_APP__.state.artifacts[0] && window.__LUYUN_APP__.state.artifacts[0].quality && window.__LUYUN_APP__.state.artifacts[0].quality.score,
    evidenceLevel: window.__LUYUN_APP__.state.facts[0] && window.__LUYUN_APP__.state.facts[0].evidenceLevel
  }));
  assert.equal(result.artifacts, 4);
  assert.ok(result.reviews >= 1);
  assert.equal(result.mobileWidth, result.viewport);
  assert.equal(result.techSections, 0);
  assert.equal(result.footers, 0);
  assert.ok(result.fieldHints >= 9);
  assert.equal(result.activeStep, '5');
  assert.equal(result.loginHidden, true);
  assert.equal(result.liveProgress, 0);
  assert.equal(result.roleReviews, 5);
  assert.equal(result.publishForm, true);
  assert.equal(result.methodCards, 8);
  assert.ok(result.historyRecords >= 1);
  assert.equal(result.newBrandButton, true);
  assert.equal(result.remoteAuth, true);
  assert.notEqual(result.verificationMethod, 'not-configured');
  assert.equal(result.manifest, true);
  assert.equal(result.serviceWorkerSupported, true);
  assert.ok(result.qualityScore >= 0);
  assert.ok(result.evidenceLevel);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ ok: true, url, ...result }, null, 2));
} finally {
  await browser.close();
}








