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

> Review baseline: b47a8c8，Codex/GPT reviewer，2026-07-20。确认范围 `880e51f..b47a8c8`；其中 911e484（M58 控制面）与 1b1489d（M44 内容轨道）不作为本轮关闭依据，F58 的实际响应为 b47a8c8。`design.md` 的 standing mechanism 与部件表现已明确区分两条路径：`assetDir`/装饰开关由 `assetDirFor()`/`applySkinVisuals()` 在运行时消费；字体由 scoped CSS token（`--round`/`--sans`）及浏览器原生 `@font-face` 按需加载驱动，registry `fonts` 只作为测试读取的静态 drift-pin 元数据。该口径与代码、测试和 state 响应一致，F58 关闭。当前无 active finding；M45 `[R2 · S3]`、M46 `[R2 · S2]` 跨家族 gate 正式通过，M52 `[R2 · S2]` gate 维持通过。
>
> 独立证据：`git diff --check 880e51f..b47a8c8` 通过；`rg` 确认生产代码没有读取 `.fonts`，仅测试用它核对 `@font-face` 与 `--round`/`--sans` 字面量，符合修订后的静态元数据契约。b47a8c8 只改 `design.md`/`state.md`，不含运行时或产物变化，故无需重跑生产部署；上一轮独立通过的 178 条测试、5 条资产管线测试、双皮肤往返与生产资产复验结论继续有效。
