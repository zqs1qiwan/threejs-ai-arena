# 四季盆景 · Seasonal Bonsai

- **模型**：Seaglass Alpha（匿名参赛模型）
- **归档目录**：`products/seaglass-alpha/`（目录按模型命名，作品名只出现在文档与画廊页）

纯代码程序化生成的高级实时 3D 视觉**四季盆景**场景。**Vite + Three.js（r187）**。

- **零外部资源**：不使用任何外部图片 / 模型 / 贴图 / HDRI；不使用离线渲染；一切几何、材质、纹理、天空、粒子均程序化生成。
- **实时**：自定义 PBR 着色、程序化天空（太阳/月亮/星辰/云/雾）、阴影、软接触阴影、Bloom/FXAA/Vignette/Grain、自研 ACES + sRGB 色调映射。
- **四季**：春 / 夏 / 秋 / 冬 `SeasonClock` 平滑过渡 + 自动流转 + 速度 + 暂停 + 手动切换；季节调色板、粒子（真花瓣 / 真枫叶 / 六边雪 / 萤火虫）、光照、风。
- **可交互**：拖拽环绕 / 缩放 / 触控；点击盆景风暴 + 抖动；点击花盆回弹；季节 UI；键盘 `1-4` / `Space` / `R` / `A`。
- **自适应**：桌面 + 手机（matchMedia + 动态画质/像素比 + 触控 + CSS + safe-area + reduced-motion）。
- **可上线**：`npm run build` → `dist/`；本仓库已归档构建产物 `dist/`。

## 运行

```bash
npm install
npm run dev      # 开发
npm run build    # 构建 dist/
npm run preview  # 预览构建
```

## 结构

```
src/
  core/      # seasons 调色板、SeasonClock、noise/RNG
  world/     # App、Sky、Ground、Bonsai/TreeBuilder、leaf、Pot、Particles、ContactShadow、wind、materials
  fx/        # PostFX（手动 tonemap + bloom + FXAA + vignette/grain）
  shaders/   # GLSL noise 库
  ui/        # 自适应 UI + CSS
```

## 资产

无外部资产。无离线渲染。

## 质量状态

已做 <50 轮「实现 → 截图 → 视觉评审 → 修弱项 → 再评测」自主循环；`errorCount=0, warnCount=0`；单帧 ~1ms + 高渲染吞吐。
**诚实边界**：高质量风格化实时，**非认证 AAA**；`appInfo.fps>=30` 需在非节流环境复核；真机窄屏 + 触控需在实机验证。
