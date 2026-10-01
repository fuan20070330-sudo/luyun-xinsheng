# 部署说明

## 一、GitHub Pages 静态站点

仓库已包含 `.github/workflows/pages.yml`。工作流在推送到 `main` 后自动部署，也支持手动运行。

### 首次部署

1. 在 GitHub 仓库打开 `Settings`。
2. 进入 `Pages`。
3. 在 `Build and deployment` 中选择 `GitHub Actions`。
4. 打开 `Actions`，确认 `Deploy GitHub Pages` 工作流成功。
5. 访问：

```text
https://fuan20070330-sudo.github.io/luyun-xinsheng/
```

### 子路径要求

- `index.html` 引用：`css/styles.css`、`js/config.js`、`shared/engine.js`。
- 禁止使用 `/css/styles.css` 这类站点根路径。
- 页面内部导航使用 `#` 锚点。
- 文档链接使用仓库相对路径。

### 更新前端

修改静态文件后：

```bash
git add .
git commit -m "update frontend"
git push origin main
```

## 二、WebSocket 网关

网关入口为 `/ws`，健康检查为 `/healthz`。

### 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `PORT` | 否 | 默认 `8787`，容器平台通常注入 `8080` |
| `ALLOWED_ORIGIN` | 建议 | `https://fuan20070330-sudo.github.io` |
| `WS_HEARTBEAT_MS` | 否 | 默认 `30000` |
| `AI_API_URL` | 否 | OpenAI 兼容接口地址 |
| `AI_API_KEY` | 否 | 只配置在后端 |
| `AI_MODEL` | 否 | 默认 `gpt-4.1-mini` |
| `AI_TIMEOUT_MS` | 否 | 默认 `12000` |

### Render 部署

1. Render 新建 Blueprint，选择仓库。
2. 读取 `render.yaml`。
3. 在 Environment 中配置密钥。
4. 部署后访问 `https://<service>.onrender.com/healthz`。
5. 将 `js/config.js` 中 `gatewayUrl` 改为 `wss://<service>.onrender.com/ws`。

### Railway 部署

1. 新建 Project，连接仓库。
2. 读取 `railway.json` 和 `Dockerfile`。
3. 添加环境变量。
4. 生成 Public Domain。
5. 使用 `wss://<domain>/ws`。

### Fly.io 部署

```bash
fly launch --copy-config --no-deploy
fly secrets set ALLOWED_ORIGIN=https://fuan20070330-sudo.github.io
fly secrets set AI_API_KEY=your-key
fly deploy
```

## 三、本地验证

```bash
node server/src/server.js
python -m http.server 4173
```

打开 `http://localhost:4173/`。本地开发时 `js/config.js` 默认使用 `ws://127.0.0.1:8787/ws`。

## 四、部署后检查

- 页面资源返回 200，尤其是 `css/styles.css` 和 `shared/engine.js`。
- 顶部状态由“连接中”变为“已连接”或“已断开”。
- 点击“一键评审演示”后出现 3 项成果。
- 边界案例至少出现 3 个高风险。
- 人工编辑后审核留痕增加。
- Markdown 下载文件名正常。
- 手机宽度 390px 无横向滚动。
- 浏览器控制台无 JavaScript 错误。
