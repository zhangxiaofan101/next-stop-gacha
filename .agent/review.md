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

> Confirmation round TWO baseline: `9db953d`，Codex/GPT reviewer，2026-08-01；确认修复提交 `c65e486`。**F95 已确认并按协议删除。当前无 Active findings，八期 review gate 通过、可封板。**
>
> 独立证据：`clearCmp()` / `clearTrip()` 均先按剩余容量裁快照侧、再完整拼接当前侧，满 6/10 时当前新选择不丢；`toggleTrip()` / `removeRouteFromTrip()` 撤销均以 `< TRIP_MAX` 守门，容量满即跳过恢复。新增两文件定向回归 28/28；另以不落盘 happy-dom 场景验证整条移除后窗口内填满 10 站再撤销仍为 10 站、当前项全保留。`bun run verify` 实跑：lint:agent、tsc、前端 396/396 通过；workerd 在本受限环境因 `127.0.0.1 listen EPERM` 未能启动（非测试断言失败），且 `9db953d..c65e486` 未改后端、workerd 测试、配置或依赖，基线轮已独立确认 workerd 52/52。`src/` 除基线既存且本轮未改的生成 corpus 外不含「灌」；四份 font/corpus Git blob 两端完全相同，零重建；`git diff --check 9db953d..c65e486` 通过；main↔origin 为 0/0。
