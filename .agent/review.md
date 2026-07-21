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

> Review baseline: e7f0a34（`origin/main`），Codex/GPT reviewer，2026-07-21。用户指定提交范围 `d17b3f7..e7f0a34`；因该 gate 点名的 M63/M67/M69 实现提交实际位于起点之前，本轮一并追溯 `80dd555`、`2501b32`、`65fc10e`，覆盖 M63/M64/M66/M67/M68/M69 的现行代码。既有 F68/F69 维持关闭。**当前有 4 个 P1 + 4 个 P2，代码面 gate 未通过。**
>
> 独立证据：`bun run verify`（前端 247/247 + workerd 45/45）；`bun run test:build-assets`（14/14）；`bun run test:visual` 连跑两轮，首轮 `cream-detail` 在 `toHaveScreenshot` 等字体时超时（9/10），次轮 10/10；真实 Chromium 复现异步扭蛋换池后出现 `scope="对比池 · 共 2 颗"` 但堆内落入 `hangzhou`（目标池仅苏州/南京）。真实 53 条线路比对发现 3 段「通用估算判飞、完整线路实际陆路」：G318 川西环线→林芝、阿里南线日喀则→普兰、南疆线塔县→库车。119 条 aka 结构过闸；六分片各抽 3 条未发现编造，另发现苏南覆盖缺口（F76）。首次 sandbox 内 verify/visual 因 Wrangler/Vite 无权绑定 localhost 退出，沙箱外复跑得到上述结果。

### F70 — P1 — 动画中的旧抽取会落进后来切换的对比池

`roll()` 在动画开始时从当时的 `drawablePool()` 选定 `pick`，约 2 秒后 `settle()` 才入堆；这段时间 overlay 可关闭，`openGacha(newPool)` 又会立即改写全局 `cmpPoolOverride`，却没有取消/结算旧 roll 或用 generation token 拒绝过期结果。真实浏览器固定随机数复现：全国池开始扭杭州 → 立刻关弹层 → 从仅含苏州/南京的对比池重开；最终界面声明「对比池 · 共 2 颗」，堆和揭晓却是杭州，直接违反 M53 覆盖池与 M63「排除叠加于当前池」语义。现有测试全部把 `prefers-reduced-motion` 设为 true，roll 同步结束，恰好绕过此竞态。应在切池/重开时取消或先结算在飞 roll（或给 roll 捕获池世代并丢弃过期 settle），并补非 reduced-motion/fake-timer 回归。

### F71 — P1 — 概念词 merge 到 OR 组时不能保证用户刚请求的语义

`applyIntentAction(setGroup)` 对所有组统一 `.add()`；但 season/companions 是 OR 组。已有「冬」时搜「避暑」并点「按筛选看」得到 `{冬, 夏}`，冬季-only 卡仍保留；已有「独行」时搜「亲子」得到 `{独行, 带娃}`，只适合独行的卡也仍可命中。按钮承诺的是按刚输入的概念筛选，结果却可能因旧选择被扩大，和 tags 的 AND-merge 效果完全不同。应按组语义决定 replace/merge（至少 OR 偏好组 replace，tags 的 AND 组可 merge），或把交互文案/动作改成明确的「再加一个条件」，并给预置旧值的 season/companions 用例。

### F72 — P1 — `distMode` 应用后成为不可见的幽灵筛选

点「短途/长途」intent 后会清空 `state.q` 与 `#intentBox`，但页面没有任何 active chip；`updateFilterBadge()` 不计 `distMode`，九组 chip 也无它，正常非空结果下只能靠「清空筛选」连同其他条件一起移除。扭蛋池说明 `renderScope()` 同样漏掉它，因此只开短途时会显示「扭蛋池：全国不限」，实际却暗中限制在 500km 内。design 只禁止新增筛选**行**，不等于允许无可见状态。应提供可移除的「短途/长途」active chip（可复用 intent 区）、纳入手机徽章与 gacha scope，并补应用→可见→单独移除→reset 的 UI 回归。

### F73 — P1 — M66 视觉套件仍会在并行字体加载时偶发超时

本轮按仓库命令实跑，第一轮 10 例中 `cream-detail` 在 `toHaveScreenshot` 的「waiting for fonts to load」阶段撞 5 秒 expect timeout，第二轮原样重跑才 10/10；这否定了 state「5+ 轮零 flaky」作为当前 gate 证据。配置 `fullyParallel:true`、一次并发 5 个页面，截图 expect 又沿用 5 秒默认值；现有 `waitForImages()` 没有把字体/截图准备阶段纳入项目自己的稳定等待，而失败日志只够定位到截图阶段，尚不足以断言唯一根因。可选 CI 还是 `continue-on-error`，噪声红灯很容易被长期忽略。应先显式等待 `document.fonts.ready` 并给截图合理 timeout，若仍复现再收窄 workers/并行度定位，再用连续多轮 soak 证明稳定。

### F74 — P2 — 顺路彩蛋没有继承完整线路的 overland 段语义

M67 把字符串判飞改成 `.air` 是正确的，但 `bestInsertion()` 对原行程段仍直接调用 `legInfo(a,b)`，没有 `legEligibleIndices`/线路 transport 上下文。全库对照 `tripLegs()` 后，G318「川西环线→林芝」881km、阿里南线「日喀则→普兰」940km、南疆线「塔县→库车」991km 都被这里判为飞机，实际完整线路按 design 是「包车/自驾」陆路段；于是沿这些长自驾廊道的合法顺路候选会被静默压掉。修复时原段 a→b 应复用真实行程段估算，插入后的 a→c/c→b 仍按各自真实估算守卫，并补至少一条长 overland 线路的正向候选回归（不只断言「不推近沪」的负向安全性）。

### F75 — P2 — 「扭蛋舞台」基线只拍待机态，M63 的主体画面未受快照保护

视觉矩阵的 gacha 用例只打开弹层便截图「？？？ + 待机气泡」；开壳卡、蛋堆、满堆收窄、两套皮肤的小图/emoji 回退都从未进入基线。M66 的排期理由正是 M63 舞台定型后、M61/M62 扩肤前建立机器等价物，当前快照却保护不到这次重做的大部分 DOM/CSS。可在 reduced-motion 下固定 `Math.random` 或直接准备确定数据，连扭 2 颗后再拍一张 reveal+pile 基线；无需把随机结果本身引入噪声。

### F76 — P2 — 119 条 aka 没有编造样本，但区域覆盖存在明显漏标

六分片各抽 3 条（含婺源→徽州、运城→晋南/河东、伊犁→北疆、崇左→桂西南、大理/丽江→滇西北等）与政府/文旅口径相符，未见营销词冒充地理别名（代表依据：[徽州区政府](https://www.ahhz.gov.cn/mlhz/hzwh/hxyj/8596657.html)、[运城市政府](https://www.yuncheng.gov.cn/zjyc_1/fqyc/index.shtml)、[广西国土空间规划](https://www.gxzf.gov.cn/zt/jd/ymsjyhpxgxxpz_192284/zcwj/W020241018647165071378.pdf)、[云南省交通运输厅](https://jtyst.yn.gov.cn/html/2025/xingyexinwen_0218/3133736.html)）；但 `nanjing` 没有 `aka:["苏南"]`，搜索「苏南」只回苏州/无锡/镇江及其周边卡，漏掉[江苏省统计局口径](https://tj.jiangsu.gov.cn/art/2025/3/13/art_85275_11513956.html)明确列入「苏南五市」的南京。这个缺口说明 6 份独立清单虽各自从严，却缺少按 alias 反向看覆盖的一致性收口。至少补南京，并对 50+ 个 aka 做一次「alias→应覆盖的现有卡」反向抽查；不要求穷举，但公认核心成员不能漏。

### F77 — P2 — 对比表新删除按钮只有 20×20px 触达区

M69 的 `.cmp-del` 明确把 width/height 固定为 20px，且没有伪元素外扩热区；对比表本身是手机横向滚动场景，这个新入口不到通用 44px 触达建议的一半，容易误触/点不中。视觉圆钮可维持 20px，但应像既有小图标钮一样把实际 hit area 外扩到至少 44px，并加一个盒尺寸或伪元素守卫测试。
