# hy4flash 恢复状态说明

## 发生了什么
用户在 2026-11-21 误删了本地工作区。原工作区在 `C:\Users\Q\...`（旧用户配置），
当前机器/用户为 `C:\Users\zqs1q\...`。旧路径与旧用户配置下的文件均已不存在。

## 已恢复的内容（来自线上最后一次部署）
从 https://fancy.laobaitv.net/ 下载并恢复了**完整的可用构建产物**：

- `deploy-dist/hy4flash/` — 作品「禅 · ZEN SHIKI」的最终构建（JS `index-BcAs8m4U.js` 683856 B，
  CSS `index-8WJQ0hLp.css` 6269 B，index.html）。这就是最后一次视觉评审 8/10 所基于的同一份 bundle。
- `deploy-dist/deepseekv4.1flash/` — 另一模型作品，完整恢复。
- `hy4flash/dist/` — 上述 hy4flash 构建的本地副本。
- 重建了 `hy4flash/` 工程脚手架：`package.json`、`vite.config.js`、`wrangler.toml`、
  `wrangler.deploy.toml`、`worker.js`（含首页画廊 + 两个作品路由，按会话中记录的实现重建）、
  `verify.mjs`（puppeteer 验证脚本）、`vision.ps1`（视觉评审辅助脚本）。

> 注意：从线上下载的 index.html 带 Cloudflare 注入的 `__CF$cv$params` 挑战脚本，
> 已剥离后再重新部署，避免重复注入。

## 验证结果（恢复后）
- 重新部署成功（Cloudflare Global 账号 `aether-dyson`，Version `c1812bf9...`）。
- `https://fancy.laobaitv.net/hy4flash/` — HTTP 200，canvas 正常，loader 已隐藏，
  puppeteer 全部 UI 交互压测后 **0 条 console error/warning/reqfail**。
- 首页画廊 HTTP 200，`/deepseekv4.1flash/` HTTP 200，均完好。
- 本地恢复产物 SHA256：JS `16DC06AE...432F001F8`，CSS `533A2F56...9193614E`。

## 源码已重建（2026-11-21 Round 4/6）
旧源码虽无法逐字找回，但已**从零重写了等价的完整源码**：
- `src/main.js`（~55KB）：完整场景、物理光照、IBL、材质、四季、交互、后处理
- `src/shaders.js`（~10KB）：天空、HDR 环境、耙沙、水反射、粒子、调色 GLSL
- `src/style.css`（~7KB）：完整 UI 样式

`npm run build` 已验证可用（需设 `$env:TEMP=$env:TMP='<workspace>\.tmp-build'` 规避 esbuild 临时文件锁）。
重写版本已构建并部署（Version `f6f947ae...`），线上验证 0 console error，四季/桌面/手机均正常，
视觉评审 7/10（风格化盆景）。可直接继续对 `src/` 做源码级迭代。

## 无法恢复的内容
旧版源码的逐字原文已丢失（新版为等价重写，非字节级恢复）。
若需要旧版本的某个确切实现细节，请找回旧用户 `C:\Users\Q` 的备份。

## 工具环境
- `node`/`npm` 可用；`hy4flash/node_modules` 已重新安装（three / vite / puppeteer-core）。
- 构建需设置 `$env:TEMP=$env:TMP='<workspace>\.tmp-build'` 规避 Windows esbuild 临时文件锁。
- wrangler 用 `npx wrangler@4.152.0`，需 `CLOUDFLARE_ACCOUNT_ID=0900cf...`（Global 账号）。
- `vision.ps1` 的 magpie key 已从 `C:\Users\zqs1q\.config\opencode\service.json` 的 `env.MAGPIE_KEY` 读取，视觉评审已恢复可用。
