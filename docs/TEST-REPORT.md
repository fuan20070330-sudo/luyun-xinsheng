# 测试报告

测试日期：2026-10-01  
测试环境：Windows、Node.js v24.19.0、Google Chrome 无头模式、GitHub Pages 子路径模拟

## 自动化测试

### 共享引擎与真实 WebSocket 网关

命令：

```bash
node tests/run-tests.mjs
```

结果：

- 模拟品牌事实：7 条。
- 已验证事实：5 条。
- 人物相关未找到来源：1 条，状态为“待核实”。
- 六类事实结构：全部存在。
- 内容成果：3 项。
- 边界高风险：识别到 `降血糖`、`国家级非遗`、`宫廷御用` 等多个高风险记录。
- RFC 6455 帧编码/解码：通过。
- `/healthz`：HTTP 200。
- 真实 `/ws` 握手：通过。
- `connection.ready`：通过。
- `brand.ingest` / `brand.ready`：通过。
- `content.generate` / `job.ready`：通过。
- `review.update` / `review.saved`：通过。

### 浏览器端到端

命令：

```bash
node tests/e2e.mjs
```

覆盖结果：

- 在线 WebSocket 模式：通过。
- 一键评审演示：通过。
- 典型案例：3 项成果生成，通过。
- 复杂输入：多平台矩阵任务完成，通过。
- 边界输入：至少识别 3 个必需高风险项，通过。
- 主内容出现“发布拦截”，通过。
- 人工编辑后保存 AI 原稿与人工修改稿，通过。
- Markdown 审核包导出，通过。
- 390×844 视口：`scrollWidth = 390`、`innerWidth = 390`，无横向滚动。
- 强制网关不可达后显示“已断开”，自动本地演示并完成一键流程，通过。
- 浏览器控制台错误：0。
- 页面脚本错误：0。

生成的验证截图：

- `tests/artifacts/desktop-full.png`
- `tests/artifacts/mobile-full.png`
- `tests/artifacts/fallback-mobile.png`

## GitHub Actions 部署

工作流：`Deploy GitHub Pages`  
结果：成功  
运行记录：https://github.com/fuan20070330-sudo/luyun-xinsheng/actions/workflows/pages.yml

Pages 构建方式：`workflow`  
正式地址：https://fuan20070330-sudo.github.io/luyun-xinsheng/

## 公网链接验证

命令：

```bash
node tests/live-check.mjs
```

HTTP 资源验证：

- 首页：HTTP 200，`text/html; charset=utf-8`。
- `css/styles.css`：HTTP 200，`text/css; charset=utf-8`。
- `js/app.js`：HTTP 200，`application/javascript; charset=utf-8`。
- `shared/engine.js`：HTTP 200，`application/javascript; charset=utf-8`。
- 7 个前端脚本均为相对路径，可在 `/luyun-xinsheng/` 子路径加载。

真实浏览器验证：

- 页面标题正确。
- 未配置远程 WSS，自动进入“本地演示模式”。
- 一键演示生成 3 个成果。
- 生成 1 条人工审核记录。
- 390px 视口 `scrollWidth = 390`、`innerWidth = 390`。
- 浏览器控制台错误：0。
- 页面脚本错误：0。

## 结论

本地引擎、Node WebSocket 网关、三案例流程、风险拦截、人工审核留痕、Markdown 导出、GitHub Actions 和公开 Pages 地址均已实际验证。当前仓库前端未填写外部 WSS 地址，因此正式页面默认使用本地演示模式；部署独立网关后修改 `js/config.js` 的 `gatewayUrl` 即可启用实时 WebSocket 链路。

