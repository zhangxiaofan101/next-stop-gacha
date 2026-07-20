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

> Review baseline: 883655a（`origin/main`），Codex/GPT reviewer，2026-07-20。审计范围 `b47a8c8..883655a`，本轮代码模块为 interrupt、M51、M53、M54、M55、M57、M58；按用户指示不审 M48/M49/M56 内容工单，也不把本地仅领先一笔的 M44 图片压缩提交 f5a83fd 纳入代码 gate。上一轮 M45 `[R2 · S3]`、M46 `[R2 · S2]`、M52 `[R2 · S2]` 结论不变；本轮 M51/M53/M54/M58 及两条 interrupt 未发现 active finding，M55/M57 各留一项。
>
> 独立证据：`git diff --check b47a8c8..883655a` 通过；`bun run verify` 179/179 + workerd 45/45；`bun run build` 通过；`bun run test:build-assets` 7/7（本机 Homebrew Python 3.14 动态库被系统签名策略拦截，改用系统 `/usr/bin/python3` 重跑同一测试后全绿，判定为本机环境问题）。另以真实 data 文案直调 `extractMonths()`/`filterSeasonNote()` 复现 F61，并用临时 picked/out 目录和真实 `ink-frame-brush.webp` 复制成两个描述后缀，复现 F62：脚本连续两次写同一个 `frame.webp` 且退出 0。

### [P1] F61 — M55 时间词解析误判“春节”，并漏掉带“上/中/下旬”的跨年区间

`src/logic/roadbook.ts:138-149` 先用裸 `春`/`夏`/`秋`/`冬` 子串匹配季节，再匹配节庆，因此“春节”会同时扩成 `[1,2]` 和春季 `[3,4,5]`；现有测试 `src/logic/__tests__/roadbook.test.ts:159-162` 还把这个错误并集写成期望值，属于从实现复制结论而非独立语义断言。真实 `data/data-f.json:2176` 因而在 5 月仍保留“春节期间阆中过大年”。同时区间正则只接受 `12-2月`，不接受真实数据里的 `12月中旬-3月上旬` / `12月下旬-2月`（`data/data-c.json:1319,1375,2432`）；崇礼 1 月行程会把整条核心雪季提示过滤为空。应先按不重叠词元处理节庆/季节（或屏蔽已命中的“春节”再识别“春”），并把旬修饰纳入跨年区间语法；回归测试须直接用上述真实文案，外部语义期望至少钉住“春节不命中 3-5 月”和“12 月中旬到 3 月上旬包含 1、2 月”。

### [P2] F62 — M57 单例工艺槽位发生归一化碰撞时静默覆盖

`tools/build_illustrations.py:84-96` 允许 texture/frame/divider/placeholder 携带任意描述后缀并归一化为裸槽位名，而 `process_skin_dir()`（`:153-170`）没有跟踪已占用的 `(skin, out_name)`。临时目录中同时放入 `probe-frame-first.webp` 与 `probe-frame-second.webp` 后，脚本两次报告 `OK frame.webp`、最终只留下一个文件且退出码为 0；文件名排序变化即可悄悄改变上线素材。`tests/build-illustrations.test.mjs:91-107` 只覆盖每个单例各一张，未覆盖碰撞。应在编码前拒绝同一皮肤内映射到相同输出名的第二个源文件（并计入 violations 非零退出），补一条双后缀碰撞回归；seal/region/decor 等多实例槽位继续按完整输出名去重即可。
