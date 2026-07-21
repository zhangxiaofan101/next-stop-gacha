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

> Review baseline: 9322468（`origin/main`），Codex/GPT reviewer，2026-07-21。确认性复核范围 `e7f0a34..9322468`。**F70–F77 均已关闭；当前无 Active findings，六期代码面 gate 通过。**
>
> 独立证据：逐项审阅修复 diff 与新增回归；`bun run verify` 全绿（前端 262/262 + workerd 45/45）；`bun run test:build-assets` 14/14；扩为 12 场景的 `bun run test:visual` 连续三轮 12/12，未再出现字体等待超时。真实 Chromium 重放 F70 原路径：全国池动画进行中关闭 → 仅苏州/南京的对比池重开；旧结果作废后 `scope="对比池 · 共 2 颗"`、蛋堆与揭晓均为空，随后新一轮只落入 `suzhou`。F71 的 OR 组替换 / tags 合并、F72 的 active chip + 徽章 + scope + 单独移除、F74 的完整线路 overland 正向候选、F75 的双皮肤揭晓+蛋堆快照、F76 的南京「苏南」补标与反向抽查、F77 的 44px 热区均有对应实现与守卫测试。
