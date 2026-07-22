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

> Confirmation baseline: PR #4 `m22-beijing` head `80f5aeb`，GitHub base `main@8c3916a`，Codex/GPT reviewer，2026-07-22。**F78–F88 已全部验证关闭，当前无 Active findings；M22 S3 review gate 通过，PR #4 可以合并。** GitHub 当前为 `MERGEABLE / CLEAN`，verify 与 Workers Builds 均 SUCCESS。
>
> 独立门禁：`1858308` 的完整 S3 复核维持全绿——F79 focused 7/7、前端 290/290、workerd 50/50、build-assets 23/23、348 条数据构建零警告、visual 24/24。F88 修复 `80f5aeb` 相对该基线只删除 10 个逐字节重复的 `public/data/* 2.json`；`git ls-files` 与 Vite 生产构建的 `dist/data` 均确认同形副本归零，`bun run test:build-assets` 复跑 23/23，`git diff --check 8c3916a..80f5aeb` 通过。doodle 主页基线仍仅含预期的「上海出发」胶囊更新；此前所有内容与机制关闭结论维持不变。
