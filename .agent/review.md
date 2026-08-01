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

> Confirmation baseline: `cfe4a35`（`origin/main`），Codex/GPT reviewer，2026-08-01。确认范围为 `2be0156..cfe4a35`，修复落在 `5b5dc84`；其后提交只改 `.agent/design.md` / `.agent/state.md`，未再触碰 F92/F93 相关代码。**当前无 Active findings；F92/F93 确认轮通过，七期 review gate 已通过，M86 可开工。**
>
> 独立证据：F92 的失败路径现为旧 hash 请求失败 → 重取可变 `origins.json` → 仅当文件名变化时按新 hash 重试一次；重试失败或文件名不变均保持原出发地与原数据。F93 的状态→日期输入框同步现收口在 `renderTrip()` 且位于空行程早退之前，adopt 路径保存的 state / localStorage 在打开行程时与表单一致，merge 路径不改本机日期。定向回归 `origin-switch` +2、`trip-start-sync` 3 例均通过（两文件合计 11/11）；`bun run verify` 全绿（前端 351/351 + workerd 52/52）；`bun run test:build-assets` 24/24；`git diff --check 2be0156..5b5dc84` 通过，main↔origin 为 0/0。
