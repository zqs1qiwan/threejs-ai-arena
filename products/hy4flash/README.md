# Hy4 Flash — 禅 · ZEN SHIKI

- **线上地址**：https://fancy.laobaitv.net/hy4flash/
- **完整高画质**：https://fancy.laobaitv.net/hy4flash/?hq=1
- **题材**：程序化生成的四季枯山水盆景（Vite + Three.js，纯代码，无外部资产）

## 目录说明

| 路径 | 内容 |
|------|------|
| `src/main.js` | 主场景源码（场景、几何、材质、四季/昼夜系统、交互、后处理） |
| `src/shaders.js` | 全部 GLSL（天空、HDR 环境、沙地、水面、叶片、粒子、调色） |
| `src/style.css` | UI 样式 |
| `dist/` | 最终构建产物（发布版 bundle `index-BXie-qOF.js`） |
| `index.html` | 开发入口模板 |
| `verify.mjs` | 验证脚本（见 `testing/`） |
| `worker.js` | Cloudflare Worker（画廊首页 + 作品路由） |
| `wrangler.toml` / `wrangler.deploy.toml` | 部署配置 |

## 主要特性

- 四季流转（春花 / 夏萤 / 秋叶 / 冬雪）与四时段（白昼 / 黄昏 / 夜色 / 拂晓）
- 程序化五裂枫叶 billboard 树冠（alpha-to-coverage 抗锯齿）
- 锦鲤、多层石灯笼、鸟居、接地竹林、柔化石块
- 法线浮雕耙纹沙地、带高光/焦散的水面、远山与大气雾
- PBR + 程序化 IBL、GTAO、DOF、Bloom、MSAA 后处理
- 桌面/手机自适应，完整 UI 与快捷键

## 构建与部署

```bash
npm install
npm run build          # 需要 Node；Windows 如遇 esbuild 临时文件锁，设置 TEMP 到工作区内目录
npx wrangler deploy --config wrangler.deploy.toml
```

> 说明：本目录为最终归档，含完整源码。原始源码曾因本地误删丢失，后从线上构建与会话记录重建，详见 `RECOVERY.md`。
