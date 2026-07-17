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

> Review baseline: c4e65c1，Codex/GPT reviewer，2026-07-18。确认性复核范围 `7f0d6b1..c4e65c1`，对照 goal/design/state/code，重点复验 F36/F39–F43 与 M37 的 chunk 生成、`loadData()` 顺序、Vite base、Wrangler/Worker 路由和缓存策略。F36/F39–F43 均已按实现与正式环境证据关闭；本轮只留下修复引入的文档漂移 F44。
>
> 独立证据：`python3 tools/build.py` 生成 267 城 + 53 线、8 个 chunk（495KB），重跑后工作树干净；解析 `77b8cfa:index.html` 的旧 `DATA`，与当前 manifest 顺序拼接的 320 条对象内容及顺序完全一致，确认 `Promise.all(manifest.map(...))` + `chunks.flat()` 不受请求完成顺序影响；`bun test tests/` 11/11、`bun run build` 通过，产物引用 `/next-stop-gacha/assets/*`。正式 URL 的 HTML/JS/CSS/manifest/chunk 均 200，hashed JS/CSS/chunk 为 `max-age=31536000, immutable`，HTML/manifest 为 `max-age=0, must-revalidate`，Lab 根 `/` 仍 200。线上真实点击复验中，工具栏“清空筛选”把 `2/320` 恢复为 `320/320`，空态“全部清空重来”把 `0/320` 恢复为 `320/320`；控制台零 error，`confettiCanvas`/`toast` 均存在，未发现同类抽取缺口。

### F44 — [P2] F41 已让 Wrangler 重跑数据构建，但 README 与构建器说明仍声称相反

`wrangler.jsonc` 现已执行 `python3 tools/build.py && bun install && bun run build`，正式 Cloudflare 构建也已证明 Python 阶段成功；但 `README.md` 的数据更新说明仍写“Cloudflare 构建侧只跑前端构建，不重新执行这个脚本”，部署段仍把命令写成 `bun install && bun run build`，`tools/build.py` 顶部 docstring 也保留“Wrangler 构建只跑 vite build”。这些说明与 F41 修复后的真实数据闸门相反，会误导后续维护者判断部署是否会重新生成/校验 chunk。同步更新三处说明，明确远端会先运行 `tools/build.py`；若仍要求提交 `public/data/*.json`，说明其用途（例如本地静态预览/可审计产物），即可关闭本条。
