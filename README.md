# Three.js AI Arena — 纯代码 3D 场景 AI 同题竞技场

本仓库归档「同一句目标、不同 AI 模型」的 Three.js 实时 3D 视觉作品，包含：

- **测试逻辑**（本目标、评测方式、验证脚本）
- **检验地址**（线上入口与每个作品的直达地址）
- **各 AI 产出的最终文件**（按模型分目录归档，源码与构建产物分列）

---

## 目标（Goal）

> 用 Vite + Three.js 纯代码（禁用任何外部图片/模型/贴图/HDRI 与离线渲染）从零实时创作一个可上线、可交互的高级 3D 视觉四季盆景场景，具体题材、构图与美术风格由你自行决定（方向是"程序化生成、随时间或交互演化、画面丰富、细节精致、审美高级"），并自主循环"实现 → 本地/线上截图与视觉评审 → 针对最弱项修改 → 再评测"，不断打磨到最佳完成度（无控制台报错、无明显穿帮、桌面与手机自适应、UI 可用）。

后续追加质量目标：**尽可能达到 3A 游戏大作质量**（受纯程序化 + 浏览器实时 + 无外部资产约束，最终定位为高品质风格化实时场景，而非写实 AAA）。

---

## 检验地址（Live URLs）

| 用途 | 地址 |
|------|------|
| 作品画廊首页（模型作品评测 · MODEL GALLERY） | https://fancy.laobaitv.net/ |
| DeepSeek V4.1 Flash 作品（四季 · SHIKI BONSAI） | https://fancy.laobaitv.net/deepseekv4.1flash/ |
| Hy4 Flash 作品（禅 · ZEN SHIKI） | https://fancy.laobaitv.net/hy4flash/ |
| Hy4 Flash 完整高画质管线（含 GTAO/DOF/Bloom） | https://fancy.laobaitv.net/hy4flash/?hq=1 |
| Hy4 Flash 指定季/时段示例 | https://fancy.laobaitv.net/hy4flash/?season=3&play=1 |

> 所有作品均为静态前端构建产物 + Cloudflare Worker（域名 `fancy.laobaitv.net`，Worker 名 `aether-dyson`）。

---

## 作品目录（Products）

| 目录 | 模型 | 作品 | 归档内容 |
|------|------|------|----------|
| [`products/hy4flash/`](products/hy4flash/) | Hy4 Flash | 禅 · ZEN SHIKI | 完整源码 `src/`、构建产物 `dist/`、Worker、部署配置、最终发布记录 |
| [`products/deepseekv4.1flash/`](products/deepseekv4.1flash/) | DeepSeek V4.1 Flash | 四季 · SHIKI BONSAI | 最终构建产物（线上下载还原）与来源说明 |

---

## 测试逻辑（Testing）

- [`testing/verify.mjs`](testing/verify.mjs) — puppeteer 截图 + 控制台/请求错误捕获脚本（可指定 URL、分辨率、等待时长）
- [`testing/vision.ps1`](testing/vision.ps1) — 视觉评审辅助脚本（magpie vision MCP，需 key）
- [`testing/verification-log.md`](testing/verification-log.md) — 历次验证方法与结果记录（四季 × 时段矩阵、桌面/手机、零报错证据）
- [`testing/review-criteria.md`](testing/review-criteria.md) — 评审维度与真实性说明

运行验证（需本机 Chrome 与 puppeteer-core）：

```bash
node testing/verify.mjs "https://fancy.laobaitv.net/hy4flash/" shot.png 1200 800 7000
```

---

## 说明

- 每个作品独立目录，源码与构建产物分列，便于比较不同 AI 的实现路线与最终画面。
- 验证地址与测试逻辑集中管理，便于复现"线上截图 → 视觉评审"循环。
- 本仓库仅归档最终成果与测试逻辑，不代表任何资产可脱离线上环境单独运行（构建产物需 Worker 路由配合）。
