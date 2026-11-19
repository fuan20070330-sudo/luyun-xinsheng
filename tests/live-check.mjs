import assert from 'node:assert/strict';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const url = process.env.LIVE_URL || 'https://fuan20070330-sudo.github.io/luyun-xinsheng/';
const playwrightSpecifier = process.env.PLAYWRIGHT_PATH ? pathToFileURL(process.env.PLAYWRIGHT_PATH).href : 'playwright';
const { chromium } = await import(playwrightSpecifier);
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
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
  const splitEntry = await page.evaluate(() => Array.from(document.querySelectorAll('.mode-choice')).map((item) => Math.round(item.getBoundingClientRect().width)));
  assert.equal(splitEntry.length, 2);
  assert.ok(Math.abs(splitEntry[0] - splitEntry[1]) <= 2);
  await page.click('[data-app-mode="generate"]');
  await page.waitForFunction(() => document.getElementById('generation-layout').hidden === false);
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
  const innovation = await page.evaluate(() => ({ graphNodes: document.querySelectorAll('#memory-graph .graph-node').length, proofStatus: document.getElementById('proof-status').textContent, claimCards: document.querySelectorAll('#proof-engine .claim-card').length, dnaCount: document.getElementById('culture-dna-count').textContent, gapCount: document.getElementById('evidence-gap-count').textContent, passportId: document.getElementById('passport-id').textContent, fidelityChips: document.querySelectorAll('[data-artifact] .fidelity-chip').length }));
  assert.ok(innovation.graphNodes >= 6);
  assert.match(innovation.dnaCount, /保护/);
  assert.match(innovation.gapCount, /缺口/);
  assert.match(innovation.passportId, /^LYXS-/);
  assert.equal(innovation.fidelityChips, 4);
  assert.match(innovation.proofStatus, /证明/);
  assert.ok(innovation.claimCards >= 4);
  await page.waitForFunction(() => window.__LUYUN_APP__.state.passport && window.__LUYUN_APP__.state.passport.signature, null, { timeout: 20000 });
  const passportVerification = await page.evaluate(async () => {
    const passport = window.__LUYUN_APP__.state.passport;
    const response = await fetch(window.LUYUN_CONFIG.apiBaseUrl + '/api/passport/verify?id=' + encodeURIComponent(passport.id), { credentials: 'include' });
    const body = await response.json();
    return {
      id: passport.id,
      endpointStatus: response.status,
      valid: body.valid,
      signed: !!passport.signature,
      signingKeyId: passport.signingKeyId,
      verification: body.verification
    };
  });
  assert.equal(passportVerification.endpointStatus, 200);
  assert.equal(passportVerification.valid, true);
  assert.equal(passportVerification.signed, true);
  assert.ok(passportVerification.signingKeyId);
  const proofPage = await context.newPage();
  proofPage.on('console', (message) => { if (message.type() === 'error') errors.push('proof console: ' + message.text()); });
  proofPage.on('pageerror', (error) => errors.push('proof pageerror: ' + error.message));
  const proofUrl = new URL('proof.html?id=' + encodeURIComponent(passportVerification.id), url).href;
  const proofResponse = await proofPage.goto(proofUrl, { waitUntil: 'networkidle', timeout: 45000 });
  assert.equal(proofResponse.status(), 200);
  await proofPage.waitForFunction(() => document.getElementById('proof-state').dataset.valid === 'true', null, { timeout: 15000 });
  const proof = await proofPage.evaluate(() => ({
    status: document.getElementById('proof-state').textContent,
    valid: document.getElementById('proof-state').dataset.valid,
    fields: document.querySelectorAll('#proof-grid > div').length,
    passportShown: document.body.textContent.includes('LYXS-')
  }));
  assert.equal(proof.valid, 'true');
  assert.match(proof.status, /签名有效/);
  assert.ok(proof.fields >= 12);
  assert.equal(proof.passportShown, true);
  await proofPage.close();
  await page.click('[data-action="open-analyzer"]');
  await page.waitForFunction(() => document.getElementById('analyzer-drawer').hidden === false);
  await page.fill('#analyzer-text', '鲁香斋是宫廷御用点心。品牌是国家级非遗。产品吃一块就能降血糖。1918年全国第一。');
  await page.selectOption('#analyzer-platform', 'douyin');
  await page.click('#analyzer-form button[type="submit"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.analysisResult && window.__LUYUN_APP__.state.analysisResult.highRiskCount >= 3, null, { timeout: 10000 });
  const analyzer = await page.evaluate(() => ({
    status: window.__LUYUN_APP__.state.analysisResult.status,
    highRiskCount: window.__LUYUN_APP__.state.analysisResult.highRiskCount,
    sentenceRows: document.querySelectorAll('#analyzer-results .sentence-row').length,
    riskCards: document.querySelectorAll('#analyzer-results .gap-card').length,
    safeRewriteLength: document.querySelector('#analyzer-results .safe-rewrite').textContent.trim().length
  }));
  assert.match(analyzer.status, /高风险/);
  assert.ok(analyzer.highRiskCount >= 3);
  assert.ok(analyzer.sentenceRows >= 3);
  assert.ok(analyzer.riskCards >= 3);
  assert.ok(analyzer.safeRewriteLength > 20);
  await page.click('#analyzer-drawer .history-drawer-panel button[data-action="close-analyzer"]');
  await page.click('[data-artifact="story"] [data-review="accept"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.reviews.length >= 1, null, { timeout: 10000 });
  await page.click('[data-action="open-history"]');
  await page.waitForFunction(() => document.getElementById('history-drawer').hidden === false);
  const historyRecords = await page.locator('#history-list .history-item').count();
  assert.ok(historyRecords >= 1, '线上账号应保存生成历史');
  await page.click('button[data-action="close-history"]');
  await page.click('[data-action="show-mode-hub"]');
  await page.waitForFunction(() => document.getElementById('mode-hub').hidden === false);
  await page.click('[data-app-mode="revise"]');
  await page.waitForFunction(() => document.getElementById('revise-workspace').hidden === false);
  assert.equal(await page.locator('#revision-dropzone').isVisible(), true);
  await page.selectOption('#revision-source-select', { index: 1 });
  await page.waitForFunction(() => window.__LUYUN_APP__.state.revision && window.__LUYUN_APP__.state.revision.originalText.length > 100);
  await page.fill('#revision-keep', '保留1918年和五道主要工序');
  await page.fill('#revision-requirements', '更自然，压缩到260字以内，不要新增资料中没有的事实');
  await page.click('[data-action="analyze-revision"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.revision.analysis && window.__LUYUN_APP__.state.revision.analysis.sentences.length >= 3);
  const revisionIssues = await page.locator('#revision-issues .revision-issue').count();
  assert.ok(revisionIssues >= 1);
  await page.click('[data-action="run-revision"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.revision.resultText && window.__LUYUN_APP__.state.revision.resultText.length > 100);
  await page.click('[data-action="save-revision"]');
  await page.waitForFunction(() => window.__LUYUN_APP__.state.revisionHistory.length >= 1);
  const revision = await page.evaluate(() => ({
    source: window.__LUYUN_APP__.state.revision.sourceTitle,
    issues: document.querySelectorAll('#revision-issues .revision-issue').length,
    changes: window.__LUYUN_APP__.state.revision.changes.length,
    saved: window.__LUYUN_APP__.state.revisionHistory.length,
    originalRetained: window.__LUYUN_APP__.state.revisionHistory[0].originalText.length > 0,
    resultRetained: window.__LUYUN_APP__.state.revisionHistory[0].resultText.length > 0
  }));
  assert.ok(revision.changes >= 1);
  assert.equal(revision.saved, 1);
  assert.equal(revision.originalRetained, true);
  assert.equal(revision.resultRetained, true);
  await page.click('[data-action="show-mode-hub"]');
  await page.click('[data-app-mode="generate"]');
  await page.evaluate(() => window.__LUYUN_APP__.showStep(5));

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
  result.graphNodes = innovation.graphNodes;
  result.passportId = innovation.passportId;
  result.passportSigned = passportVerification.signed;
  result.passportVerificationValid = passportVerification.valid;
  result.proofStatus = proof.status;
  result.analyzerStatus = analyzer.status;
  result.analyzerHighRiskCount = analyzer.highRiskCount;
  result.analyzerSentenceRows = analyzer.sentenceRows;
  result.revisionMode = true;
  result.revisionSaved = revision.saved;
  result.revisionOriginalRetained = revision.originalRetained;
  result.revisionResultRetained = revision.resultRetained;
  result.revisionIssueRows = revision.issues;
  result.splitEntryWidths = splitEntry;
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
  await context.close();
  await browser.close();
}








