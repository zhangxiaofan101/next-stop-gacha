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

> Review baseline: 7f0d6b1，Codex/GPT reviewer，2026-07-18。审阅范围 `77b8cfa..7f0d6b1`（该范围仅一个 M37 commit），对照 goal/design/state/code，重点核对数据切片、运行时顺序、单文件抽取完整性与 Wrangler/Worker 正式路径。F34/F35/F37/F38 已复核关闭：F34/F35 的代码分支与迁移后浏览器证据一致；F37 的动态口径/构建器代码位置已收敛，`dist/` 与 `/api/*` 接受 implementer 所述“架构级契约”解释；F38 的工单已改为 built-in imagegen 优先且用户职责与当前拍板一致。F36 的非法 R0 与本轮新增拨盘大部已修，但 M32 仍缺完整拨盘，故收窄后保留如下。
>
> 本轮独立证据：`python3 tools/build.py` 为 267 城 + 53 线、8 个 40 条 chunk、495KB，重跑后 `git diff` 干净；解析 `77b8cfa:index.html` 的旧 `DATA` 与 manifest 顺序拼接后的 320 条对象逐字节等价，id 顺序亦完全相同（首卡杭州），故 `Promise.all(manifest.map(...))` + `chunks.flat()` 的顺序保证成立。旧 `<style>` 与 `src/style.css` 完全一致，旧 `CN_MAP` 与 `src/cn-map.ts` 完全一致，去掉 script 后静态 body 的 57 个 id 顺序完全一致，QR+业务脚本除预期的异步加载/`boot()` 改造外逐行一致——未发现第二个“漏抄元素”式文件切片缺口。`bun test tests/` 8/8、`bun run build` 通过；但正式 URL 实测暴露 F39/F40 所述边界语义问题。

### F36 — [P2] M32 已把 R0 修为 R1，但 state 条目仍没有 `→ model · effort`

design/state 的 M32 tag 现已合法为 `[R1 · S1]`，但 Implemented 条目仍只写 `· cc in-session`，没有协议要求的模型与 effort，也没有偏离拨盘的 `(used: …)`。这正是原 F36 要解决的复盘口径，不能只修 R 数字后关闭；补齐实际模型/effort 即可删除本条。M28 二至四轮、M39 样稿、M42/M43 顶层拨盘本轮已复核通过，不再重复追踪。

### F39 — [P0] Vite 产物引用 host-root `/assets/*`，正式入口的 JS/CSS 全部 404

`vite.config.ts` 把默认 `base: "/"` 解释成“Worker 会先剥前缀”，但剥前缀只发生在**服务器收到请求之后**；浏览器先按 `dist/index.html` 里的绝对 URL 发请求。当前产物实际写出 `src="/assets/index-erHNfbjq.js"` 与 `href="/assets/index-BcmHx1jR.css"`，而 `wrangler.jsonc` 只把本 Worker 绑定到 `lab.medspiral.com/next-stop-gacha/*`，所以这两个 host-root 请求根本不会进入该 Worker。

正式环境已坐实：`/next-stop-gacha/` 返回这份新 HTML；`/assets/index-erHNfbjq.js` 与对应 CSS 均 404，而手工补成 `/next-stop-gacha/assets/index-erHNfbjq.js` 则 200 且带 `x-content-owner: next-stop-gacha-repo`。因此线上现在只有静态骨架，无样式、无启动逻辑，M37 的正式路径验收未成立。应把 Vite base 改成相对或正式前缀，让浏览器请求仍落在 `/next-stop-gacha/*`；并加一条从真实 `dist/index.html` 提取 asset URL、经 Worker 路由到 ASSETS 的集成测试。现有测试只手工构造“已经带前缀”的资产 URL，恰好绕过了根因。

### F40 — [P1] classic script 改成 module 后，两个 `onclick="resetFilters()"` 不再能访问模块内函数

静态空态按钮（`index.html`）和 `buildConsole()` 动态生成的“清空筛选”按钮仍使用 inline handler；`resetFilters` 现在定义在 `type="module"` 入口里，不会自动成为 `window` 属性。即使 F39 修好、bundle 成功加载，这两个按钮点击仍会报 `resetFilters is not defined`。这正是逐行抽取无法发现的“脚本执行语义”迁移缺口，并破坏 design 的空池最终兜底。应改为统一的 delegated/addEventListener 绑定（优先），或显式导出到 global；补“制造空池 → 全部清空”和工具行“清空筛选”真实点击回归。

### F41 — [P2] 部署构建不执行校验器，也不检查 `data/` 与已提交 chunk 是否漂移

当前 320 条产物与旧 DATA/源数据确实完全一致；问题在后续提交路径：`wrangler.jsonc` 只跑 `bun install && bun run build`，Vite 会原样复制已提交的 `public/data/`，既不运行 `tools/build.py`，也不比较生成结果。于是改了 `data/*.json` 却漏跑脚本时，Cloudflare 会静默发布旧 chunk；提交了非法数据也不会触发 design 所称的“构建校验闸门”。这使运行时实际真相源变成可漂移的生成副本，而非 design 声明的 `data/`。

应让 deploy/CI 至少有一个确定性 gate：从 `data/` 重新生成后构建，或以 check 模式生成到临时目录并与 `public/data/` 比较，漂移即失败。README 的人工提醒不足以承担 S3 数据完整性不变式。

### F42 — [P2] 固定 chunk 名 + 默认 revalidate 响应没有实现 design 的“代码/数据分别长缓存”

数据文件固定为 `chunk-0.json`…`chunk-7.json`，manifest 也固定名；没有 `_headers`/Worker cache policy。正式响应目前是 `cache-control: public, max-age=0, must-revalidate`，所以并非长缓存；若直接把这些固定名改成长 TTL，下一次数据更新又会让旧客户端长期读到旧 chunk。安全实现需要给 chunk 内容寻址（文件名带 hash/version），manifest 短缓存/重验证，hashed JS/CSS 与 hashed data chunk 才可 immutable 长缓存。否则应修订 design，明确只要求独立重验证而非长缓存。

### F43 — [P2] state 仍称 M37“本地、尚未 push/未触发线上”，已与 git 和生产现实相反

当前 `main` 与 `origin/main` 同在 `7f0d6b1`，正式 URL 也已返回该 commit 的 Vite 产物及同一组 hash 文件名，说明 push 与自动部署均已发生；state snapshot/Verified 仍把生产路径写成未验证，并称三期单文件版在线。这一漂移掩盖了 F39 的线上 outage。处置 F39 时同步改 state：明确已 push、当前生产验证结果及修复后的复验，不要把 `vite preview` 称作正式生产路径验收。
