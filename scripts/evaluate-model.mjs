import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../shared/generator.js');
const quality = require('../shared/quality.js');
const { createAiAdapter } = require('../server/src/ai-adapter.js');

const root = path.resolve('.');
const casesPath = path.join(root, 'tests', 'fixtures', 'model-eval-cases.json');
const outputPath = path.join(root, 'tests', 'artifacts', 'model-eval-report.json');
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const requireKey = process.argv.includes('--require');
const adapter = createAiAdapter(process.env);

function countCitations(text) { return (String(text || '').match(/\[F\d{3,}\]/g) || []).length; }

async function evaluateCase(testCase) {
  const facts = engine.extractFacts(testCase.materials, { sourceName: testCase.brand.name + '｜模型评测资料', sourceDocument: { authority: 'user', name: '评测资料' } });
  const risks = engine.detectRisks({ materials: testCase.materials, constraints: testCase.constraints, theme: testCase.theme, goal: testCase.goal, facts });
  const payload = {
    brand: Object.assign({}, testCase.brand, { materials: testCase.materials, interviews: '' }),
    facts, risks,
    platform: testCase.platform, platformName: testCase.platformName,
    contentType: testCase.contentType, contentTypeName: testCase.contentTypeName,
    audience: testCase.audience, theme: testCase.theme, goal: testCase.goal,
    constraints: testCase.constraints, promotionMethods: testCase.promotionMethods || [],
    performanceFeedback: [], isDemo: false
  };
  try {
    const generated = await adapter.generate(payload, risks);
    const outputs = generated.artifacts.map((artifact) => artifact.content || '').join('\n');
    const missingFacts = (testCase.requiredFactIds || []).filter((id) => !outputs.includes('[' + id + ']'));
    const forbiddenFound = (testCase.forbiddenTerms || []).filter((term) => outputs.includes(term));
    const citationCount = countCitations(outputs);
    const citationCoverage = generated.artifacts.length ? generated.artifacts.filter((artifact) => /\[F\d{3,}\]/.test(artifact.content || '')).length / generated.artifacts.length : 0;
    const qualityScores = generated.artifacts.map((artifact) => artifact.quality && artifact.quality.score || quality.scoreContent(artifact.content || '', { platform: testCase.platform }).score);
    const qualityScore = Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / Math.max(1, qualityScores.length));
    const riskStatusOk = testCase.expectHighRisk ? generated.artifacts.some((artifact) => artifact.status === 'flagged') : true;
    const passed = missingFacts.length === 0 && forbiddenFound.length === 0 && citationCount >= (testCase.minCitations || 1) && citationCoverage >= 0.5 && riskStatusOk && qualityScore >= 65;
    return { id: testCase.id, name: testCase.name, passed, missingFacts, forbiddenFound, citationCount, citationCoverage: Number(citationCoverage.toFixed(2)), qualityScore, riskStatusOk, artifacts: generated.artifacts.length, modelInfo: generated.modelInfo };
  } catch (error) {
    return { id: testCase.id, name: testCase.name, passed: false, error: error.message };
  }
}

if (!adapter.enabled) {
  const report = { ok: false, skipped: true, reason: 'OPENAI_API_KEY or AI_API_KEY is not configured', model: adapter.model, cases: cases.length, required: requireKey, generatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  process.exit(requireKey ? 1 : 0);
}

const results = [];
for (const testCase of cases) results.push(await evaluateCase(testCase));
const passed = results.filter((result) => result.passed).length;
const report = { ok: passed === results.length, skipped: false, model: adapter.model, mode: adapter.mode, cases: results.length, passed, failed: results.length - passed, averageScore: Number((results.reduce((sum, result) => sum + (result.qualityScore || 0), 0) / Math.max(1, results.length)).toFixed(1)), generatedAt: new Date().toISOString(), results };
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ ok: report.ok, model: report.model, cases: report.cases, passed: report.passed, failed: report.failed, averageScore: report.averageScore, report: path.relative(root, outputPath) }, null, 2));
process.exit(report.ok ? 0 : 1);