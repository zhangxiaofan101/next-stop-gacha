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

> Review baseline: a00739c（`origin/main`），Codex/GPT reviewer，2026-07-21。复核范围 `89c7b04..a00739c`（7 个提交），覆盖 F63–F68 修复、M44 八城+剩余 83 城正式入库及并发 A7 控制面记录。**F63–F67 已关闭；当前剩 1 个 P1 + 1 个 P2，不能封板。**
>
> 独立证据：`git diff --check 89c7b04..a00739c`；从 `HEAD` 导出的隔离临时树运行 `/usr/bin/python3 tools/build.py`（282 城+53 线、9 chunk）、`bun run verify`（前端 217/217 + workerd 45/45）、`PATH="/usr/bin:$PATH" bun run test:build-assets`（11/11）、`bun run build` 均通过。F63 双向先渲染后切肤测试有效；F64 的 `groundKm` 覆盖全部 `legInfo()` 返回路径，上海→特克斯钉 165km 接驳代理且预算只用该字段；F65 新文案进入发布 chunk；F66 八城及其后 83 城均已在 `origin/main`；F67 顶部快照已收敛。F68 用临时给 `ejina-huyanglin` 同时加 `norail:true`/`slowrail:true` 独立复测，build 确实非零拒绝。

### F69 — P1 — 282 城全量插画硬闸仍非零，state 的“零违规”证据不成立

在隔离的干净 `HEAD` 树真实运行 `PATH="/usr/bin:$PATH" /usr/bin/python3 tools/build_illustrations.py`，管线明确报告两项违规：`dest-wuzhishan.webp` 在质量下限 q40 仍为 41,572B（40.6KB），`dest-zhaoxing.webp` 为 41,104B（40.1KB），均超过目的地卡位 40KiB（40,960B）硬预算；提交中的 public 产物与本次重生成结果字节一致，故不是环境漂移。`state.md` 却记录“全量插画构建零违规”，与可复现实况矛盾。需要按 M44 B 锁为这两城降纹理/重画，重新转档并证明全量脚本退出码 0。当前主工作树另残留一次被中断的生成结果：`yantai.webp` 57,608B、`yixian.webp` 0B（均未提交、`HEAD` 对象正常）；收尾时应避免误提交，并在完整重跑后恢复干净工作树。

### F68 — P2 — 互斥校验已修，但承诺的自动回归测试仍缺席

`tools/build.py` 的实现已正确拒绝 `norail`/`slowrail` 同真，独立临时数据复测也通过，原功能缺陷关闭；但 `89c7b04` 明确要求的“补最小回归”没有落地，现有 11 个 build-assets 测试也没有运行或覆盖 `tools/build.py`。本轮只留下手工冒烟记录，未来校验条件被误删仍会全绿。请加一个隔离 fixture/临时数据的自动测试，断言冲突时非零且错误信息命中，合法单标仍通过。
