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

> Review baseline: 6c3bce9，Codex/GPT reviewer，2026-07-18。审阅范围 `6142fc3..6c3bce9`，已完整读取四份 `.agent` 控制面并对照 goal/design/state/code，重点审计 M38 对 `092e097:src/main.ts` 的语义迁移、Vitest 断言来源、Preact 推翻与正式生产地址。F44 已关闭：README、`tools/build.py` 与 `wrangler.jsonc` 现已一致声明 Cloudflare 先重跑数据校验/生成再执行前端构建。
>
> 独立证据：逐模块核对 `src/logic/`、`src/ui/`、store/weather 与旧 `main.ts`，过滤、扭蛋、行程/交通/预算、路书、分享/持久化、地图及模板/事件接线未见语义回归；三处声明的必要改写（放宽 action 描述符、天气行注入、chip 点击模拟共用）保持原语义，QR 冻结实现除模块前言/导出与尾部空行外逐字一致。73 个 Vitest 均直接调用生产导出函数，期望值来自既有不变式、录案场景或真实 chunk，未发现复制实现算法来“自证”的断言；Preact 推翻符合用户预留权且当前 UI 无细粒度响应式收益，本轮无异议。`python3 tools/build.py` 幂等生成 267 城 + 53 线、8 chunk（495KB）且工作树零漂移；`bun run typecheck`、Vitest 73/73、Worker 11/11、`bun run build`、Wrangler dry-run 均通过。正式地址真实点击得到初始 `320/320`、江浙沪 `46/320`、搜索成都 `4/320`，成都单站顺游推荐按 56km/128km 排列、乐山插入第 2 站并生成 5 天路书，控制台零 warning/error，测试状态已从 UI 清理；线上 JS/CSS 哈希文件名及 SHA-256 与本地构建逐字节一致。

### F45 — [P1] 73 个决策层 Vitest 没有进入设计声明的部署门禁

`design.md` 明确规定“`tsc --noEmit` 与决策层单测同为构建门禁”，但 `package.json` 的 `build` 目前只有 `tsc --noEmit && vite build`，`test` 只跑 Worker 的 `tests/`，73 个 Vitest 仅由需人工单独调用的 `test:unit` 执行；`wrangler.jsonc` 的生产命令最终也只调用 `bun run build`。因此即使七大决策不变式测试失败，Cloudflare 构建仍会成功部署，S3 迁移新增的核心保护实际上不在门上。请让生产构建路径在 Vite 打包前执行 `vitest run`（可用独立 `verify` 脚本再由 `build` 调用），并保留 `tsc` 门禁；修复后用一个刻意失败的单测确认 `bun run build`/Wrangler custom build 非零退出，再恢复测试，即可关闭。

### F46 — [P2] README 仍把 M38 后架构写成 Preact 与单文件业务逻辑

`README.md` 第 5/53 行仍称依赖栈包含 Preact，第 59 行仍说业务代码集中在 `src/main.ts` 且“M38 前仍是未拆分版本”，本地命令清单也未列出 `bun run test:unit`。这与已落地的零运行时框架、`src/logic/` + `src/ui/` + store/services 分层及 73 测基线相反，会让后续维护者按不存在的框架与入口定位代码，也加剧 F45 的测试入口不可见。同步为当前模块边界并列出两套测试命令即可关闭。
