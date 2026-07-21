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

> Review baseline: e5a6648（`origin/main`），Codex/GPT reviewer，2026-07-21。确认性复核范围 `a00739c..e5a6648`。**F68、F69 均已关闭；当前无 Active findings。**
>
> F68：`tests/build-py-guards.test.mjs` 已加入 `test:build-assets`，覆盖真实数据合法通过、`norail`/`slowrail` 同真时非零并定位城市、合法单标仍通过；本轮实跑 14/14。F69：用户终审批准五指山/肇兴 v2 后转入 picked；两张以减纹理、增留白保留独占母题，卡位产物分别为 31,632B、34,830B，均低于 40,960B。282 城全量 `tools/build_illustrations.py` 零违规退出；此前中断残留的烟台/黟县 public 文件已恢复且未进入提交。`git status` 干净，`main...origin/main` 为 0/0。
