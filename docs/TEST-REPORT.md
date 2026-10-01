# 测试报告

测试日期：2026-10-01  
测试环境：Windows、Node.js v24.19.0、Google Chrome 无头模式、GitHub Pages 子路径模拟

## 自动化测试

### 共享引擎与真实 WebSocket 网关

结果：

- 模拟事实：8 条。
- 已验证事实：7 条。
- 访谈洞察：2 条。
- 待核实人物线索：1 条。
- 四类成果：品牌故事、内容日历、多平台文案、年轻化表达方案。
- 内容成果数量：4。
- 边界高风险：识别到 `降血糖`、`国家级非遗`、`宫廷御用`、`最正宗`。
- RFC 6455 帧编码/解码：通过。
- `/healthz`：HTTP 200。
- 真实 `/ws` 握手：通过。
- `brand.ingest` / `brand.ready`：通过。
- `content.generate` / `job.ready`：通过。
- `review.update` / `review.saved`：通过。

### 浏览器端到端

覆盖结果：

- 在线 WebSocket 模式：通过。
- 一键叙事演示：通过。
- 品牌故事案例：4 项成果生成，通过。
- 访谈与节令案例：多平台矩阵任务完成，通过。
- 边界表达：至少识别 3 个必需高风险项，通过。
- 品牌故事出现“发布拦截”，通过。
- 品牌方修改后保存 AI 原稿与品牌确认稿，通过。
- Markdown 品牌确认包导出，通过。
- 390×844 视口：`scrollWidth = 390`、`innerWidth = 390`，无横向滚动。
- 强制网关不可达后显示“已断开”，自动本地演示并完成一键流程，通过。
- 浏览器控制台错误：0。
- 页面脚本错误：0。

验证截图：

- `tests/artifacts/desktop-full.png`
- `tests/artifacts/mobile-full.png`
- `tests/artifacts/fallback-mobile.png`

## GitHub Actions 与公网验证

GitHub Pages 使用 `Deploy GitHub Pages` 工作流，部署方式为 `workflow`。

正式地址：https://fuan20070330-sudo.github.io/luyun-xinsheng/

公网浏览器验证：

- 页面标题：`老字号叙事工坊｜老字号与非遗品牌内容助手`。
- 未配置远程 WSS 时自动进入“本地演示模式”。
- 一键演示生成 4 项成果和 1 条品牌确认记录。
- 移动端无横向滚动。
- 浏览器控制台错误：0。
- 页面脚本错误：0。

## 结论

老字号叙事工坊已完成本地引擎、Node WebSocket 网关、访谈事实、四类叙事成果、风险与文化校验、品牌方确认留痕、Markdown 导出和 GitHub Pages 部署验证。当前正式页面默认使用本地确定性引擎；独立网关部署后修改 `js/config.js` 的 `gatewayUrl` 即可启用实时 WebSocket 链路。