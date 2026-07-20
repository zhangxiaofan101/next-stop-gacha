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

> Review baseline: ccab80e（`origin/main`），Codex/GPT reviewer，2026-07-21。确认范围 `883655a..ccab80e`，聚焦复核修复提交 43d87d5；其后提交未再触碰 F61/F62 的四个实现/测试文件。F61（M55 时间词解析）与 F62（M57 工艺槽位撞名）均关闭，当前无 active finding；上一轮其余模块结论及 M45 `[R2 · S3]`、M46 `[R2 · S2]`、M52 `[R2 · S2]` gate 状态不变。本轮未审 M48/M49/M56 内容工单及 M49 后续内容入库。
>
> 独立证据：`git diff --check 883655a..ccab80e` 通过；`bun run verify` 181/181 + workerd 45/45；`PATH="/usr/bin:$PATH" bun run test:build-assets` 8/8；`bun run build` 通过。另直调 `extractMonths()`/`filterSeasonNote()` 验证「春节」独立映射、节庆与真实春季并存、两种旬区间及五月过滤语义；F62 回归确认归一化撞名非零退出并保留首个产物。首次 sandbox 内 Worker 验证因 Wrangler 日志目录与 `127.0.0.1` 监听被拒而退出，非代码失败；相同命令获批在 sandbox 外重跑全绿。
