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

> Final confirmation baseline: PR #4 `m22-beijing` head `1858308`，GitHub base `main@8c3916a`，Codex/GPT reviewer，2026-07-22。**F79 与 F87 均已验证关闭并按协议删除**：出发地切换与 `openGacha()` 共用 `invalidateInFlightRoll()`，非 reduced-motion fake-timer 双向回归通过；GitHub 当前为 `MERGEABLE / CLEAN`，verify 与 Workers Builds 均 SUCCESS。终审另发现 F88，故当前仍有 1 个 P2，M22 S3 review gate 尚未通过，PR #4 暂不可合并。
>
> 独立门禁（从 `1858308` 导出的干净提交树）：F79 focused suite 7/7；`bun run verify` 全绿（前端 290/290 + workerd 50/50）；`bun run test:build-assets` 23/23；`python3 tools/build.py` 通过（295 城 + 53 线 = 348 条，9 chunks，零警告）；`bun run test:visual` 24/24；`git diff --check 8c3916a..1858308` 通过。doodle 主页基线在 PR 中仅该一张发生预期更新，实图确认新增页头「上海出发」胶囊且布局正常。此前 F78、F80–F86 的关闭结论维持不变。

### F88 — P2 — 最后一次字体提交误纳入 10 个带 ` 2` 后缀的重复发布数据

`1858308` 除字体 corpus/woff2 外，还新增了 `public/data/chunk-1-e41f41f901 2.json` 至 `chunk-8-ac008cc1c4 2.json`、`origin-beijing-162ab1a000 2.json`、`origins 2.json`。逐对 `cmp` 确认它们与不带 ` 2` 的正规文件完全相同，合计约 580KB；manifest 不引用这些名字，但 Vite 会把 `public/` 原样复制进部署产物，因此它们会成为无用的线上负载与仓库噪音。应从分支删除这 10 个已跟踪副本，仅保留正规 hash 文件；同时留意该 worktree 还有多份未跟踪的同形 `data/src/* 2.*` 云同步副本，修复提交不要再次用宽泛 `git add` 把它们带入。删除后至少重跑 `git diff --check` 与 `bun run test:build-assets`，确认 PR 只剩预期发布文件。
