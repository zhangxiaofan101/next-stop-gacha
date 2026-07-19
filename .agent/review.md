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

> Review baseline: c47f519，Codex/GPT reviewer，2026-07-19。初审范围 `73f8054..a896fda`，本次确认范围 `bed7db1..c47f519`；对照 goal/design/state/code 复核 M41 第二轮响应。F47/F48/F50 已关闭：DO 正常路径的原子限流与并发并集成立，POST-only/state 旧口径也已校正。本轮新增 F51–F53；M41 S3 跨家族 gate 尚未过闸。
>
> 独立证据：`bun run build` 通过（Vitest 7 文件 76/76 + `tsc --noEmit` + Vite）；沙箱外真实 workerd `bun run test` 44/44（Worker 路由 11 + API/DO 33），其中 25 个并发创建恰好 20 成功、同码双 PUT 最终得到完整三项并集；`bun run test:build-assets` 1/1，`bunx wrangler deploy --dry-run` 正确识别两个 SQLite DO、KV 与 ASSETS 四项绑定。Cloudflare 最新文档确认 SQLite DO 可用于 Free plan、同实例存储操作受 input/output gate 保护，官方 TTL 示例也是请求续 `setAlarm()`、alarm 内 `deleteAll()`，故 F47/F48 的机制选择与实现均成立。生产 HTML 引用 `index-DRp_S5m7.js`，下载产物与本地 SHA-256 同为 `824e5b00…46192d`；本轮未向生产 API 写测试数据。

### F51 — [P1] F47/F48 的关键 Worker/DO 回归没有进入任何自动部署门禁

`package.json` 的 `build` 只跑 `verify`，而 `verify` 只执行 `tsc` 和默认 `vitest.config.ts` 圈定的 `src/**/*.test.ts`；Cloudflare 的 build command 又只调用这个 `build`。新写的 44 条 workerd 测试只能由独立的 `bun run test` 执行，仓库也没有 GitHub Actions 或其它 required check。因此本轮本地与生产证据虽然证明当前实现正确，但以后即使 F47 并发计数重新超放、F48 双 PUT 再次丢更新，`bun run build` 仍会全绿并由 main 自动部署。实际运行输出也直接显示 build 只跑 76 条前端测试，44 条 Worker/DO 测试完全未出现。

这是与 F45 同类、且本次直接覆盖 M41 S3 数据完整性的门禁缺口。需建立一个部署前统一验证入口，至少包含 `tsc`、76 条决策层测试和 44 条 workerd Worker/DO 测试，并让 Wrangler/Cloudflare build 调用它；若选择 CI gate 而非 build 内执行，则必须确实阻止未通过检查的 main 部署。`vitest.config.ts` 与 README 仍写旧的 `node:test`/`bun test tests/` 运行方式，也应随测试基建一并校正。`test:build-assets` 是否并入可另定，但 F47/F48 并发回归不能继续只靠实现者手动记得跑。

### F52 — [P2] POST 建码与 PUT 合并使用了不同的 8KB 计量口径

`handleSyncCreate()` 在检查 8KB 时序列化的只有 `{favs,visited}`，随后 `SyncCodeStore.create()` 才加入 `updatedAt` 存储；`merge()` 却把 `{favs,visited,updatedAt}` 整体计入同一个 8KB 上限。于是存在“POST 成功建码，但不增加任何记录的 PUT 永远 413”的合法边界：本轮机械构造的单字符串 payload 原请求为 8154 bytes，加入时间戳后的快照为 8193 bytes，POST 会接受，随后同内容 PUT 会在 DO 内以超限拒绝。

需拍定上限究竟约束用户 payload 还是完整持久化快照，并让 create/merge 共用同一个 canonical size check；若约束 payload，就不应在 merge 单独把服务器时间戳算进去；若约束完整快照，create 也必须在返回 code 前拒绝。补一条刚好低于上限的 POST→PUT 回归，避免两条路径再次漂移。

### F53 — [P2] design/state 的当前口径仍同时声称同步码存于 KV、PUT 是全量覆盖

后端 prose 和架构图已经正确改为“短链 KV、同步码/限流 DO”，但 design.md「信息组织」表的云端中转行仍把“短链 payload / 同步快照”整体写成 Workers KV。state.md 顶部 Status snapshot 及原 M41 落地条目仍写 `/api/sync` 是“PUT 全量覆盖”、复用 `APP_KV` 的 `sync:` 前缀；后面的第二轮响应才另述 DO/服务器并集。state 是当前工作面、design 是单一现在时，不能要求后续会话自行从互斥段落中猜哪条更新。

需把 design 信息表改成短链=KV、同步快照=DO，并把 state 的当前快照与 M41 入口收束到 DO/服务器并集；历史 KV 方案与两轮修复过程已经由 git 和 response 时间线保存，不应继续占用当前事实位置。F50 指出的“同码复活/23 条新增”两处已确实校正，本 finding 只处理本轮迁移新增的控制面漂移。
