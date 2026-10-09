# 老字号叙事工坊

老字号与非遗品牌内容助手。项目面向山东老字号企业、非遗传承人和文创品牌，把品牌历史、产品资料与受访内容整理为可追溯事实，输出品牌故事、内容日历、多平台文案和年轻化表达方案。AI 负责整理和生成初稿，品牌方确认事实、文化内涵和对外表达。

> 当前仓库中的“鲁香斋（模拟品牌）”为虚构原型数据，仅用于产品原型演示，不代表真实品牌事实或商业宣传依据。

## 在线访问

- 仓库：https://github.com/fuan20070330-sudo/luyun-xinsheng
- GitHub Pages：https://fuan20070330-sudo.github.io/luyun-xinsheng/
- Node 后端：https://luyun-xinsheng-gateway.onrender.com
- WebSocket：wss://luyun-xinsheng-gateway.onrender.com/ws
- PostgreSQL：Render Singapore，服务端自动读写正式数据库。
- 正式 GitHub Pages 已配置 Render 后端；若服务端或数据库暂时不可用，前端仍会自动回退到本地处理。

## 核心能力

- 邮箱账号：先注册邮箱并设置密码，再使用邮箱和密码登录；不发送短信或邮件验证码，密码只保存加盐哈希。
- 分页输入：基本信息、品牌资料、受访内容、创作要求、生成结果、品牌确认六个步骤。

- 叙事资料导入：品牌历史、产品资料、受访内容，支持 TXT、Markdown、JSON、CSV 和直接粘贴；配置解析服务后支持 PDF、DOCX、OCR 与音频转写。
- 事实提取：按历史、工艺、荣誉、人物、产品、品牌理念、访谈洞察分类，显示原文来源、置信度和“待核实”状态。
- 多平台生成：小红书、抖音、微信公众号、多平台矩阵。
- 宣传方法参考：品牌故事线、文化知识科普、场景化种草、传承人 IP 化、节点内容日历、用户共创、搜索长尾内容、线上线下联动。
- 四类成果：品牌故事、内容日历、多平台文案、年轻化表达方案，并记录所选宣传方法。
- 风险初筛：医疗功效、绝对化宣传、荣誉真实性、无依据年份、无法验证工艺、营养健康表述。
- 人机协作：AI 整理与生成初稿，品牌方确认事实、文化内涵和对外表达，保留 AI 原稿与品牌确认稿。
- 品牌知识持久化：品牌档案和事实按账号保存在浏览器本地，返回应用后可继续使用。
- 生成历史记录：每次生成任务按账号隔离保存，可查看历史内容、风险、模型、提示词、宣传方法和审核次数。
- 事实版本管理：记录来源位置、版本、确认人和更新时间，可确认或标记待核实。
- 多角色审查：档案员、品牌编辑、平台编辑、文化审查和合规审查分别给出结论。
- 发布效果回流：保存平台、链接、曝光、点赞、收藏和转化数据，用于下一轮内容优化。
- 运行证据：记录模型、提示词版本、事实引用、风险、任务时间、品牌确认人、确认动作与确认时间。
- 自动降级：远程模型失败时由网关回退到本地处理引擎；网关不可达时前端自动切换本地处理。

## 技术架构

```text
GitHub Pages 静态前端
  HTML + CSS + 原生 JavaScript
        │
        ├── WebSocket /ws ── Node.js 网关 ── AI 适配层（可选远程模型）
        │                         │
        │                         └── 共享事实与风险引擎
        │
        └── 网关不可用 ── 浏览器本地确定性引擎
```

前端不包含任何 API Key。远程大模型只能由 Node 网关读取服务端环境变量后调用。无远程模型或调用失败时，网关和浏览器均使用本地处理引擎。

## 本地运行

### 1. 启动 WebSocket 网关

Node.js 18+：

```bash
node server/src/server.js
```

默认地址：

- HTTP 健康检查：`http://localhost:8787/healthz`
- API 健康检查：`http://localhost:8787/api/health`
- WebSocket：`ws://localhost:8787/ws`

可选环境变量：

```bash
PORT=8787
ALLOWED_ORIGIN=https://fuan20070330-sudo.github.io
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6
OPENAI_BASE_URL=https://api.openai.com/v1
AI_API_MODE=responses
AI_MAX_OUTPUT_TOKENS=6000
AI_TIMEOUT_MS=30000
DATA_FILE=./data/luyun-store.json
DOCUMENT_EXTRACTOR_URL=
DOCUMENT_EXTRACTOR_API_KEY=
```

### 2. 启动静态前端

使用任意静态服务器，项目本身无需构建：

```bash
python -m http.server 4173
```

打开 `http://localhost:4173/`。本地页面默认连接 `ws://127.0.0.1:8787/ws`；也可用查询参数临时覆盖：

```text
http://localhost:4173/?gateway=ws%3A%2F%2F127.0.0.1%3A8787%2Fws&api=http%3A%2F%2F127.0.0.1%3A8787
```

## 测试

```bash
npm install
npm test
npm run test:e2e
npm run test:live
npm run check
```

测试覆盖：

- 模拟品牌事实提取和六类事实结构。
- 边界输入的医疗功效、虚假荣誉和绝对化高风险识别。
- 三种内容成果生成与 `[Fxxx]` 事实引用。
- RFC 6455 帧编码/解码。
- 真实 `/ws` 握手、`brand.ingest`、`content.generate`、`review.update`。
- 无头 Chrome 在线全流程和网关断开本地降级。
- 典型案例、复杂输入、边界输入。
- 人工修改保留原稿。
- Markdown 下载。
- 390px 手机无横向滚动。

前端与网关运行本身不需要安装依赖；`npm install` 仅用于安装浏览器端到端验收所需的 Playwright。当前验证结果见 [`docs/TEST-REPORT.md`](docs/TEST-REPORT.md)。`test:live` 直接访问已部署的 GitHub Pages 地址进行公网验收。

## WebSocket 协议

前端发送：`brand.ingest`、`content.generate`、`review.update`、`state.sync`、`ping`。

服务端发送：`connection.ready`、`brand.ready`、`job.accepted`、`job.progress`、`content.delta`、`job.ready`、`review.saved`、`state.snapshot`、`error`。

消息格式：

```json
{
  "event": "content.generate",
  "requestId": "job-abc123",
  "protocol": "luyun-gateway/2.0",
  "payload": {}
}
```

## WebSocket 网关部署

### Docker

```bash
docker build -t luyun-xinsheng-gateway .
docker run --rm -p 8080:8080 \
  -e ALLOWED_ORIGIN=https://fuan20070330-sudo.github.io \
  -e OPENAI_API_KEY=your-server-side-key \
  -e OPENAI_MODEL=gpt-6 \
  luyun-xinsheng-gateway
```

### Render

1. 新建 Blueprint 或 Web Service，选择本仓库。
2. Render 会读取根目录 `render.yaml`。
3. 配置 `OPENAI_API_KEY`、`OPENAI_MODEL` 和 `OPENAI_BASE_URL`。默认使用 Responses API，也可用 `AI_API_URL` 接入兼容接口。
4. 部署完成后确认 `https://<service>.onrender.com/healthz` 返回 `{"ok":true}`。
5. 将 `js/config.js` 中的 `gatewayUrl` 改为 `wss://<service>.onrender.com/ws`。

### Railway

1. 新建项目并连接 GitHub 仓库。
2. Railway 读取 `railway.json`，使用根目录 `Dockerfile`。
3. 设置 `ALLOWED_ORIGIN` 与可选模型环境变量。
4. 在 Public Networking 中生成域名。
5. 将前端配置改为 `wss://<domain>/ws`。

### Fly.io

```bash
fly launch --copy-config --no-deploy
fly secrets set OPENAI_API_KEY=your-server-side-key
fly deploy
```

`fly.toml` 已配置 `internal_port = 8080` 和 HTTPS，前端使用 `wss://<app>.fly.dev/ws`。

## GitHub Pages 部署

项目已包含 `.github/workflows/pages.yml`：

1. 推送到 `main` 分支。
2. GitHub 仓库 `Settings → Pages → Build and deployment` 选择 `GitHub Actions`。
3. 工作流构建静态文件并部署到 `https://fuan20070330-sudo.github.io/luyun-xinsheng/`。
4. 子路径兼容要求已满足：全部静态资源使用相对路径，没有以 `/` 开头的站点根路径。
5. 若要启用实时网关，将 `js/config.js` 的 `gatewayUrl` 改成实际 WSS 地址后重新推送。

## 文件结构

```text
.
├── .github/workflows/pages.yml
├── assets/
│   ├── favicon.svg
│   └── og-cover.svg
├── css/styles.css
├── docs/
│   ├── CASES.md
│   ├── DEPLOYMENT.md
│   ├── MODEL-EVALUATION.md
│   ├── PRODUCT.md
│   ├── PROMPT-CHANGELOG.md
│   ├── PROMOTION-METHODS.md
│   ├── TECHNICAL.md
│   ├── TEST-REPORT.md
│   └── USAGE.md
├── js/
│   ├── app.js
│   ├── api-client.js
│   ├── config.js
│   ├── data.js
│   ├── gateway-client.js
│   └── renderer.js
├── scripts/
│   └── evaluate-model.mjs
├── server/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── ai-adapter.js
│       ├── api.js
│       ├── auth-service.js
│       ├── data-store.js
│       ├── document-service.js
│       ├── http-security.js
│       ├── postgres-store.js
│       ├── rate-limit.js
│       ├── store.js
│       ├── verification-service.js
│       ├── gateway.js
│       ├── server.js
│       ├── ws-frame.js
│       └── ws-server.js
├── shared/
│   ├── engine.js
│   ├── generator.js
│   └── quality.js
├── tests/
│   ├── artifacts/
│   ├── fixtures/
│   │   └── model-eval-cases.json
│   ├── e2e.mjs
│   ├── live-check.mjs
│   └── run-tests.mjs
├── Dockerfile
├── LICENSE
├── fly.toml
├── index.html
├── manifest.webmanifest
├── package.json
├── railway.json
├── render.yaml
├── sw.js
└── README.md
```

## 安全与边界

- 不在前端存放 API Key。
- 网关对 WebSocket Origin 进行白名单校验。
- 品牌资料长度和单条 WebSocket 消息有上限。
- AI 只能引用知识库事实；无来源内容标记“待核实”。
- 高风险内容不得直接发布，必须人工修改和复核。
- “低糖”等营养声称仍需检测报告和适用标准核验。
- 本工具用于内容辅助与合规初筛，不构成法律意见，也不替代品牌方对事实、文化内涵和对外表达的最终确认。

## 许可

代码以 MIT License 发布，模拟品牌与模拟数据仅用于产品原型展示。









