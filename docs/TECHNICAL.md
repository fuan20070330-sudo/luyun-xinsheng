# 技术说明

## 架构

```text
GitHub Pages 静态前端
  HTML + CSS + 原生 JavaScript
        │
        ├── Node.js WebSocket 网关 /ws
        │       ├── 品牌历史 / 产品资料 / 受访内容入库
        │       ├── 可选远程 AI 适配
        │       └── 本地处理引擎
        │
        └── 网关不可用 ── 浏览器本地处理引擎
```

前后端共用：

- `shared/engine.js`：事实提取、风险与文化校验。
- `shared/generator.js`：品牌故事、内容日历、多平台文案、年轻化表达方案生成。

前端不保存 API Key。远程模型由网关读取 `OPENAI_API_KEY`，优先调用 Responses API；也可配置 `AI_API_URL` 作为 OpenAI 兼容备用接口。配置 `apiBaseUrl` 后，前端通过 HTTP API 使用服务端邮箱账号、云端品牌数据和云端历史。设置 `DATABASE_URL` 后由 PostgreSQLStore 运行；否则使用兼容模式的 JsonStore。生产环境使用 HttpOnly Cookie、CSRF 和限流；Bearer Token 仅用于兼容测试。

## 事实分类

- 历史
- 工艺
- 荣誉
- 人物
- 产品
- 品牌理念
- 访谈洞察

每条事实保存 `Fxxx` 编号、分类、原文来源、提取置信度、来源权威度、核验状态、确认人和冲突状态。提取置信度不等于事实已核验。

## 账号与历史记录

账号使用邮箱注册和邮箱密码登录，不发送短信或邮件验证码。密码通过 Web Crypto 的 PBKDF2-SHA256 加盐哈希后保存在浏览器本地，不保存明文。每个邮箱在 localStorage 中使用 `luyun-narrative-studio-v2:account:<邮箱>` 独立存储，品牌知识库、生成任务、审核记录和生成历史互不共享。每次生成会保存品牌、事实、风险、四类成果、宣传方法、模型信息和提示词版本；点击历史记录可以恢复对应结果继续审核或导出。

## 四类成果

1. 品牌故事：基于历史、工艺、产品和访谈生成可追溯叙事。
2. 内容日历：按四周安排历史、工艺、产品、传承人四条内容线。
3. 多平台文案：适配小红书、抖音、微信公众号并保留统一事实编号。
4. 年轻化表达方案：给出语态转换、内容人设、开场示例和确认清单。

## WebSocket 协议

前端发送：`brand.ingest`、`content.generate`、`review.update`、`state.sync`、`ping`。HTTP API 另提供 `/api/auth/*`、`/api/history`、`/api/brands`、`/api/reviews`、`/api/publish`、`/api/documents/extract`。

服务端发送：`connection.ready`、`brand.ready`、`job.accepted`、`job.progress`、`content.delta`、`job.ready`、`review.saved`、`state.snapshot`、`error`。

消息信封：

```json
{
  "event": "content.generate",
  "requestId": "content-generate-abc123",
  "protocol": "luyun-gateway/2.0",
  "payload": {}
}
```

## 风险规则

- 医疗功效：降血糖、治疗、疗效、防癌等。
- 非遗及荣誉真实性：国家级非遗、中华老字号、宫廷御用等。
- 绝对化宣传：全国第一、行业唯一、零添加等。
- 文化正统性：最正宗、唯一正统、祖传秘制、失传技艺等。
- 无依据年份：资料年份无法在事实库中找到来源。
- 无法验证工艺：古法秘制、独家秘方、纯手工等。
- 营养健康表述：低糖、无糖等。

## 降级机制

1. 未配置 `gatewayUrl` 时显示“本地处理”，不尝试连接。
2. 网关连接超时显示“已断开”。
3. 网关请求中断时前端切换本地引擎。
4. 远程模型失败时网关回退本地处理引擎。
5. 两条路径返回相同的数据结构。

## 生产化建议

- 将品牌、任务、AI 原稿和品牌确认稿存入数据库。
- 保存原始文件、页码、证书编号和来源哈希。
- 增加登录、角色权限和多人会签。
- 对非遗名录、老字号名录和检测报告建立权威核验适配器。
- 对远程模型调用增加数据脱敏、预算和审计。

