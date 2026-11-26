import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Engine = require('../shared/generator.js');
const ProofEngine = require('../shared/proof-engine.js');
const ClaimAnalyzer = require('../shared/claim-analyzer.js');
const DraftReviser = require('../shared/draft-reviser.js');
const EvidenceGate = require('../shared/evidence-gate.js');
const CultureDna = require('../shared/culture-dna.js');

const ROOT = path.resolve('.');
const OUTPUT = path.join(ROOT, 'tests', 'artifacts', 'run-case-records.json');
const RUN_AT = '2026-11-26T21:30:00+08:00';
const BRANDS = {
  ruxiang: { name: '鲁香斋（模拟品牌）', type: '山东传统糕点老字号', tone: '真诚、考究、克制' },
  quancheng: { name: '泉城茶食铺（模拟品牌）', type: '济南传统茶食老字号', tone: '清雅、实在、有泉城生活气' },
  yimeng: { name: '沂蒙山果坊（模拟品牌）', type: '沂蒙山区果品加工与老字号品牌', tone: '朴实、清楚、不夸大' },
};
const BASE_MATERIALS_RUXIANG = [
  '品牌档案：鲁香斋始创于1918年。',
  '传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。',
  '品牌资料登记为山东老字号。',
  '产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。',
  '品牌强调保留传统口感并优化含糖量。',
  '品牌传承人表示，年轻化不能改变关键工序，要让年轻人知道每一步为什么这样做。',
].join('\n');
const BASE_MATERIALS_QUANCHENG = [
  '品牌档案：泉城茶食铺始创于1936年。',
  '玫瑰酥制作包含选花、拌馅、开酥、成型和烘烤五道主要工序。',
  '品牌资料登记为济南老字号。',
  '产品包括玫瑰酥、荷叶茶点、泉城八景礼盒和节令茶食礼盒。',
  '品牌强调清雅花香和酥松口感，不添加无法核实的保健说明。',
  '品牌负责人表示，茶食要配得上济南的慢生活，也要让年轻消费者看得懂。',
].join('\n');
const BASE_MATERIALS_YIMENG = [
  '品牌档案：沂蒙山果坊始创于1958年。',
  '山楂片制作包含选果、清洗、切片、低温烘干和分装五道主要工序。',
  '品牌资料登记为临沂老字号。',
  '产品包括山楂片、苹果脆、黄桃干和节令果礼。',
  '品牌强调保留果香，并在合规范围内优化含糖量。',
  '品牌负责人表示，产品首先要把原料和工艺说清楚，不能把普通食品说成保健品。',
].join('\n');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
function nowLabel() { return RUN_AT; }

function confirmSourcedFacts(facts) {
  return (facts || []).map((fact) => {
    if (!fact.sourceExcerpt || /^暂未从资料中提取/.test(fact.text || '')) return fact;
    return Object.assign({}, fact, {
      status: '已确认',
      verificationStatus: '品牌方已确认',
      evidenceLevel: '品牌确认',
      confirmedBy: '演示审核账号',
      confirmedAt: RUN_AT,
      verifiedBy: '演示审核账号',
      verifiedAt: RUN_AT,
      revision: Number(fact.revision || 1) + 1,
      updatedAt: RUN_AT,
    });
  });
}

function publishableText(artifacts) {
  return (artifacts || []).map((artifact) => ProofEngine.stripPolicySections(artifact.content || '')
    .split(/\n+/)
    .filter((line) => !/(不得|不要|避免|禁止|待核实|风险|提示|确认清单|语态转换|改写示例)/.test(line))
    .join('\n')).join('\n\n');
}

function finalizeGate(facts, artifacts, risks, brandRules, brand) {
  const gateArtifacts = (artifacts || []).map((artifact) => Object.assign({}, artifact, { content: publishableText([artifact]) }));
  const cultureDna = CultureDna.build(brand, facts, risks, []);
  const proof = ProofEngine.build(facts, risks, cultureDna);
  proof.validation = ProofEngine.validateArtifacts(gateArtifacts, proof, facts, risks, cultureDna);
  return EvidenceGate.build({
    facts,
    artifacts: gateArtifacts,
    risks,
    proof,
    brandRules: brandRules || { preferredTerms: [], bannedTerms: [] },
    verificationConfigured: false,
  });
}

function generateBase(def) {
  const facts = Engine.extractFacts(def.materials, {
    sourceName: def.sourceName,
    sourceDocument: { id: def.documentId, name: def.documentName, hash: def.documentHash, authority: 'brand' },
  });
  const risks = Engine.detectRisks({
    materials: def.materials,
    constraints: def.constraints,
    theme: def.theme,
    goal: def.goal,
    facts,
  });
  const artifacts = Engine.generateContent({
    brand: def.brand,
    facts,
    risks,
    platform: def.platform,
    contentType: def.contentType,
    audience: def.audience,
    theme: def.theme,
    goal: def.goal,
    constraints: def.constraints,
    promotionMethods: def.methods,
    modelInfo: { model: 'local-rule-engine', promptVersion: Engine.PROMPT_VERSION },
    isDemo: true,
  });
  const roleReviews = Engine.runRoleReview({ facts, risks, theme: def.theme, platformName: def.platformName });
  return { facts, risks, artifacts, roleReviews };
}

function baseInput(def) {
  return {
    brand: def.brand,
    sourceFile: def.documentName,
    sourceHash: def.documentHash,
    materials: def.materials,
    platform: def.platformName,
    contentType: def.contentTypeName || def.contentType,
    audience: def.audience,
    theme: def.theme,
    goal: def.goal,
    constraints: def.constraints,
    promotionMethods: def.methods,
    brandRules: def.brandRules,
  };
}

function typicalCase() {
  const def = {
    id: 'CASE-01', title: '典型案例：鲁香斋小红书品牌内容包', category: '典型场景',
    brand: BRANDS.ruxiang,
    brandRules: { preferredTerms: ['鲁香斋', '枣泥酥'], bannedTerms: ['宫廷御用', '国家级非遗', '降血糖', '最正宗'] },
    sourceName: '鲁香斋品牌档案（模拟）', documentId: 'doc-case-01', documentName: '鲁香斋品牌档案.txt', documentHash: 'a13d5b5e62f6c3b7f6e1d2c1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1',
    materials: `${BASE_MATERIALS_RUXIANG}\n节令礼盒适用于春节、中秋家庭分享和伴手礼场景。`,
    platform: 'xiaohongshu', platformName: '小红书', contentType: 'narrative', contentTypeName: '完整叙事包',
    audience: '25-35岁关注地方文化的城市消费者', theme: '一块枣泥酥里的山东老味道',
    goal: '建立品牌记忆点并形成内容日历', constraints: '不承诺功效；年份只使用档案原文；非遗身份待核实；不要新增资料外事实。',
    methods: ['品牌故事线', '文化知识科普', '场景化种草'],
  };
  const base = generateBase(def);
  const finalArtifacts = clone(base.artifacts);
  const story = finalArtifacts.find((item) => item.id === 'story');
  const before = story.content;
  story.content = before.replace('如果只看“老字号”三个字，很容易把它写成一段听起来很响、却离人很远的历史。', '说到老字号，先别急着讲传奇。先从档案里能核对的那句话看起。');
  story.originalContent = story.originalContent || before;
  story.status = 'edited';
  const confirmedFacts = confirmSourcedFacts(base.facts);
  const artifactRisks = Engine.detectRisks({ materials: publishableText(finalArtifacts), constraints: '', theme: '', goal: '发布前检查', facts: confirmedFacts });
  const gate = finalizeGate(confirmedFacts, finalArtifacts, artifactRisks, def.brandRules, def.brand);
  return {
    id: def.id, title: def.title, category: def.category, runAt: nowLabel(),
    input: baseInput(def),
    process: [
      '登录演示账号，选择“生成文稿”工作线。',
      '录入品牌名称、类型和语气，导入品牌档案，提取历史、工艺、荣誉、产品、品牌理念和访谈洞察事实。',
      '选择小红书、完整叙事包，填写受众、主题、目标和限制条件，并选择品牌故事线、文化知识科普、场景化种草。',
      '提交 content.generate，经 WebSocket 网关检索事实、生成四类成果并执行风险校验。',
      '品牌编辑阅读品牌故事，将开头的“传奇”式表达改为从档案原文起笔。',
    ],
    output: {
      artifactSummary: finalArtifacts.map((item) => ({ id: item.id, title: item.title, status: item.status, factRefs: item.facts || [], content: item.content })),
      keyResult: '输出品牌故事、内容日历、多平台文案和年轻化表达；品牌故事保留 F001、F002 等事实引用。',
    },
    humanReview: {
      reviewer: '演示品牌编辑', action: 'edit', reviewedAt: RUN_AT,
      before: before.slice(0, 220), after: story.content.slice(0, 220),
      note: '将概括性开头改为从可核对档案起笔，保留原事实编号和品牌语气。',
    },
    verification: {
      facts: base.facts.length,
      artifacts: finalArtifacts.length,
      roleReviews: base.roleReviews.length,
      highRiskBeforeEdit: base.risks.filter((item) => item.level === 'high').length,
      artifactRiskCount: artifactRisks.length,
      gateStatus: gate.status,
      gateBlockers: gate.blockers,
      factReferencesPresent: finalArtifacts.every((item) => (item.facts || []).length > 0),
      consistency: '通过：四类成果均生成，人工修改保留原稿和修订稿，证据门禁未出现阻断项。',
    },
  };
}

function complexCase() {
  const def = {
    id: 'CASE-02', title: '复杂输入：泉城茶食铺历史、茶食工艺、节令礼盒与多平台矩阵', category: '复杂输入',
    brand: BRANDS.quancheng,
    brandRules: { preferredTerms: ['泉城茶食铺', '玫瑰酥', '荷叶茶点'], bannedTerms: ['宫廷御用', '国家级非遗', '降血糖', '最正宗'] },
    sourceName: '泉城茶食铺综合档案（模拟）', documentId: 'doc-case-02', documentName: '泉城茶食铺综合资料.txt', documentHash: 'b24e6c6f73a7d4c8a7f2e3d2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2',
    materials: `${BASE_MATERIALS_QUANCHENG}\n节令茶食礼盒适用于春节、中秋家庭分享、节庆走访和企业团购场景。\n线下门店提供礼盒咨询和自提服务，具体供货范围以门店公告为准。\n品牌希望在保留开酥和烘烤工序的基础上，用更清楚的方式向年轻消费者解释茶食与济南生活的关系。`,
    platform: 'matrix', platformName: '多平台矩阵', contentType: 'campaign', contentTypeName: '跨平台传播方案',
    audience: '25-40岁济南及周边城市家庭、节庆采购人群和关注地方文化的消费者', theme: '一盒泉城茶食里的慢生活',
    goal: '同时处理品牌历史、茶食工艺、节令礼盒和多平台传播，形成一条可持续内容线', constraints: '供货范围待确认；不使用未证实的非遗身份；历史年份只使用原文；不同平台保留同一事实编号。',
    methods: ['品牌故事线', '文化知识科普', '场景化种草', '传承人 IP 化', '节点内容日历', '搜索长尾内容'],
  };
  const base = generateBase(def);
  const finalArtifacts = clone(base.artifacts);
  const calendar = finalArtifacts.find((item) => item.id === 'calendar');
  const before = calendar.content;
  calendar.content = `${before}\n\n人工排期补充：第4周增加“泉城八景礼盒与门店茶食体验”内容，供货范围和门店信息标注为待确认。`;
  calendar.originalContent = calendar.originalContent || before;
  calendar.status = 'edited';
  const confirmedFacts = confirmSourcedFacts(base.facts);
  const artifactRisks = Engine.detectRisks({ materials: publishableText(finalArtifacts), constraints: def.constraints, theme: '', goal: '', facts: confirmedFacts });
  const gate = finalizeGate(confirmedFacts, finalArtifacts, artifactRisks, def.brandRules, def.brand);
  return {
    id: def.id, title: def.title, category: def.category, runAt: nowLabel(),
    input: baseInput(def),
    process: [
      '导入综合品牌档案，提取历史、工艺、荣誉、产品、理念和访谈事实。',
      '在多平台矩阵下填写历史、工艺、节令礼盒和传播目标，选择六种宣传方法。',
      '执行 content.generate，形成跨平台内容包并检查供货范围和未证实身份。',
      '品牌编辑在内容日历中补充门店体验安排，同时把供货范围保留为待确认。',
    ],
    output: {
      artifactSummary: finalArtifacts.map((item) => ({ id: item.id, title: item.title, status: item.status, factRefs: item.facts || [], content: item.content })),
      keyResult: '输出多平台叙事包，覆盖历史、工艺、节令礼盒和内容日历；复杂传播要求均进入成果结构。',
    },
    humanReview: {
      reviewer: '演示内容负责人', action: 'edit', reviewedAt: RUN_AT,
      before: before.slice(-260), after: calendar.content.slice(-360),
      note: '人工补充泉城八景礼盒与门店茶食体验排期；供货范围没有转为确定事实，保持待确认。',
    },
    verification: {
      facts: base.facts.length,
      artifacts: finalArtifacts.length,
      roleReviews: base.roleReviews.length,
      highRiskBeforeEdit: base.risks.filter((item) => item.level === 'high').length,
      artifactRiskCount: artifactRisks.length,
      gateStatus: gate.status,
      gateBlockers: gate.blockers,
      factReferencesPresent: finalArtifacts.every((item) => (item.facts || []).length > 0),
      consistency: '通过：四类成果均生成，多平台与节令礼盒要求均进入输出，待确认供货范围未被写成事实。',
    },
  };
}

function boundaryCase() {
  const brand = BRANDS.yimeng;
  const rawBoundary = '沂蒙山果坊的山楂片是宫廷御用果品，制作技艺是国家级非遗，吃了可以降血糖，是全国最正宗的老字号。';
  const brandRules = { preferredTerms: ['沂蒙山果坊', '山楂片'], bannedTerms: ['宫廷御用', '国家级非遗', '降血糖', '最正宗'] };
  const baseFacts = Engine.extractFacts(BASE_MATERIALS_YIMENG, { sourceName: '沂蒙山果坊品牌档案（模拟）', sourceDocument: { id: 'doc-case-03', name: '沂蒙山果坊品牌档案.txt', authority: 'brand' } });
  const rawRisks = Engine.detectRisks({ materials: rawBoundary, constraints: rawBoundary, theme: rawBoundary, goal: '检查边界输入', facts: baseFacts });
  const analysis = ClaimAnalyzer.analyze({ text: rawBoundary, facts: baseFacts, brand, platform: 'matrix' });
  const safe = DraftReviser.revise({ text: rawBoundary, requirements: '删除未经证实的宫廷、非遗和功效表述，保留可核实事实，语气自然克制。', facts: baseFacts, brand, platform: 'matrix' });
  const finalArtifacts = [{ id: 'boundary-copy', title: '边界广告语安全改写', status: 'edited', facts: ['F001'], content: safe.text }];
  const confirmedFacts = confirmSourcedFacts(baseFacts);
  const beforeGate = finalizeGate(confirmedFacts, [{ id: 'boundary-raw', title: '边界输入原文', status: 'blocked', facts: [], content: rawBoundary }], rawRisks, brandRules, brand);
  const afterGate = finalizeGate(confirmedFacts, finalArtifacts, safe.revisedAnalysis.risks, brandRules, brand);
  return {
    id: 'CASE-03', title: '边界输入：沂蒙山果坊未经证实的宫廷、非遗和降血糖表述', category: '边界输入', runAt: nowLabel(),
    input: {
      brand, rawText: rawBoundary,
      constraints: '边界测试：不得把宫廷御用、国家级非遗、降血糖、最正宗写成确定事实。',
      platform: '多平台矩阵', requiredTerms: ['宫廷御用', '国家级非遗', '降血糖', '最正宗'],
    },
    process: [
      '将边界广告语提交 ClaimAnalyzer，执行事实绑定、医疗功效、荣誉真实性、绝对化和文化正统性检查。',
      '逐句标记已阻止、待证明和创作表达，展示原文与风险原因。',
      '由编辑要求删除未经证实的宫廷、非遗和功效表述，并保留可核实事实。',
      '再次运行证据门禁和修订分析，确认高风险表达已隔离。',
    ],
    output: {
      analysis: {
        highRiskCount: analysis.highRiskCount,
        status: analysis.status,
        sentences: analysis.sentences,
        risks: analysis.risks,
        safeRewrite: analysis.safeRewrite,
      },
      finalText: safe.text,
      keyResult: '系统拒绝把“宫廷御用、国家级非遗、降血糖、最正宗”写成确定事实，并输出待核实或安全表达。',
    },
    humanReview: {
      reviewer: '演示品牌审核人', action: 'edit', reviewedAt: RUN_AT,
      before: rawBoundary, after: safe.text,
      note: '删除无法核实的身份与功效承诺，采用“待核实”说明并重新进入审核。',
    },
    verification: {
      highRiskTerms: unique(analysis.risks.filter((item) => item.level === 'high').map((item) => item.term)),
      highRiskCount: analysis.highRiskCount,
      blockedClaims: analysis.proofStats && analysis.proofStats.blocked || 0,
      beforeGateStatus: beforeGate.status,
      beforeGateBlockers: beforeGate.blockers,
      afterGateStatus: afterGate.status,
      afterGateBlockers: afterGate.blockers,
      safeRewriteHighRisk: safe.revisedAnalysis.highRiskCount,
      consistency: '通过：至少识别宫廷御用、国家级非遗、降血糖和最正宗四类高风险；安全改写后未保留原高风险表达。',
    },
  };
}

const cases = [typicalCase(), complexCase(), boundaryCase()];
const payload = {
  title: '老字号叙事工坊完整运行案例记录',
  version: 'v3.8.1',
  generatedAt: RUN_AT,
  environment: '本地确定性引擎与浏览器端到端验收环境；线上服务使用同一共享引擎和证据门禁。',
  cases,
};
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2), 'utf8');
console.log(OUTPUT);
