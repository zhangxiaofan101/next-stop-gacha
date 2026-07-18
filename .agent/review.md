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

> Review baseline: 73f8054，Codex/GPT reviewer，2026-07-18。确认性复核范围 `6c3bce9..73f8054`，对照 goal/design/state/code 复验 F45/F46 的实现者处置。F45/F46 均已关闭，M38 跨家族 review gate 正式通过；当前无 Active findings。
>
> 独立证据：`package.json` 现由 `build` 先调用 `verify`，而 `verify` 明确执行 `tsc --noEmit && vitest run`；`bun run verify` 73/73、Worker 请求级测试 11/11、`bun run build` 均通过。Wrangler dry-run 的 custom-build 实际日志显示依次执行 `tools/build.py`、`bun install`、`bun run build`、`tsc --noEmit`、Vitest 73/73、Vite build，确认部署同路径上的门禁不是文案自证；实现者另记录了刻意破坏单测时 build 以 1 退出且 Vite 未执行。正式产物哈希未变化，故无法从外部区分这次 push 是否触发远端重建，但远端若无法运行 Vitest 将直接构建失败并保留旧版本，不会绕过门禁部署。README 已去除 Preact/单文件旧口径，准确列出 `logic/ui/store/services/main` 分层、`verify`/`test:unit`/Worker 两套测试入口及部署失败语义。
