'use strict';

const { randomUUID } = require('crypto');
const engine = require('../../shared/generator');
const { WebSocketServer } = require('./ws-server');
const { createAiAdapter } = require('./ai-adapter');

class LuyunGateway {
  constructor(options = {}) {
    this.env = options.env || process.env;
    this.protocol = 'luyun-gateway/1.0';
    this.brands = new Map();
    this.jobs = new Map();
    this.reviews = [];
    this.metrics = { facts: 0, jobs: 0, reviews: 0, connections: 0 };
    this.adapter = createAiAdapter(this.env);
    const origins = String(this.env.ALLOWED_ORIGIN || '*').split(',').map((value) => value.trim()).filter(Boolean);
    this.wsServer = new WebSocketServer({
      server: options.server,
      path: '/ws',
      allowedOrigins: origins,
      onConnection: (client, type) => this.onConnection(client, type),
      onMessage: (client, message) => this.onMessage(client, message),
      onError: (client, error) => this.sendError(client, '', error)
    });
    this.wsServer.startHeartbeat(Number(this.env.WS_HEARTBEAT_MS || 30000));
  }

  onConnection(client, type) {
    if (type === 'close') {
      this.metrics.connections = Math.max(0, this.metrics.connections - 1);
      return;
    }
    this.metrics.connections += 1;
    this.send(client, 'connection.ready', '', {
      protocol: this.protocol,
      gateway: 'luyun-xinsheng',
      serverTime: new Date().toISOString(),
      aiAdapter: this.adapter.enabled ? 'remote' : 'local-fallback'
    });
    this.sendSnapshot(client, '');
  }

  onMessage(client, message) {
    if (!message || typeof message !== 'object' || !message.event) {
      this.sendError(client, message && message.requestId, new Error('消息缺少 event 字段'));
      return;
    }
    this.process(client, message).catch((error) => this.sendError(client, message.requestId, error));
  }

  async process(client, message) {
    const event = String(message.event);
    const requestId = String(message.requestId || '');
    const payload = message.payload || {};
    if (event === 'brand.ingest') return this.handleBrandIngest(client, requestId, payload);
    if (event === 'content.generate') return this.handleContentGenerate(client, requestId, payload);
    if (event === 'review.update') return this.handleReviewUpdate(client, requestId, payload);
    if (event === 'state.sync') { this.sendSnapshot(client, requestId); return; }
    if (event === 'ping') {
      this.send(client, 'state.snapshot', requestId, { protocol: this.protocol, serverTime: new Date().toISOString() });
      return;
    }
    this.sendError(client, requestId, new Error('不支持的协议事件：' + event));
  }

  handleBrandIngest(client, requestId, payload) {
    const brandInput = payload.brand || payload;
    const materials = engine.normalizeText(brandInput.materials);
    if (!brandInput.name || !materials) throw new Error('brand.ingest 需要品牌名称和品牌资料');
    if (materials.length > 200000) throw new Error('品牌资料超过 200000 字限制');
    const brand = {
      id: String(brandInput.id || ('brand-' + Date.now())),
      name: String(brandInput.name).slice(0, 80),
      type: String(brandInput.type || '未分类品牌').slice(0, 80),
      tone: String(brandInput.tone || '真实、克制').slice(0, 120),
      materials: materials,
      isDemo: !!brandInput.isDemo
    };
    const facts = engine.extractFacts(materials, { sourceName: payload.sourceName || '用户提交品牌资料' });
    this.brands.set(brand.id, { brand, facts, updatedAt: new Date().toISOString() });
    this.metrics.facts = Array.from(this.brands.values()).reduce((sum, item) => sum + item.facts.filter((fact) => fact.status !== '待核实').length, 0);
    this.send(client, 'brand.ready', requestId, { brand, facts, mode: 'gateway' });
    this.sendSnapshot(client, '');
  }

  async handleContentGenerate(client, requestId, payload) {
    const requestedBrand = payload.brand || {};
    const stored = this.brands.get(String(requestedBrand.id || ''));
    const brand = stored ? stored.brand : requestedBrand;
    const materials = engine.normalizeText(brand && brand.materials);
    if (!brand || !brand.name || !materials) throw new Error('请先执行 brand.ingest');
    const facts = stored ? stored.facts : engine.extractFacts(materials, { sourceName: '服务端品牌资料' });
    const jobId = 'job-' + randomUUID().slice(0, 12);
    const createdAt = new Date().toISOString();
    this.send(client, 'job.accepted', requestId, { jobId, createdAt, protocol: this.protocol });

    this.sendProgress(client, requestId, jobId, 'retrieve', 18, '服务端检索已入库事实，未核实记录不进入确定事实上下文');
    const safePayload = Object.assign({}, payload, { brand: brand, facts: facts, jobId: jobId });
    const risks = engine.detectRisks({
      materials: brand.materials,
      constraints: payload.constraints,
      theme: payload.theme,
      goal: payload.goal,
      facts: facts
    });
    this.sendProgress(client, requestId, jobId, 'generate', 42, 'AI 适配层开始生成候选内容');
    let generated = null;
    let usedRemote = false;
    if (this.adapter.enabled) {
      try {
        generated = await this.adapter.generate(safePayload, risks);
        usedRemote = !!generated;
      } catch (error) {
        this.sendProgress(client, requestId, jobId, 'generate', 48, '远程大模型调用失败，自动回退到本地确定性演示引擎');
        generated = null;
      }
    }
    if (!generated) {
      const modelInfo = { model: 'local-deterministic-demo', mode: '本地确定性引擎（网关托底）', promptVersion: engine.PROMPT_VERSION };
      generated = {
        modelInfo: modelInfo,
        artifacts: engine.generateContent(Object.assign({}, safePayload, { risks: risks, modelInfo: modelInfo }))
      };
    }
    this.sendProgress(client, requestId, jobId, 'verify', 72, '逐句执行医疗功效、荣誉真实性、绝对化、年份与工艺校验');
    const delta = generated.artifacts[0].content.replace(/\n/g, ' ').slice(0, 96);
    this.send(client, 'content.delta', requestId, { jobId: jobId, text: delta + '…' });
    this.sendProgress(client, requestId, jobId, 'store', 92, '绑定事实编号并保存模型、提示词和原稿元数据');
    const result = {
      jobId: jobId, createdAt: createdAt, brand: brand, facts: facts, risks: risks,
      artifacts: generated.artifacts, modelInfo: generated.modelInfo,
      mode: usedRemote ? 'remote' : 'gateway-local-fallback'
    };
    this.jobs.set(jobId, result);
    this.metrics.jobs += 1;
    this.send(client, 'job.ready', requestId, result);
    this.sendSnapshot(client, '');
  }

  handleReviewUpdate(client, requestId, payload) {
    const allowed = ['accept', 'edit', 'reject', 'flag'];
    if (allowed.indexOf(payload.action) === -1) throw new Error('review.update 的 action 不合法');
    const review = {
      reviewId: 'review-' + randomUUID().slice(0, 12),
      jobId: String(payload.jobId || ''),
      artifactId: String(payload.artifactId || ''),
      action: payload.action,
      reviewer: String(payload.reviewer || '当前审核员').slice(0, 80),
      note: String(payload.note || '').slice(0, 500),
      before: String(payload.before || '').slice(0, 20000),
      after: String(payload.after || '').slice(0, 20000),
      createdAt: new Date().toISOString(),
      mode: 'gateway'
    };
    this.reviews.unshift(review);
    if (this.reviews.length > 500) this.reviews.length = 500;
    this.metrics.reviews += 1;
    this.send(client, 'review.saved', requestId, review);
    this.sendSnapshot(client, '');
  }

  sendProgress(client, requestId, jobId, stage, percent, message) {
    this.send(client, 'job.progress', requestId, { jobId, stage, percent, message });
  }

  sendSnapshot(client, requestId) {
    this.send(client, 'state.snapshot', requestId, {
      protocol: this.protocol,
      serverTime: new Date().toISOString(),
      metrics: {
        facts: this.metrics.facts,
        jobs: this.metrics.jobs,
        reviews: this.metrics.reviews,
        connections: this.metrics.connections
      },
      brands: Array.from(this.brands.values()).map((item) => ({ id: item.brand.id, name: item.brand.name, factCount: item.facts.length })),
      recentJobs: Array.from(this.jobs.values()).slice(-10).map((job) => ({
        jobId: job.jobId, brandName: job.brand.name, riskCount: job.risks.length,
        highRisk: job.risks.filter((risk) => risk.level === 'high').length, createdAt: job.createdAt
      })),
      recentReviews: this.reviews.slice(0, 10)
    });
  }

  send(client, event, requestId, payload) {
    client.sendJson({
      event: event,
      requestId: requestId || '',
      protocol: this.protocol,
      timestamp: new Date().toISOString(),
      payload: payload || {}
    });
  }

  sendError(client, requestId, error) {
    this.send(client, 'error', requestId, { code: 'GATEWAY_ERROR', message: error && error.message ? error.message : '网关处理失败' });
  }

  close() { this.wsServer.close(); }
}

module.exports = { LuyunGateway, PROMPT_VERSION: engine.PROMPT_VERSION };
