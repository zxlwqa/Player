## 前端（Cloudflare Pages）

该目录为基于 Vite + React 的静态前端，可直接部署到 Cloudflare Pages。

### 本地开发
```bash
cd frontend
npm install
npm run dev
```

### 构建
```bash
npm run build
```
产物在 `frontend/dist/`。

### 环境变量
无需配置，前端默认与后端同源通信（与前端页面同域名/端口）。

### Cloudflare Pages 部署
在 Cloudflare Pages 新建项目：
- Build command: `npm run build`
- Build output directory: `dist`
- 环境变量：无需设置。

部署后，前端页面会请求：
- `/api/music/list`
- `/api/delete/music`（POST）
- 直链播放/下载使用 `/music/{文件名}`


