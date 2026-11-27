# Three.js AI Arena — 纯代码 3D 场景 AI 同题竞技场

本仓库归档「同一句目标、不同 AI 模型」的 Three.js 实时 3D 视觉作品，包含：

- **检验地址**（线上入口与每个作品的直达地址）
- **各 AI 产出的最终文件**（按模型分目录归档）

---

## 目标（Goal）

> 用 Vite + Three.js 纯代码（禁用任何外部图片/模型/贴图/HDRI 与离线渲染）从零实时创作一个可上线、可交互的高级 3D 视觉四季盆景场景，具体题材、构图与美术风格由你自行决定（方向是"程序化生成、随时间或交互演化、画面丰富、细节精致、审美高级"），并自主循环"实现 → 本地/线上截图与视觉评审 → 针对最弱项修改 → 再评测"，不断打磨到最佳完成度（无控制台报错、无明显穿帮、桌面与手机自适应、UI 可用）。目标质量为尽可能达到3A游戏大作质量（高品质风格化实时场景或写实AAA），循环轮数限制在50轮内必须交付

---

## 检验地址（Live URLs）

展示站已迁至 GitHub Pages，仓库根目录的 `index.html` 就是画廊首页，三份作品由它引导进入：

| 用途 | 地址 |
|------|------|
| 画廊首页（同题·三景 · GALLERY） | https://zqs1qiwan.github.io/threejs-ai-arena/ |
| 01 · DeepSeek V4.1 Flash（四季 · SHIKI BONSAI） | https://zqs1qiwan.github.io/threejs-ai-arena/products/deepseekv4.1flash/ |
| 02 · Hy4 Flash（禅 · ZEN SHIKI） | https://zqs1qiwan.github.io/threejs-ai-arena/products/hy4flash/dist/ |
| 03 · Gemini 4 Hydrogen (Medium)（四季園 · SHIKI-EN） | https://zqs1qiwan.github.io/threejs-ai-arena/products/gemini4hydrogenmedium/dist/ |

> 部署方式：GitHub Pages + GitHub Actions（`.github/workflows/pages.yml`），向 `main` 推送即自动发布。
> 原 Cloudflare Worker 域名 `fancy.laobaitv.net` 仅作历史入口保留，不再作为展示主站。
---

## 作品目录（Products）

| 目录 | 模型 | 作品 | 归档内容 |
|------|------|------|----------|
| [`products/hy4flash/`](products/hy4flash/) | Hy4 Flash | 禅 · ZEN SHIKI | 页面 HTML 与构建产物 |
| [`products/deepseekv4.1flash/`](products/deepseekv4.1flash/) | DeepSeek V4.1 Flash | 四季 · SHIKI BONSAI | 最终构建产物（线上下载还原）与来源说明 |
| [`products/gemini4hydrogenmedium/`](products/gemini4hydrogenmedium/) | Gemini 4 Hydrogen (Medium) | 四季園 · SHIKI-EN | 源码与最终构建产物（`dist/`） |
---

## 维护说明

- 每个作品独立目录，归档最终页面与构建产物，便于比较不同 AI 的最终画面。
- 三个作品的前端构建产物均使用相对路径（`./assets/`），可以直接放在 Pages 子目录下打开，无需路由改写。
- 源码情况不一致：`gemini4hydrogenmedium` 含完整 Vite + TS 源码（`npm i && npm run build` 可重建 `dist/`），`deepseekv4.1flash` 与 `hy4flash` 只有构建产物。
- 画廊预览图为线上页面实机截屏（headless Chrome + CDP），存放在 `assets/preview/`，规格 720×450 JPEG；重新截图后用同名文件覆盖即可。
- 新增作品：产物放入 `products/<slug>/`，在根目录 `index.html` 增加一条作品行，并补一张 `assets/preview/<slug>.jpg`，推送到 `main` 即自动部署。
- 注意 `.gitignore` 忽略 `*.png`，截图请输出为 JPEG 后再提交。
