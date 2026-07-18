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

> Review baseline: a896fda，Codex/GPT reviewer，2026-07-19。审阅范围 `73f8054..a896fda`，对照 goal/design/state/code 复核 M40/M41，重点审计 `/api/sync` 的限流、TTL、POST-only 建码与前端并集合并路径。旧 baseline 无未处置 finding，本轮新增 F47–F50；M41 S3 跨家族 gate 尚未过闸。
>
> 独立证据：`bun run build` 通过（Vitest 7 文件 76/76 + `tsc --noEmit` + Vite），`bun test tests/` 34/34（Worker 路由 11 + API 23）；生产 HTML 当场取回的 JS/CSS 哈希名与本地产物 `index-CQNwpyv1.js` / `index-BC-POuMk.css` 一致，新增的短链/同步码 DOM 及旧 `confettiCanvas`/`toast` 均存在，未见同类抽取缺口。`syncNow()` 的数据流只赋值 `state.favs`/`state.visited`；`saveLS()` 对 `cmp`/`trip`/`tripStart` 只序列化原值，故实现者的浏览器不变式证据与本轮静态数据流复核相符。但 API 测试使用即时强一致的 `Map` fakeKV，未覆盖 Workers KV 官方契约中的“同 key 每秒最多 1 次写”、最终一致和并发写 last-write-wins。

### F47 — [P1] GET→PUT 同步流程会连续改写同一 KV 限流 key，限流器在真实 KV 上不成立

`checkRateLimit()` 用 `get(counter) → put(counter+1)` 改写 `ratelimit:<bucket>:<ip>:<day>`；而一次 `syncNow()` 必然先 GET 再紧接着 PUT，两个 handler 又共用 `sync-rw` bucket，所以同一 IP 会在通常不到 1 秒内两次 `put` 同一 counter key。Cloudflare 官方限制是同 key 每秒最多写 1 次；第二次写可失败，目前异常未捕获，会把正常的回传变成 500。本轮用一个按官方限制抛错的 KV fake 重放，结果是 GET 200 后 PUT 直接 throw；现有 `Map` fakeKV 不会暴露它。

同时，这种非原子 read-modify-write 在并发请求下会丢计数，无法实现声称的 20/60 次日限；未知码 PUT 又在限流前先做 KV 读，可无限次穿过这层防滥用。需用能原子序列化计数的机制（如按 IP/bucket 协调的 Durable Object 或等价的 Cloudflare 限流能力），并在昂贵的 KV 存在性读之前执行；回归测试必须模拟同 key 写频限和并发，不能只用无约束 `Map`。参考：https://developers.cloudflare.com/kv/platform/limits/ 。

### F48 — [P1] 客户端“拉取并集后全量 PUT”在并发下会覆盖掉另一台设备的新记录

`syncNow()` 在客户端计算并集，服务端 PUT 却只是全量覆盖。若 A/B 同时拉到旧快照 R，A 写入 `R∪A`、B 写入 `R∪B`，Workers KV 的并发同 key 写是 last-write-wins，最终云端只留其一，并非 `R∪A∪B`。只要被覆盖那台设备之后被清除/丢失，即使它曾收到“已同步” toast，其新增收藏/打卡也不在云端；“localStorage 是真相源”只能在原设备仍存活且再次同步时最终补齐，不能支撑 M41 当前 S3 验收口径。

这不是延长 TTL 或多点几次同步能保证的：KV 读还可在跨 location 情形下落后 60 秒或更久。需把“读现值→并集→写回”放到单一强一致协调者中，或重新设计为不会丢并发更新的存储模型；至少加两个并发客户端的竞态回归，验证最终快照确为全集。参考：https://developers.cloudflare.com/kv/concepts/how-kv-works/ 与 https://developers.cloudflare.com/kv/api/write-key-value-pairs/ 。

### F49 — [P1] 8KB 上限只在 `request.json()` 之后检查投影后的 payload，公网端点仍可缓冲并接受巨大请求

M40/M41 的 POST/PUT 都先 `await request.json()`，再对重新序列化的 `payload` 或 `{favs,visited,updatedAt}` 做 8KB 检查。这不仅在拒绝前已经把整个 body 读入内存并解析；请求还可带一个超大但未被投影进存储结构的额外字段，最后仍被当作小 payload 成功接受。限流又在 JSON/结构/字节检查之后，恶意请求无需消耗限额就可重复占用 Worker 内存/CPU，与“公网后端在免费额度内运行”的约束冲突。

需在解析 JSON 前对原始请求体实施真正的有界读取（`Content-Length` 只能作快速拒绝，无头/chunked 仍要有流式上限），并拒绝不允许的多余字段或按原始字节数计入上限。回归应包含“合法小 marks + 巨大额外字段”和无 `Content-Length` 超限两种情形。

### F50 — [P2] “POST-only 建码”与“过期后同码 PUT 复活”同时被记为已验证，但实现只支持前者

`handleSyncPut()` 明确先 `KV.get(sync:<code>)`，不存在就 404；前端也在 GET 失败后立即 return，根本不会 PUT。因此 400 天 TTL 到期后不能“用同一个码重新 PUT 复活”，`cloudflare/api.mjs` 的注释与 state.md M41 记录都与代码相反。当前绑定过期码的 UI 只给出“不存在或网络异常”，用户必须自己猜到先解绑、再留空生成新码。

建议保留更安全的 POST-only 规则，删除“同码复活”承诺，并让 404 能明确引导用户解绑/生成新码；若确实要保持同码，则必须先设计不会让任意 PUT 退化为建 key 的可验证凭据，不能同时声称两条互斥不变式。另外，state.md 写“新增 23 条同步测试”，实际 `cloudflare-api.test.mjs` 是 M40 已有 11 条 + M41 新增 12 条 = API 总计 23 条；应一并校正验证记录。
