# Review — 下一站，去哪玩

> 本文件由 reviewer（与实现者不同模型家族，默认 Codex/GPT）拥有。发现项在此存活直到被处置：
> ① 代码修复后删除 ② 移入 state.md 成为待办（带署名）③ 升级为 design.md 持久变更 ④ 驳回并留一行理由。

## Reviewer 提示词模板

审阅本仓库最近的变更（git log 定位范围），从八个轴逐项检查，发现写入下方 Active findings：

1. **goal ↔ design 对齐**：设计是否偏离 goal.md 的意图与硬约束（免费额度、后端失效可降级、无账号、浅色手绘）？
2. **design ↔ code 对齐**：当前实现及工程化迁移是否与 design.md 的机制、不变式和模块验收一致？
3. **数据完整性**：data/*.json 与补丁是否通过 tools/build.py 校验？枚举、坐标范围、id 唯一性？地名/菜名/酒店有无明显编造？
4. **错误处理**：空筛选结果、空行程、localStorage 损坏、剪贴板失败等边界是否处理？
5. **测试/验证覆盖**：构建脚本校验之外，关键交互（扭蛋、路书装配、顺路排序）有无验证记录？
6. **可维护性**：展示/决策/数据/边缘层边界是否清晰？schema 与迁移的影响面是否可控？
7. **估算的诚实性**：交通时长/预算是否始终明示为估算？有无伪装精确的文案？
8. **遗漏**：goal 中承诺但未实现、或实现了但 state.md 未记录的内容？

## Active findings

> Review baseline: 533a431，Codex/GPT reviewer，2026-07-20。审阅范围 `9c0a97e..533a431`；按用户指定聚焦 M45 遗留 gate、M46 与 M52，M44/M53–M56 内容轨道及审阅期间新落的 0759070 不在本轮范围。对照 goal/design/state/code 后，M52 的形态 token 化、奶油等价性、`--shadow-card` 的 `initial` + use-site fallback、SVG 图标/印章/`feTurbulence` 边线及 token 双文件漂移钉子均通过；M52 `[R2 · S2]` gate 可关闭。M45/M46 仍有 F58–F60，尤其 state 的 M46 条目所称“assetDir/字体声明均被真实消费、双皮肤全链路可切换”与代码及生产行为不符，因此 M46 gate 与依赖它首次验真的 M45 遗留 gate 均不能关闭。
>
> 独立证据：沙箱外 `bun run build` 通过（TypeScript + 前端 Vitest 11 文件 129/129 + workerd Worker/DO 45/45 + Vite，共 174 条），`bun run test:build-assets` 1/1，`git diff --check` 通过；沙箱内首次失败仍仅为 Wrangler 日志/监听端口 EPERM。生产地址桌面 1280px 与移动端 390×844 实测无横向溢出，奶油/山水的 15px 正文、13px chip、23px 卡片标题及移动端 34px logo 均无明显过小/挤压；山水字体实际加载，题头 2:1、扭蛋与空态 1:1 图片均完整显示。奶油卡片的生产 computed shadow 为地区色 `rgb(205, 233, 255) 6px 7px 0`，确认 M52 引入的回归已由 `initial` + use-site fallback 真正修复；印章、抖动边线和宣纸效果在桌面/移动端均可见。M44 共享目的地图铺量按本轮边界未纳入缺图判定。

### F58 — [P1] M46 没有完成皮肤声明契约的首次验真，M45 遗留 gate 仍然开放

design 要求字体对、`assetDir` 与装饰开关都由当前皮肤声明驱动渲染；当前只有 `decorations` 被 `applySkinVisuals()` 读取。`src/skins/illustrations.ts:10,23-33` 仍直接用 `skinId` 拼 `illustrations/<skinId>/...`，从未读取 `SKINS[].assetDir`；动态题头/详情/扭蛋路径也继续把 `currentSkinId()` 传给同一函数。`fonts` 同样不参与运行时选择，只由 CSS token 决定，registry 测试只是把声明字符串与 `ink.css` 文本互相比对。现有测试又用 `illustSrc("ink", ...)` 断言结果含 `/ink/`，因 `id === assetDir` 而自证成立；即使把声明的 `assetDir` 改成别名目录也不会红。

应让运行路径先解析当前 `SkinDeclaration`，所有静态/动态图片 URL 都使用其 `assetDir`，并增加一个 `id !== assetDir` 的夹具/探针证明声明确实驱动 URL。字体要么同样由声明参与加载/选择，要么先修改 design/registry，明确 CSS 是唯一运行时真相并移除“字段被消费”的错误声明；不能继续把仅做字符串 drift-pin 的元数据记作消费端验真。完成前，state 的 M46 验收结论及由其关闭 M45 gate 的条件都不成立。

### F59 — [P1] 缺图回退会永久删除插画槽位，双皮肤切换无法恢复

奶油皮肤没有 `public/illustrations/cream/` 资产，但 `applySkinVisuals("cream")` 会给 mascot/gacha/empty 等静态槽位写入必然 404 的 URL；`src/skins/illustrations.ts:45-63` 随后把图片或整个 `[data-illust-frame]` 从 DOM 移除，emoji 分支也用不带 `data-illust` 的 `<span>` 永久替换。之后切回山水时，`applySkinVisuals()` 已查询不到原槽位，无法恢复。生产实测从山水首帧开始时 mascot 为已加载的 640×640 图片；山水→奶油后容器消失，再切回山水仍不存在。若先在奶油打开扭蛋或空态，同一不可逆路径也会让它们在后续山水模式继续缺失。当前 happy-dom 测试只在完整 DOM 上连续写 `src`，没有派发 `error`，因此没覆盖真实生命周期。

回退应保留可恢复的槽位和 `data-illust` 元数据（例如隐藏原 img 或在容器内切换 fallback），皮肤变化时清理 `fallbackTried` 并恢复图片；也可让无资产皮肤的声明显式表达 fallback，而不是先请求不存在的目录。补一条“山水加载成功 → 奶油 error/fallback → 山水恢复”的 DOM/浏览器回归，至少覆盖 mascot、gacha、empty。该问题直接违反 M46 的即时双向切换与静态插画同步验收。

### F60 — [P2] 插画构建脚本只打印违规，不会守住画幅和体积契约

`tools/build_illustrations.py:38` 声称按母版实际比例校验，但 `encode()` 在未读取源图尺寸的情况下直接强制 resize；错误比例母版会被拉伸而不是拒绝。最低质量仍超预算时只返回最后产物，调用方打印“超限!”后继续，编码失败、未知命名也只打印/跳过，`main()` 最终仍以 0 退出。当前山水源图与生产图逐张检查均符合 1:1/2:1 且现有画面显示完整，但这只是当前素材恰好正确，不能证明 M46 所称的可复用插画接入管线能防止下一批畸变或超限产物进入发布。

在编码前读取并核对源图比例（允许明确的容差或裁切策略），累计命名、编码、比例及体积违规并非零退出；为错误比例与质量下限后仍超预算各加一条临时目录测试。这样 `bun run test:build-assets`/部署门禁才能真正钉住画布与预算契约，而不是只验证当前 happy path。
