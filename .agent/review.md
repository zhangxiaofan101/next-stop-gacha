# Review — 下一站，去哪玩

> 本文件由 reviewer（与实现者不同模型家族，默认 Codex/GPT）拥有。发现项在此存活直到被处置：
> ① 代码修复后删除 ② 移入 state.md 成为待办（带署名）③ 升级为 design.md 持久变更 ④ 驳回并留一行理由。

## Reviewer 提示词模板

审阅本仓库最近的变更（`git log` 定位范围），从八个轴逐项检查，发现写入下方 Active findings：

1. **goal ↔ design 对齐**：设计是否偏离 goal.md 的意图与硬约束（单文件/CSP/浅色卡通）？
2. **design ↔ code 对齐**：index.html 实现是否与 design.md 的机制描述一致？
3. **数据完整性**：data/*.json 与补丁是否通过 tools/build.py 校验？枚举、坐标范围、id 唯一性？地名/菜名/酒店有无明显编造？
4. **错误处理**：空筛选结果、空行程、localStorage 损坏、剪贴板失败等边界是否处理？
5. **测试/验证覆盖**：构建脚本校验之外，关键交互（扭蛋、路书装配、顺路排序）有无验证记录？
6. **可维护性**：单文件 JS 是否结构清晰？数据 schema 变更的影响面是否可控？
7. **估算的诚实性**：交通时长/预算是否始终明示为估算？有无伪装精确的文案？
8. **遗漏**：goal 中承诺但未实现、或实现了但 state.md 未记录的内容？

## Active findings

> Review baseline: `cf0c647..075066b`，Codex/GPT reviewer，2026-07-16。本轮覆盖 cc 对 F18/F21/F22 的第二轮 triage：旧 `r:1` payload 已明确降级为合法城市站（`yili:2→5 / bayanbulak:1→2 / kuqa:2`）；独库完整组能启用 `leg`，重排后整组回退城市方案；独库已为 `alt:true`，“避开高海拔”后卡片消失。F18/F21/F22 确认修复并按协议删除。`python3 tools/build.py` 全量通过（248 城 + 37 线），`git diff --check` 通过；本地浏览器回归覆盖完整线路、重排回退、高海拔过滤，运行无 console error。相邻构建闸门发现下述回归。

### F23 — [P1] 新海拔审计的缩进让线路 `days` 可达性校验对全部 37 条线路失效

F22 新增的 `if not d.get("alt")` / 高海拔关键词分支插在线路 schema 校验中间，同时把原 F8 的“每个 `days` 档都必须位于 `[站数, Σ城市上限]`”块缩进到关键词 `if re.search(...)` 里（`tools/build.py:155-166`）。结果 `alt:true` 线路必然跳过，`alt:false` 线路也只有文本命中“达坂/垭口/3000m+”才会校验；当前 37 条线路对该分支的命中数是 **0**，所以构建成功并不代表 F8 不变式仍受保护。例如今后若误把三站且默认 5 天的高海拔线路写成 `days:[2,5]`，“默认合计被 min/max 包住”的前置检查仍会通过，而 2 天少于 3 站、行程单不可达的错误不再被 build 拦下。

建议处置：→ **indentation fix + validator regression**。把 F8 可达性块移回 `len(ok) == len(st)` 的通用线路校验中，与新的非阻塞海拔 warning 平行；用一条 `alt:true` 和一条未命中海拔关键词的 `alt:false` 失败 fixture 断言 build 都会拒绝不可达的 `days` 档，防止再次随新审计分支漂移。
