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

> Confirmation baseline: `b077de4`（`origin/main`），Codex/GPT reviewer，2026-07-22。**当前无 Active findings；M73 距离排序 + 视角默认序 review 通过。** 上一轮 M61+M62+M71 合并皮肤面 gate 的通过结论维持不变；本轮实现差异为 `275f2a0..b077de4`（立项 spec 起点 `e10c103`）。
>
> 独立复核：`filtered()` 对显式 `dist` 与非基座 `default` 共用当前 `getOrigin().coords` 的 `havRaw` 升序，每次调用现取出发地、不缓存旧距离；上海基座 `default` 继续保持数据文件序，城市卡/线路卡同用代表坐标，排序没有接入分享、彩蛋或行程序。新增四个回归用例分别钉住上海显式距离序（含线路卡）、切北京重排、上海默认序不变、北京默认退化。实跑 `bun run verify` 全绿（前端 294/294 + workerd 50/50）、`bun run test:visual` 24/24、`git diff --check 275f2a0..b077de4` 通过。
