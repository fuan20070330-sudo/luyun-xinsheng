# 技术说明

## 总体架构

```text
浏览器静态应用
  js/config.js              前端运行配置
  shared/engine.js          事实提取与风险规则
  shared/generator.js       确定性内容生成
  js/gateway-client.js      WebSocket 客户端、超时与降级
  js/app.js                 状态、任务、审核、导出
  js/renderer.js            DOM 渲染
          │
          │ ws:// / wss://
          ▼
Node.js 网关
  server/src/ws-frame.js    RFC 6455 帧实现
  server/src/ws-server.js   握手、心跳、连接管理
  server/src/gateway.js     协议、状态、任务和审核
  server/src/ai-adapter.js  可选 OpenAI 兼容远程模型
          │
          └── 远程模型失败时使用 shared/generator.js
```

## 前端

- 原生 HTML、CSS、JavaScript，无构建和运行时依赖。
- 使用相对路径 `css/styles.css`、`js/config.js`，兼容 `/luyun-xinsheng/` 子路径。
- 移动优先，设置 390px、680px、920px、1180px 响应式断点。
- 页面不使用外部 CDN、字体、图表或埋点脚本。
- 核心逻辑拆分为共享引擎、网关客户端、渲染器和应用状态，避免单文件难以维护。
- 所有内容渲染均经过 HTML 转义。

## WebSocket 协议

### 请求信封

```json
{
  "event": "content.generate",
  "requestId": "content-generate-abc123",
  "protocol": "luyun-gateway/1.0",
  "payload": {}
}
```

### 响应信封

```json
{
  "event": "job.progress",
  "requestId": "content-generate-abc123",
  "protocol": "luyun-gateway/1.0",
  "timestamp": "2026-10-01T12:00:00.000Z",
  "payload": {
    "jobId": "job-abc123",
    "stage": "verify",
    "percent": 72,
    "message": "逐句执行风险校验"
  }
}
```

### 事件

| 方向 | 事件 | 用途 |
|---|---|---|
| 前端 → 网关 | `brand.ingest` | 提交品牌资料并建立事实库 |
| 前端 → 网关 | `content.generate` | 创建内容生成任务 |
| 前端 → 网关 | `review.update` | 接受、修改、驳回或标记内容 |
| 前端 → 网关 | `state.sync` | 请求状态快照 |
| 前端 → 网关 | `ping` | 应用层心跳 |
| 网关 → 前端 | `connection.ready` | 握手完成 |
| 网关 → 前端 | `brand.ready` | 事实提取完成 |
| 网关 → 前端 | `job.accepted` | 任务受理 |
| 网关 → 前端 | `job.progress` | 任务进度 |
| 网关 → 前端 | `content.delta` | 实时内容片段 |
| 网关 → 前端 | `job.ready` | 内容、事实引用与风险列表完成 |
| 网关 → 前端 | `review.saved` | 审核记录已保存 |
| 网关 → 前端 | `state.snapshot` | 当前运行状态 |
| 网关 → 前端 | `error` | 错误信息 |

底层 WebSocket 还使用 RFC 6455 的 `ping`/`pong`/`close` 控制帧检测失活连接。

## 降级策略

1. `js/config.js` 未配置地址时直接进入本地演示。
2. 配置了 `wss://` 但连接失败或超时，客户端标记“已断开”。
3. 请求网关时若连接中断，捕获异常并切换到浏览器确定性引擎。
4. 网关收到 `content.generate` 后，如果配置了远程模型但调用失败，发送进度说明并回退到共享确定性引擎。
5. 无论哪条路径，返回的数据结构保持一致。

## 事实与风险引擎

事实提取按句子分类并生成 `F001` 等稳定编号。风险规则包括：

- 医疗功效：`降血糖`、`治疗`、`疗效`、`防癌` 等。
- 荣誉真实性：`国家级非遗`、`中华老字号`、`宫廷御用` 等。
- 绝对化宣传：`全国第一`、`行业唯一`、`绝对安全`、`零添加` 等。
- 无依据年份：资料中的四位数年份若没有对应事实则告警。
- 无法验证工艺：`秘方`、`纯手工`、`古法秘制` 等。
- 营养健康表述：`低糖`、`无糖` 等，提示核对适用标准和检测报告。

## 远程 AI 适配

- 远程接口由后端读取 `AI_API_URL` 和 `AI_API_KEY`。
- 请求采用 OpenAI 兼容的 `/chat/completions` 结构。
- 提示词要求模型只能使用 `facts` 数组来确定事实，并保留 `[Fxxx]` 引用。
- 模型返回必须是 JSON，字段为 `main`、`matrix`、`script`。
- 返回不符合结构、网络超时或 HTTP 非 2xx 时自动回退。
- 前端和仓库中不出现 API Key。

## 生产化建议

当前网关使用内存保存品牌、任务和审核状态，适合比赛演示和单实例部署。正式生产建议：

- 接入 MySQL、PostgreSQL 或向量数据库保存事实库。
- 接入对象存储保存品牌原始资料、原稿和人工稿。
- 对审核人进行登录认证和角色授权。
- 将每条事实的来源文件、页码和哈希写入审计记录。
- 对外部大模型调用增加内容安全、数据脱敏和调用预算控制。
- 为 WebSocket 增加 Redis 广播和全链路追踪。
