# Three.js AI Arena — 纯代码 3D 场景 AI 同题竞技场

本仓库归档「同一句目标、不同 AI 模型」的 Three.js 实时 3D 视觉作品，包含：

- **检验地址**（线上入口与每个作品的直达地址）
- **各 AI 产出的最终文件**（按模型分目录归档）

---

## 目标（Goal）

> 用 Vite + Three.js 纯代码（禁用任何外部图片/模型/贴图/HDRI 与离线渲染）从零实时创作一个可上线、可交互的高级 3D 视觉四季盆景场景，具体题材、构图与美术风格由你自行决定（方向是"程序化生成、随时间或交互演化、画面丰富、细节精致、审美高级"），并自主循环"实现 → 本地/线上截图与视觉评审 → 针对最弱项修改 → 再评测"，不断打磨到最佳完成度（无控制台报错、无明显穿帮、桌面与手机自适应、UI 可用）。目标质量为尽可能达到3A游戏大作质量（高品质风格化实时场景或写实AAA），循环轮数限制在50轮内必须交付

---

## 检验地址（Live URLs）

| 用途 | 地址 |
|------|------|
| 作品画廊首页（模型作品评测 · MODEL GALLERY） | https://fancy.laobaitv.net/ |
| DeepSeek V4.1 Flash 作品（四季 · SHIKI BONSAI） | https://fancy.laobaitv.net/deepseekv4.1flash/ |
| Hy4 Flash 作品（禅 · ZEN SHIKI） | https://fancy.laobaitv.net/hy4flash/ |
| Gemini 4 Hydrogen (Medium) 作品（四季園 · SHIKI-EN） | 待部署（归档于 `products/gemini4hydrogenmedium/dist/`） |

> 所有作品均为静态前端构建产物
---

## 作品目录（Products）

| 目录 | 模型 | 作品 | 归档内容 |
|------|------|------|----------|
| [`products/hy4flash/`](products/hy4flash/) | Hy4 Flash | 禅 · ZEN SHIKI | 页面 HTML 与构建产物 |
| [`products/deepseekv4.1flash/`](products/deepseekv4.1flash/) | DeepSeek V4.1 Flash | 四季 · SHIKI BONSAI | 最终构建产物（线上下载还原）与来源说明 |
| [`products/gemini4hydrogenmedium/`](products/gemini4hydrogenmedium/) | Gemini 4 Hydrogen (Medium) | 四季園 · SHIKI-EN | 源码与最终构建产物（`dist/`） |
---

## 说明

- 每个作品独立目录，归档最终页面与构建产物，便于比较不同 AI 的最终画面。
- 本仓库仅归档最终成果，不代表任何资产可脱离线上环境单独运行（构建产物需 Worker 路由配合）。
