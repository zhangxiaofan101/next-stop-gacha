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

> Review baseline: 880e51f，Codex/GPT reviewer，2026-07-20。确认范围 `f55b1a0..880e51f`，实际代码响应集中于 30c2cb6；M44/A8 与控制面整理仍不作为本轮关闭依据。F59 的可逆回退、F60 的比例/预算/命名硬失败及其回归测试均成立，已关闭。F58 的 `assetDir` 运行时消费也已修复，但实现与 design 的字体声明契约仍相反，故缩窄后保留为唯一 active finding，并由 P1 降为 P2。M52 gate 维持通过；M45/M46 双 gate 仍须等 F58 的 design↔code 口径收束后关闭。
>
> 独立证据：沙箱外 `bun run build` 通过（TypeScript + 前端 Vitest 133/133 + workerd Worker/DO 45/45 + Vite，共 178 条），`bun run test:build-assets` 5/5，`git diff --check` 通过；沙箱内首次失败仍仅为 Wrangler 日志/监听端口 EPERM。生产已加载与本地产物同名的 `index-CtqpeRp5.js` / `index-C-GBXldd.css`，控制台零 error。真实点击复验：山水 mascot 为已加载 640×640 → 切奶油后 img/frame 只隐藏、节点和 `data-illust` 仍在 → 切回山水后 frame/img 均恢复可见、src 回到 `/illustrations/ink/mascot.webp`、naturalWidth=640、无 fallback 残留；F59 关闭。生产首页前六张目的地图均完整加载为 640×427；新增管线测试又分别坐实错误比例拒绝且不产出、q40 仍超预算非零退出、合规 happy path、未知槽位非零退出，F60 关闭。

### F58 — [P2] 字体声明的 design 契约仍与已经拍定的 CSS 唯一真相源相反

`assetDirFor()` 及 `id !== assetDir` 探针已经让静态、详情题头和扭蛋路径真正读取 `SkinDeclaration.assetDir`，这一半修复成立。字体部分则选择了 reviewer 上轮给出的“CSS 是唯一运行时真相”路径：`src/skins/registry.ts:4-11` 明确 `fonts` 不参与任何运行时选择，只是供 drift-pin 核对 CSS 字面量；独立 `rg` 也确认生产代码没有读取 `.fonts`。

但 `.agent/design.md:93` 仍写“字体对/资产目录/装饰开关由渲染路径按当前皮肤声明消费”，组件清单 `:114` 又把字体对列在 `registry.ts` 的皮肤声明里；这与代码注释及真实运行机制直接互斥。state 对 F58 的响应称“过度声明只在代码注释里、design/M46 未过度声明”，遗漏了上述 standing mechanism，因而还不能把声明契约记为收束。按已经实现的路线修改 design：明确字体的运行时选择由 scoped CSS token 驱动，registry `fonts` 只是与 CSS 互钉的静态元数据；或者删除冗余 `fonts` 字段并让测试直接钉 CSS。无需再改运行时代码，但 design 与 state 响应口径一致前，M45/M46 gate 保持开放。
