# 皮肤视觉回归快照（M66）

Playwright 截图基线：**皮肤 × 关键视图**矩阵（主页 / 详情 / 扭蛋舞台 / 行程 / 路书），改坏任一皮肤
token/资产先于目检报警——皮肤×视图×模块是乘法，目检不可扩展，这是它的机器等价物。spec 见
`.agent/design.md` M66；矩阵定义见 `skins.visual.spec.ts`。

**不进 `bun run verify` 主链**（重、依赖浏览器二进制，见 design M66），本地手动工具，同
`tools/build_illustrations.py`/`tools/build_fonts.py` 的「不进 Cloudflare 远端构建」理由。

## 用法

```bash
bun run test:visual          # 对比既有基线，改动前后都跑一遍确认无意外差异
bun run test:visual:update   # 有意的视觉改动确认后，重拍基线并提交
```

两条命令都会先 `vite build`（测试跑在 `vite preview` 之上，比 `vite dev` 更贴近实际部署产物）。

首次使用需要装 Chromium 二进制（一次性，不进 git）：

```bash
npx playwright install chromium
```

## `test:visual` 报「通过」≠ 基线已跟上改动（F90 教训）

`test:visual:update` 在 `package.json` 里显式带 `--update-snapshots=all`，**不要**改回裸参数
`--update-snapshots`——那是 Playwright 的「changed」模式，凡是 diff 小于 `maxDiffPixelRatio`
（当前 2%）都会被当作「未变化」而拒绝重写，哪怕改动是真实、有意的。M22 合树曾让全部四皮肤
主页的目的地数/出发地胶囊/扭蛋池计数同时变化，但当时的裸参数只重拍了 1 张受影响基线，
其余全部静默留旧；F81 的咔啦贴机器修复同理——真实存在的位移在 1280×900 全视口占比下落在
2% 容忍内，`bun run test:visual` 全程报「通过」，基线其实早已过期。**结论**：`test:visual`
绿灯只能证明「没有超过 2% 阈值的意外差异」，不能证明「基线与当前代码一致」；有意的视觉改动
一律用 `test:visual:update` 强制重拍，重拍后再逐张目检或像素级 diff 确认变化符合预期
（不能只看命令退出码）。

## 基线是怎么保持确定性的（见 `skins.visual.spec.ts` 内联注释）

- **皮肤**：`localStorage` 预置 `nextstop_skin_v1`（`addInitScript`，先于页面脚本生效）。
- **天气**：`api.open-meteo.com` 全部拦截 abort——截图必须是网络无关的确定态，走既有静默降级路径。
- **时钟**：`page.clock.setFixedTime` 冻结到固定时刻——`store.ts` 的 `CUR_SEASON`（决定卡片「当季」
  徽章）与 `roadbook.ts` 渲染时嵌的「生成于 YYYY.M.D」文案都读真实 `new Date()`，不冻结基线会随
  日历天然漂移，把「今天变了」误判成「视觉回归」。
- **弹层背板**：`.overlay` 的 `backdrop-filter:blur(5px)` + `.38` 透明度 tint 在测试环境整体换成
  `--paper` 纯色不透明——GPU 模糊本身跑不出两次逐像素一致的结果，透明度更会让背后页面滚动位置
  （点击「加入行程」「排行程」时对应卡片滚动进视口，落点逐次不同）透出来，两者叠加是截图
  flakiness 的头号来源，与皮肤 token 是否改坏无关，噪声先排除掉。
- **图片**：截图前显式等**当前视口内**的 `<img>` 落定（成功或失败）——`toHaveScreenshot` 的
  「连续两帧一致」判定保证不了图片真的解码完成；范围收窄到视口内是因为主页网格 267+ 城市卡多数
  `loading=lazy` 且在首屏外，等全部 `document.images` 会挂到超时。
- **动画**：`playwright.config.ts` 的 `reducedMotion:'reduce'`（从页面加载起就生效，站点本身的
  `@media(prefers-reduced-motion:reduce)` 全局规则据此关闭动画）+ `expect.toHaveScreenshot.animations
  = 'disabled'`（截图前二次强制）双保险。

## 验收过的场景

故意改坏一处皮肤 token（如 `src/skins/ink.css` 的 `--ink`）、`vite build` 后跑 `test:visual` 能亮红；
改回来再跑能转绿——这是本模块的验收标准，改动 `skins.visual.spec.ts` 后建议照此流程手动复验一次。

## 基线的环境依赖（诚实记录，不是本模块的遗留 bug）

基线截图对 Chromium 版本/操作系统字体渲染敏感，本仓库的基线在本机（macOS/arm64）拍摄。换一台
机器/系统跑 `test:visual` 如果全线报红且 diff 图看起来只是字体亚像素级的模糊差异（不是色板/布局
的实质变化），大概率是环境噪声而非真回归——目检确认后 `test:visual:update` 重拍、提交新基线即可，
同已有的 build_fonts.py/build_illustrations.py 本地工具「换环境重拍」先例。CI 可选 job
（`.github/workflows/visual.yml`）固定跑在 `macos-latest`，与本机同源（Darwin），降低但不消除这层
环境噪声；不作为门禁（不阻塞 merge），红了当提醒去核实，不代表自动判定为回归。
