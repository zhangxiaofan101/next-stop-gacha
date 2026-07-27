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

> Review baseline: `2be0156`（`origin/main`），Codex/GPT reviewer，2026-07-28。审查范围为七期 `b077de4..2be0156`：M78/M79/M81、M70、M22·广州批，以及同期开工/落地的 M74–M77、M82–M84。**当前有 2 个 P2；七期跨家族 review 已执行，但 gate 尚未通过。**
>
> 独立证据：`bun run verify` 全绿（前端 346/346 + workerd 52/52）；`bun run test:build-assets` 24/24；`bun run test:visual` 24/24；`git diff --check b077de4..e92507f` 通过，main↔origin 为 0/0。生产只读核验确认新站 `/` 与 `/sw.js` 均 200 + must-revalidate，旧入口为 200/no-store/noindex 搬家页，旧资产路径保留查询串 308 到新域名。M22·广州批全量结构闸门通过（365/365 视角覆盖，312 城+53 线，守卫零冲突），按 content-checklist 抽查 17 张新增卡及高时效支点：新兴南站/广湛高铁、汕汕高铁接入汕头站、广清城际南延、梧州西江机场航点均有政府/运营方材料支撑，未见明显编造；代表依据：[新兴县政府](https://www.xinxing.gov.cn/gkmlpt/content/1/1973/post_1973128.html)、[交通运输部](https://big5.mot.gov.cn/gate/big5/www.mot.gov.cn/xinwen/jiaotongyaowen/202512/t20251226_4184192.html)、[广州市政府](https://www.gz.gov.cn/zwfw/zxfw/jtfw/content/post_10666883.html)、[梧州西江机场](https://cont.airport.gx.cn/index.php?a=lists&c=index&catid=869&m=content)。

### F92 — P2 — 新 SW 激活会删掉仍被旧页面引用的按需视角文件

M70 的新 worker 在预缓存完成后立即 `skipWaiting()`，激活时删除全部旧 `static-*` cache 并 `clients.claim()`；但已经打开的旧页面不会随之重载，它内存里的 `origins.json` 仍保存旧 hash 文件名，而 `fetchView()` 只在用户切换出发地时才按需请求该文件。若部署更新过 `origin-beijing-<hash>.json` / `origin-guangzhou-<hash>.json`，新 worker 接管旧页面后会先删掉旧 cache；用户随后首次切换到该视角，请求旧 hash，当前 ASSETS 部署已无该文件，得到 404，切换失败。也就是说「新版本全部取齐再清老版本」只保证了**新页面**自洽，没有保证被 `clients.claim()` 的旧页面继续自洽。

应让旧 cache 至少存活到旧 clients 消失，或激活后通知/重载旧 clients，再删旧版本；另一条可行路径是不要立即 claim 现有页面。补一个双版本回归：v1 页面持有 v1 origins 索引但尚未 fetch 视角文件 → v2 SW 激活 → v1 页面首次切视角仍成功。相关代码：`tools/sw.template.js` install/activate 与 `src/ui/origin.ts:28-37`。

### F93 — P2 — 搬家认领 `tripStart` 后日期输入框仍显示迁移前的值

`boot()` 在处理 `#m=` 之前先把 `state.tripStart` 写入 `#tripStartInput`；随后 `checkMigrateHash()` 的 adopt 分支虽 `Object.assign(state, p)`、保存并重渲染，但 `render()` / `renderTrip()` 都不会同步这个独立表单控件。于是五字段中的 `tripStart` 实际已迁入 localStorage，界面却仍显示空值或迁移前日期；用户打开行程会误以为日期没搬来，下一次修改还会把已迁日期无声覆盖。这与 M83「五个字段齐全」的验收口径不符，现有纯函数测试只验证 payload，没有覆盖 DOM 落地。

应在 adopt 后显式同步 `tripStartInput.value`（或把该同步收进统一的状态→表单渲染函数），并补 happy-dom/浏览器用例钉住 `#m=` 启动后 state、localStorage、日期输入框三者一致。相关代码：`src/main.ts:43-50`、`src/ui/share.ts:54-73`、`src/ui/events.ts:131-135`。
