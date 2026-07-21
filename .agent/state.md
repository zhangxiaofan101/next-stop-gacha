# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。spec 一律指 design.md，本文件只记时间线，不复述规格。

## 🎯 Status snapshot

**线上**：`lab.medspiral.com/next-stop-gacha/`——Vite+TS 工程化版，282 城 + 53 线（335 条）全链路（筛选/扭蛋/对比/行程/路书/足迹地图/天气）；后端短链分享（KV）+ 同步码云同步（Durable Object）；主题皮肤机制 + 奶油/山水双肤（默认 `ink`）；目的地插画共享集 282/282 全量上线。 [cc]

**封板（2026-07-21）**：三期（M26–M36）、四期（M37–M44，M39 未落地留 P2）、五期（M45–M60）一并封板（见 🪦）。封板核验：codex 复核链收口——89c7b04 曾以 F63–F68 明确阻板，三轮修复/复核后 2ee6223 确认「F68、F69 均已关闭；当前无 Active findings」；封板会话另实跑 `bun run verify` 全绿（217 前端 + 45 workerd，退出码 0）、`git status` 干净、main↔origin 0/0。 [cc]

**六期（进行中，2026-07-21）**：执行顺序 ~~M63 扭蛋连扭备选~~ ✅落地 → ~~M64 机器/咔啦主页显性化~~ ✅落地 → ~~M66 视觉回归网~~ ✅落地 → ~~M68 搜索增强~~ ✅落地 → **代码面 review gate（待办，见 review backlog）** → M61 青花 → M62 doodle → M22 北京首发（见 🔜）；~~M65 协议机械门禁~~ ✅先行落地；~~M67 彩蛋飞行段守卫补漏~~ ✅插队即修（用户报 bug 当日诊断+落地，见 ✅）；~~M69 扭蛋/对比交互修缮批~~ ✅插队即修（用户五项反馈当日落地，见 ✅）；远期方向=M11 海外版（P2，六期之后）。M63 首个落地（扭蛋舞台重做，双皮肤真机复验通过，见 ✅）；A9 doodle 主题层已终审、M62 资产 gating 解除；ink-mascot-cutout-v1 用户终审通过（2026-07-21），随 M64 转档消费并已接入 FAB 趴角 + 舞台操作员（见 ✅）。新编号自 M70 起。 [codex][cc]

## ✅ Implemented

（三期–五期已封板 → 见 🪦 墓碑；M26–M60 全部条目与 Verified 证据明细在 git 历史（至 9298442）；M61–M69 已指配六期，新编号自 M70 起。） [cc]

- **M63 — 扭蛋主舞台重做：连扭备选（蛋堆）[R2 · S2]（used: opus·high，cc 主 session 直落——核心 feature 视觉门槛 + 与用户拍板紧耦合，in-session 合理）**｜舞台（机器 hero + 咔啦操作员气泡）→ 揭晓开壳卡（大票券退役）→ 蛋堆压底（半开蛋壳小卡，SVG + `--cap-*` token 取色）。连扭按 id 排除、上限 CMP_MAX 单点、满堆停旋钮、× 扔回池、整堆拿去对比、机器有蛋堆时收窄、蛋堆扭出第一颗才显、页内会话存续（不进 localStorage）。ink 去装饰 emoji（`.deco-emoji`）/ cream 保留。spec 见 design M63。
  Verified（2026-07-21）：`npm run verify` 全绿（tsc + **223 前端** + **45 workerd**，退出码 0）；gacha 三测迁移不丢断言——compare-pool 保留「对比池覆盖复位」并把结果断言改看开壳卡 `#gReveal`；ticket-eager→reveal 小图 eager；ambience 随大票券退役删除——另新增 `gacha-pile`（排除不重复/容量/toss 恢复/拿去对比/清空/跨 open 存续，6 例）、`gacha-reveal`（开壳卡信息+eager+无 `#gachaTicket`，3 例）。真实浏览器复验（Chrome + dev server）：ink 连扭→开壳卡（城市卡「＋加入行程」/线路卡「整条装入」两形态）→蛋堆 2 颗（半开蛋壳 cradle 小图）→机器收窄→「拿去对比」关弹层开对比表（两城并排）；cream 回退 🎰 机器 + 无咔啦（气泡承担其声）+ emoji 开壳/蛋堆；emoji 纪律 ink 隐 🥚🆚 / cream 显；352px 容器零横向溢出；reduced-motion 同步揭晓（单测跑的正是该路径）。**咔啦透明底候选已补画，待用户目检；codex 跨家族 review gate 待与 M64 合并一轮（见 review backlog）。** [cc][codex]

- **M67 — 顺路彩蛋：飞行段守卫补漏 [R1 · S2]（used: fable——in-session 直落：用户报 bug 本会话诊断坐实，2 行修+测试，委派开销超过 diff）**｜用户报「丽江拉萨行程出无锡/苏州/信阳彩蛋」：真实数据复现定位为「飞机+包车」组合档绕过 `mode==="飞机"` 字符串守卫（行程含 noair 远站即触发，budget 侧 M56 已用 air 布尔、itinerary 漏网）；廊道三处+落脚短驳一处换 `.air`。近出发地不设禁入（用户拍板：陆路「去南京顺路苏州」正当；「新疆自驾不推无锡」由飞行段守卫结构保证）。spec 见 design 顺路彩蛋条与 M67。
  Verified（2026-07-21）：`bun run verify` 全绿（lint:agent + tsc + **前端 225**（+2）+ workerd 45，退出码 0）；新增回归测试 2 例（丽江+若尔盖 noair 断言无 wuxi/suzhou/nanjing 且沙溪仍在；独库公路整线装入断言无近沪候选）；修复前后真实数据对照——修前：无锡+0/苏州+1/信阳+3 涌入；修后：丽江+若尔盖=沙溪/九寨沟（锚若尔盖）/泸沽湖，札达单站=诚实空，丽江+拉萨+元阳=建水蒙自（锚元阳）。 [cc]

- **M69 — 扭蛋/对比交互修缮批 [R1 · S2]（used: fable——in-session 直落：五项与用户反馈紧耦合的小修，含真浏览器目检）**｜2026-07-21 用户六条反馈中五条立批即修（第六条京畿主题口径并入 M22，见 📋）：①拿去对比去 confirm 直接覆盖（全站唯一原生 confirm 就此清零，升华为 design「无 confirm 原则」）②对比表列头 ✕ 就地移出（<2 收摊+toast）③蛋堆收进机器面板、背景铺到堆底 ④「清空蛋堆」的「堆」缺字修复——M63 新增文案后没重跑手动字体子集管线；根治=语料落盘 git + font-corpus drift-pin 测试 ⑤气泡尖角改指右侧咔啦。spec 见 design M69。
  Verified（2026-07-21）：`bun run verify` 全绿（lint + tsc + **前端 230**（+5：pile 无 confirm 覆盖、compare-del 渲染 2、font-corpus 2）+ workerd 45）；「堆」经 fontTools cmap 断言已进 title/body 双档 woff2；真实浏览器（Chrome + dev server）全链路目检：扭两颗→蛋堆在面板背景内（虚线只是分隔）→「清空蛋堆」整句毛笔体→气泡尖指右→拿去对比无弹窗直开对比表→列头 ✕ 删一列→池剩 1 收摊+toast「对比池只剩 1 个啦」+ localStorage 正确；蛋堆跨 open 存续复验。 [cc]

- **M65 — 协议机械门禁 [R1 · S2]（used: fable——in-session 直落：规则与本会话刚升级的 skill 文本同源，委派要搬运的上下文超过 diff 本身）**｜2026-07-21 用户采纳 cc 工作流评估后立项即落地：`tools/lint-agent.mjs` 六规则（design 无状态 emoji/无时代标记日期/无 F 编号、state 条目署名（缩进续行归条目）、tag 语法、`.agent` 编外文件须经 design 申报）+ `lint:agent` 挂 verify 链首位 fail-fast + `.github/workflows/verify.yml`（push/PR 红绿灯）+ README 徽章；design.md 同步清掉存量违例（4 处时代日期、3 处 F 编号、1 处代码位——内容并入机制行文，出处归 git blame）。skill 侧同步增设「Mechanical enforcement」节 + 第五类常驻领域文件条款 + bootstrap 接线步（codex 经 `~/.codex/skills` 软链自动同步，无需另发）。spec 见 design M65。
  Verified（2026-07-21）：`bun run lint:agent` 真实目录绿；scratchpad fixture 注入六类违例全数红（7 项，退出码 1）；多行条目署名规则在 M63 落地后的真实 state 上实测跑通；`bun run verify` 全链（lint + tsc + 223 前端 + 45 workerd）本地全绿；CI 首跑绿（Actions run 29804811988，22s）。 [cc]

- **M64 — 扭蛋机与咔啦主页显性化 [R1 · S2]（used: sonnet·high，cc 主 session 直落）**｜2026-07-21 用户点名「机器不抢眼/咔啦不明显（手机端更甚）」两答拍板落地三件：①FAB 升级迷你扭蛋机（`.fab-scene` ~80px 圆形徽章 + `fabBreathe` 待机呼吸动画，移动端收窄到 64px）+ 趴角咔啦（`.fab-kara`，透明底 mascot-cutout，`pointer-events:none`）；②桌面页头探头放大（`.mascot-decor` 44→90px，零新资产——square 母版下此前 25% 的 object-position 本就是数学无效值，放大只是让本就完整显示的全图从「看不清」变「看得清」）；③toast 升级为咔啦头像+说话气泡（`.toast-kara` 头像圈 + `.toast::after` 尖角指左侧头像，同 M69⑤ g-bubble 尖角指说话者的道理）。首步：`ink-mascot-cutout-v1`（用户终审通过）经 `cwebp -q90` 转档 `picked/ink/ink-mascot-cutout.webp`，`tools/build_illustrations.py` 新增 `mascot-cutout` 方图槽位识别；换消费方两处——FAB 趴角 + M63 舞台操作员 `.g-kara`（原用整圆版 mascot，叠机器旁有双重圆晕违和，见 🟡 已销项）。缺 gacha/mascot 资产的皮肤（cream）三处均由 `wireIllustFallbacks` 按图 404 自然回退（FAB 恢复原按钮形态、header 圈/toast 头像静默隐藏、无操作员），不是皮肤 id 硬编码分支。spec 见 design M64。
  Verified（2026-07-21）：`bun run verify` 全绿（lint:agent + tsc + **230 前端** + 45 workerd，退出码 0）；`bun run test:build-assets` 14/14（mascot-cutout 槽位纳入 SQUARE 校验，640×640/41.4KB，budget 60KB 内）；真实浏览器（Chrome + dev server）ink/cream 双皮肤复验：桌面头像放大后咔啦五官/帽子/背包清晰可辨；FAB 机器徽章+趴角咔啦+呼吸动画正常；toast 头像气泡尖角指左；gacha 舞台操作员换透明底后紧贴机器无圆晕重叠；连扭→揭晓→蛋堆全链路与 M63 既有断言不受影响；cream 三处回退验证——FAB 原「🎰 扭一个」pill 按钮、header 圈/toast 头像/gacha 操作员均静默消失、控制台无报错。**顺手修复的潜伏缺陷（本模块放大可见度后暴露）**：`.mascot-decor` 长期只在 base 规则设 `display:inline-flex`，`wireIllustFallbacks` 确有把 404 后的 frame 置 `hidden=true`，但同 F59 道理——自身规则的 specificity 打穿 UA 的 `[hidden]{display:none}`，cream 下实际一直显示一个空心圆圈而非真正消失，44px 时不显眼从未被注意，本模块放大到 90px 后肉眼可辨，顺手补 `.mascot-decor[hidden]`/`.toast-kara[hidden]` 覆盖规则；toast-kara 的 img 原 `loading="lazy"`——toast 是「隐藏起手、JS 切可见」的容器，同 M63「此类容器一律 eager」纪律，lazy 会让首次弹出的 1.8s 窗口来不及决出 404 回退，改 `eager`。新增中文注释触发 font-corpus drift-pin 红灯，`python3 tools/build_fonts.py` 重跑补齐语料（title/body woff2 均已更新）。用户目检异步进行（部署站上看），不阻塞下一模块。 [cc]

- **M66 — 皮肤视觉回归快照 [R2 · S2]（used: sonnet·high，cc 主 session 直落）**｜Playwright 截图基线：皮肤（cream/ink）× 关键视图（主页/详情/扭蛋舞台/行程/路书）矩阵，`playwright.config.ts` + `tests/visual/skins.visual.spec.ts` + `tests/visual/README.md`；`bun run test:visual`（对比）/ `test:visual:update`（改动后重拍）；不进 `verify` 主链（重、依赖浏览器二进制），独立脚本 + `.github/workflows/visual.yml` 可选 job（`macos-latest`，`continue-on-error:true`，不拦截合并）。SKIN_IDS 不 import registry.ts（经 illustrations.ts 引用 `import.meta.env.BASE_URL`，Playwright 纯 Node 转译没有这个全局会直接抛错）——字面量镜像 + `registry.test.ts` 里新增的 drift-pin 断言守住两处同步（同 index.html 防闪烁内联脚本的既有先例）。spec 见 design M66。
  **调试记出的三条截图 flakiness 根因（均已系统性修掉，非本模块遗留债）**：①`.overlay` 的 `backdrop-filter:blur(5px)` GPU 合成模糊本身跑不出两次逐像素一致结果，叠加 `.38` 透明度会让背后页面（点「加入行程」「排行程」时对应卡片滚动进视口，落点逐次不同）透出来——测试环境把背板换成各皮肤 `--paper` 纯色不透明；②`store.ts` 的 `CUR_SEASON`（卡片「当季」徽章）与 `roadbook.ts` 「生成于 YYYY.M.D」文案都读真实 `new Date()`，不冻结基线会随日历天然漂移——`page.clock.setFixedTime` 冻结；③`toHaveScreenshot` 的「连续两帧一致」判定保证不了图片真解码完成——截图前显式等**视口内**的 `<img>` 落定（不能等全部 `document.images`，主页网格 267+ 城市卡多数 `loading=lazy` 且在首屏外，等全部会挂到超时）。
  Verified（2026-07-21）：10 例（2 皮肤 × 5 视图）本地连跑 5+ 轮零 flaky；验收标准（design 原话）实测通过——故意改坏 `src/skins/ink.css` 的 `--ink` token、`vite build` 后 `test:visual` 亮红（`ink-home` diff 命中），改回后重跑转绿；`bun run verify`（231 前端 + 45 workerd）与 `bun run test:build-assets`（14/14）同轮全绿。基线截图对 Chromium 版本/系统字体渲染敏感，本机（macOS/arm64）拍摄——环境依赖诚实记录在 README，非本模块遗留 bug（同 build_fonts.py/build_illustrations.py 本地工具先例）。 [cc]

- **M68 — 搜索增强：地理别名 + 概念词筛选映射 [R2 · S2]（used: 机制段 sonnet·high 会话内直落 + aka 数据批 6 个自包含 opus 子代理分片，按 data-a~f.json 各一个，互不接触对方文件）**｜双层：①`Destination.aka?: string[]` 可选地理别名字段，只进 `matchOne` 搜索 hay（`filter.ts`），不参与任何展示；`tools/build.py` schema 校验（非空唯一字符串数组）；②`src/logic/searchIntent.ts` 概念词表（短途/周边/长途/避暑/海岛/古镇/亲子/冬天）精确匹配整条搜索词（非子串，避免「承德避暑山庄」这类字面搜索误判），命中后结果区顶部给「按筛选看：××」一键 chip（`#intentBox`，`render.ts` 的 `applyIntent`）——除「短途/长途」外均 merge 进既有筛选组既有选中（`setGroup` action，不清空该组其余值）；「短途/长途」是唯一例外，不复用离散筛选组，走 `FilterState.distMode`（`"short"|"long"|null`，纯会话态、不持久化）+ `filter.ts` 新增 `SHORT_TRIP_KM=500`/`LONG_TRIP_KM=1000` 常量，按距 `constants.SH`（当前=上海，M22 参数化后自动跟随）直线距离（`geo.ts` `hav`）派生，AND 叠加于其余筛选条件之上；`relaxCandidates`/`resetFilters`/`applyRelaxAction` 同步接入 `clearDistMode`。spec 见 design M68。
  **aka 数据批**（6 个 opus 子代理并行，各自读 `.agent/content-checklist.md` 新增「四、地理别名 aka」节后独立判断+编辑+本地跑 `python3 tools/build.py` 自验）：data-a(20)/b(16)/c(20)/d(21)/e(24)/f(18)，共 **119 城**（估「百余城」达标）打上 aka，覆盖苏南/苏北/浙南/江南/皖南/徽州/闽南/闽北/闽东/闽西/胶东/晋北/晋中/晋南/河东/辽东/辽西/延边/大兴安岭/关中/陕南/陕北/河西走廊/北疆/南疆/阿勒泰/伊犁/柴达木/陇东/豫西/豫南/南太行/鄂西/湘西/湘南/潮汕/五邑/粤北/粤西/桂北/北部湾/桂西南/海南西线/川西/滇西北/滇南/滇西/黔东南/藏东南/后藏/阿里等 50+ 组地理称谓；口径从严——每份报告均列出「刻意跳过」的候选与理由（宁缺毋编：营销词/城市自身昵称/归属模糊/大众心智弱一律不打），六份报告合计跳过约 90+ 城无强别名。
  Verified（2026-07-21）：6 个子代理各自 `python3 tools/build.py` 独立通过后，central 侧再跑一次全量 `python3 tools/build.py` 确认合并无冲突（282+53=335 条不变，id 唯一性天然保证互不冲突——各代理只碰自己的 data-X.json）；`bun run verify` 全绿（**247 前端**（+16：filter.test aka/distMode 6 例 + relax 候选 1 例、searchIntent.test 6 例、search-intent-ui.test 5 例——原 230 基础上 M64/M66 期间已增至 231，本模块净增 16）+ 45 workerd）；`bun run test:build-assets` 14/14；真实浏览器（Chrome + dev server）：搜「川西」5 命中（含仅靠 aka 命中的 daocheng-yading/siguniangshan-danba，字面均不含"川西"二字）、搜「滇西北」5 命中（大理/丽江/沙溪/香格里拉/泸沽湖）；搜「短途」给 chip 且点击后命中 60/335、搜「亲子」给 chip 且点击后从字面 64 命中扩至 111（companions=带娃 生效）；控制台无报错。手动 schema 校验冒烟（临时目录）：重复 aka 值、空白字符串均被正确拒绝。搜索框 placeholder 示例由「石窟」换成「短途」（展示新能力）——M66 视觉基线复验 10/10 仍绿（该文字改动落在 2% 像素容差内，未触发基线更新）。 [cc]

## 🔜 Next batch（六期，2026-07-21 规划；spec 见 design 注册表 M61/M62 与 M22）

轨道并行照旧：**插画轨道（codex，只动 `assets/illustrations/` 与工单）** ∥ **代码轨道（cc，动 src/）**，文件边界零冲突。 [cc]

1. **M61 — 皮肤：青花（porcelain）[R2 · S2] → sonnet · high（cc）+ 用户终审**｜就绪度最高、排首位：A7 主题层 6 张已终审（mascot v1 / gacha v2 / empty v1 / lotus v2 / cloud v1 / wave v1，empty v1 问号随选择接受）。步骤：①cc 转档 6 张 q90 WebP 入 `picked/porcelain/`，M42 管线出装饰位产物；②porcelain 声明 + token 批（白瓷底/钴蓝；朱红只许出现在 UI chrome 语义色，资产内无红——A7 工单红线）；③共享集钴蓝滤镜首次真实消费（M51 机制）；④cardPhotos 开关按滤镜后目检拍定；⑤工艺件批（texture/seal/placeholder，frame/divider 已撤出成套清单）codex 另开、不阻塞 chrome。 [cc]
   - **A7 工艺件 + mascot-cutout 补件 [R1 · S2] → codex · high（in-session：imagegen 连续目检）**：texture 合格候选 v2/v3（v1 接缝淘汰）、placeholder v1/v2、透明 `qh-mascot-cutout-v1` 已生成，QA=`raw/porcelain/qa/qa-a7-craft-v2.png`；seal 按 A7 红线继续由 UI chrome/CSS-SVG 承担，不画红色资产。待用户终审 texture/placeholder；cutout 同批确认后交 cc 转档接入。 [codex]
2. **M62 — 皮肤：doodle [R2 · S2] → sonnet · high（cc）+ 用户终审**｜A9 已终审：`mascot v2 / gacha v1 / empty v2`，decor 六张（town/plants/travel 各 v1/v2）全部通过，三张落选主题件已从 raw 删除；九区随 M60 共享层不画。下一步由 cc 转档通过版、接声明/token/资产与灰度线稿滤镜。 [codex][cc]
3. **M22 — 自选出发城市·北京首发 [R2 · S3 · 🌫️] → 机制段 cc · 数据批 fable 编排 + opus 分片（M56 体检批先例）**｜排两套皮肤之后——卡池/皮肤稳定后再写北京视角文案，避免二次补写；数据批含京畿短途补卡子批（约 10~12 张，2026-07-21 密度侦查：北京 350km 内 15 张 vs 上海同径 42 张，spec 见 design M22）；🌫️=per-origin difficulty/transit schema 方案开工时 AskUserQuestion 拍板（difficulty 还是筛选契约，动它牵连构建校验）；S3 → 落地后单独挂 codex 跨家族 review gate，并试行 S3→分支+PR+Cloudflare preview 的 git 工作流映射（M65 同轮拍板，skill「Mechanical enforcement」可选条）。spec 见 design M22（已按两段式改述）。 [cc]

- 六期 review gate（2026-07-21 为 loop 连跑重排——用户要求少打断、一次多落几个模块）：**代码面合并一轮**（M63+M64+M66+M67+M68+M69，排 M68 后、M61 前；原「M64 后扭蛋面一轮」并入）**M68 已落地（2026-07-21），gate 现已就绪待开**——codex 跨家族复核 → M61+M62 皮肤面合并一轮（同 M46/M52 先例）；M22 因 S3 单独一轮。M64 的用户目检改为落地后异步（部署站上看，反馈走修缮批），不阻塞 loop 批次。 [cc]

## ⏭ P2

- 【画面+前端】M39 — 皮肤：手帐（水彩剪贴簿）[R2 · S2] ｜ gating：扭蛋机/空态等 19 张水彩资产用户终审（原 28 张中九区 9 张已随 M60 转素材库存档）；审过 cc 转 picked/；另按成套清单需补工艺件批；施工图=质感样稿 v2（git 历史） [cc]
- 【画面+前端】皮肤：画报（丝网印刷复古）[R2 · S2] ｜ gating：按用户兴致排；spec 见 design 皮肤库表（青花已提前晋升六期 M61） [cc]
- 【内容】M11 — 海外版数据 [R2 · S2] ｜ goal 长期方向；2026-07-21 用户确认为六期之后的远期方向；开工前需 scoping 拍板（海外区域枚举/出发地假设/签证难度维度等）；执行侧 claude（2026-07-20 划转拍板） [cc]
- 【前端】M70 — 手机 App 化第一步：PWA [R2 · S2 · 🌫️] ｜ 2026-07-21 用户新增更远期方向（App 化从 PWA 起步）；gating：六期之后按用户兴致排；开工前 scoping 拍板（SW 缓存/更新策略、安装引导位）；spec 见 design M70 [cc]
- 【内容】M22·其他出发城市 ｜ 北京批落地验证 per-origin 管线后逐城扩（2026-07-19 用户口径：北京先行、其余往后排）；spec 同 M22 [cc]
- 【前端】顺游半径西部放宽（150→按区域 200km） [R1 · S1] ｜ 2026-07-17 用户认可候补；gating：真实使用中觉得西部（拉萨类）彩蛋太冷清再动，动时注意东部不放宽 [cc]
- 【内容】高时效交通复卡清单（M56 批A 落库随附，定期回查，触发即回写文案/翻转标记）：上海轨交22号线（2026年内通车→chongming norail 翻转）、枣庄翼云（已校飞随时通航→taierzhuang noair）、红河蒙自（在建目标2026→jianshui-mengzi noair）、元阳机场（延期中→yuanyang-terrace）、丽水机场（2025-04 试飞→songyang/缙云片区文案）、冠豸山复航（→changting noair）、牡丹江海浪复航（或至2028→jingpohu noair）、雄忻高铁五台山站（2027-03→wutaishan）、甬石铁路（2027→shipu-xiangshan norail）、郑登洛城际（→dengfeng-songshan norail）、延榆高铁（2028）、兰合铁路（2027→gannan norail）、黑河高铁（→wudalianchi 文案）、漳汕高铁东山岛站（→dongshandao norail）、大瑞铁路保山以西（→ruili norail）、川青黄胜关以北（2028→ruoergai norail）、川藏铁路雅林段（2032→chuanxi-loop norail）、邵永高铁（2027-12→langshan-danxia norail）——共 18 项；**批B 新增 2**（2026-07-21）：云桂线阳宗站客运班次（2026-01 刚开、日约 3 班→chengjiang-fuxianhu 文案/norail 复议）、鄂州花湖机场客运航线存续（2025 收缩至约 1 条→huangshi-daye noair 复议）；**slowrail 批新增 2**（2026-07-21）：白阿线动车化改造（规划中→aershan slowrail 翻转）、滨洲线开行动车（电气化已成暂无动车→hulunbuir slowrail 翻转）——既列「黑河高铁」项触发时同步翻 wudalianchi slowrail [cc]

## 🟡 Pending decisions

- **手帐水彩 19 张用户终审**：M39（P2）gating，不急；九区 9 张已随 M60 退出待审转素材库 [cc]
- **奶油皮肤缺 mascot/gacha 插画**（2026-07-21 用户外观反馈批发现 mascot 缺口；M64 立项后 gacha 缺口同框）：`illustrations/cream/` 从未画过 mascot 与 gacha 母版，咔啦头像在奶油下真正隐藏（M64 顺手修了个此前一直存在的潜伏 bug——旧版只是「看起来空白」的空心圆圈，`.mascot-decor`/`.toast-kara` 缺 `[hidden]` CSS 覆盖导致 frame.hidden 不生效，见 M64 Verified）；用户拍板先放着——M63/M64 落地后奶油的舞台操作员/FAB 机器/趴机/toast 气泡均走回退形态；若要补齐需奶油卡通风 mascot+gacha 两件母版一并立批（不能直接复用水墨版，风格家族不同） [cc]
- ~~咔啦透明底候选待目检~~ 已销项：2026-07-21 用户终审通过 `raw/ink/ink-mascot-cutout-v1.png`，转档消费并入 M64 首步（见 ✅ M64）；其余皮肤仍按各自画风另出透明本体，cream 缺资产继续走回退。 [cc]
- 插画轨道执行细节：codex 若无图像 API 可用，降级为「整理批量 prompt 清单交用户手动生成」（工单已写明两种模式）；用哪个图像模型由 codex/用户按可用性定，cc 不锁定 [cc]

## 📋 拍板档案

- **2026-07-21 App 化远期方向**（用户）：本站逐步变手机 App、从 PWA 起步 → goal 长期方向新增 + design M70 spec of record + P2 挂账；同轮用户要求 loop 连跑六期批次（少打断多落模块）→ 代码面 review gate 合并重排（见 review gate 行）。 [cc]
- **2026-07-21 交互修缮六条反馈**（用户）：①「用这堆蛋替换掉它们？」类确认弹窗全站排查（仅此一处原生 confirm）并拍板「直接替换、不设确认」→ 升华 design 无 confirm 原则；②对比表要有就地删除；③蛋堆区背景须与机器面板连体；④「清空蛋堆」的「堆」字体不对（=子集缺字）；⑤气泡尖角应指向右侧咔啦——五项立 M69 当日修；⑥朋友口径京畿主题清单「山水/草原/古建筑/古城/清帝陵/海」→ 入 M22 京畿子批主题覆盖口径。 [cc]
- **2026-07-21 六期中程增补拍板**（用户四点反馈 + AskUserQuestion 三答）：①彩蛋 bug（丽江拉萨行程出无锡/苏州/信阳）诊断为「飞机+包车」绕过 mode 字符串守卫 → 立 M67 当日修；近出发地不设禁入——用户口径「去南京顺路苏州可以，去新疆自驾就别推无锡」，后者由飞行段守卫结构保证并入回归测试；②搜索增强选**双层方案**（aka 地理别名批 + 概念词→筛选映射 chip；「短途」按距出发地派生，不新增筛选行）→ 立 M68，**排 M66 后、皮肤前**（三答均选推荐项）；③北京首发要配京畿短途卡（密度侦查 15 vs 42）→ M22 数据批增京畿子批；拓展两方向原则（京沪级配周边密度 / 普通城市只通机制）记入 goal 长期方向；④ink-mascot-cutout-v1 终审通过 → 转档消费并入 M64 首步。 [cc]
- **2026-07-21 协议机械化拍板**（用户，采纳 cc 对 agent-project-workflow 工作流的评估）：①skill 增设「Mechanical enforcement」节（协议 linter / CI 红绿灯 / S3→PR 可选映射 / 视觉回归四件）+ 第五类常驻领域文件条款（观察源=本项目 content-checklist/illustration-brief 两个编外文件证明四文件模型需要正式的第五类）——codex 侧经 `~/.codex/skills` 软链自动同步；②立 M65（.agent linter + CI）即刻落地；③立 M66（皮肤视觉回归）排 M64 后 M61 前，基线等舞台定型；④S3→PR+preview 映射记入 M22 试行。 [cc]
- **2026-07-21 扭蛋机/咔啦显性化拍板**（用户，AskUserQuestion 两答均选推荐项）：①主页扭蛋入口=FAB 升级迷你扭蛋机（机器插画钮+待机微动画，复用皮肤 gacha 资产，缺资产回退现按钮形态）；②咔啦策略=桌面页头探头放大（44→约90px 半身）+ 手机不设常驻位、靠高频出场（趴 FAB 机器顶/toast 咔啦气泡/M63 舞台操作员）→ 立 M64，排 M63 后皮肤前。同轮 cc 拍定：M63 视觉门槛上调（拨盘 sonnet→opus·high + 构图草案先行闸，响应用户「核心 feature 做好看点」）；P2「咔啦出场扩展」被 M63/M64 收编销项 [cc]
- **2026-07-21 M63 构图草案拍板**（用户看 artifact 静态 mock 后，AskUserQuestion 4 答）：①整体构图（机器 hero + 咔啦操作员气泡 / 开壳卡揭晓 / 蛋堆压底）=**局部调整后照此开铺**——(a) 去掉「拿去对比」等按钮上的装饰 emoji（🆚 一类），水墨风只接受代表城市的小 emoji（cc 落法：装饰 emoji 包 .deco-emoji span，ink 隐藏、cream 保留）；(b) 咔啦需重画为透明底 die-cut（当前 ink mascot 自带圆墨晕，叠机器旁像贴块，见 🟡）。②机器=**有蛋堆时收窄让位**。③蛋堆空态=**扭出第一颗才显**（用户理由：有人扭出一个满意直接走、未必要对比）。④蛋壳图形=**先 SVG + 皮肤取色**（草案版即是，质感不足再立插画小批）。 [cc]
- **2026-07-21 M63 扭蛋连扭备选立项拍板**（用户，AskUserQuestion 四答均选推荐项）：①排期=六期头名、皮肤之前（新舞台定型后青花/doodle 一次画到位）；②蛋堆上限 6=对比池上限（同一常量单点，一键整堆去对比）；③揭晓形态=轻量开壳卡，整张卡片大票券退役（完整信息进详情看）；④蛋堆存续=页面会话内（关弹层再开仍在、刷新即散，不进 localStorage）。提案源=用户朋友建议；「扭蛋淡化/弹层不好看」为用户本轮点名的重做动机；DOM 冻结点授权修订，落地后重新冻结 [cc]
- （三期–五期拍板全文见 git 历史——本文件封板前版本至 9298442；已升华的规则以 design.md / goal.md / content-checklist / illustration-brief 现行文本为准。Phase 1 拍板见墓碑范围） [cc]

## ❌ Explicit non-goals（dated triage 记录）

- 房价/余票实时数据：2026-07-15 复评维持不做；2026-07-17 理由随架构拍板更新为「无免费开放数据源，商业接口与绝不付费约束冲突」 [cc]
- 第三方瓦片地图：维持不做——GCJ-02 偏移 + 外部依赖/配额；SVG 足迹地图已交付够用 [cc]
- 用户账号体系（注册/登录/找回）：2026-07-17 原「用户系统/云同步不做」翻案收窄——云同步进 scope（M41 匿名同步码），账号体系维持不做 [cc]

## 📥 Review backlog（triage 结果）

- **六期代码面 review gate 已就绪待开（2026-07-21，M63+M64+M66+M67+M68+M69 均已落地）**：codex 跨家族复核范围——
  - **M63**：连扭排除/容量的池语义边界（对比池覆盖 × 蛋堆排除叠加）、揭晓卡与蛋堆同源 `currentPick=堆尾` 单一真相是否漏态、`.deco-emoji` 纪律是否有遗漏的裸 emoji、reduced-motion 与缺资产皮肤回退。改动面：`src/ui/gacha.ts` 重写、`index.html` 弹层重构、`src/style.css` 舞台/开壳卡/蛋堆 + 移除 `#gachaTicket`/`.ticket-ambience`、`src/skins/{cream,ink}.css` 新增 `--cap-*`、`src/ui/events.ts` 委托、gacha 三测迁移。
  - **M64**：FAB/探头/toast 三处显性化与 mascot-cutout 消费；顺手修的 `.mascot-decor`/`.toast-kara` `[hidden]` 覆盖缺口是否还有其余遗漏点（如 `.g-illust`——本模块判定该处从未被 hide 路径实际触发，未同步修，建议复核确认判断成立）。
  - **M66**：Playwright 基线本身不是「产品代码」，复核关注点主要是三条 flakiness 修法是否会掩盖真回归（如纯色不透明背板是否可能让某皮肤 token 改动恰好只影响透明度/blur 本身而被基线漏检——目前无此类 token，风险低）。
  - **M67/M69**：小范围插队修复，改动面小，常规复核。
  - **M68**：`distMode` 与既有 9 个筛选组的组合语义（AND 叠加、relax 候选、resetFilters 清空）是否有遗漏边界；`setGroup` merge-in-not-replace 的语义选择是否符合直觉；119 城 aka 数据的抽样真实性核查（宁缺毋编红线，6 个子代理独立产出，跨代理一致性未做交叉复核）。
  - 改动面总览见 git log（cc13665/dee156a/待提交的 M68 commit）。 [cc]
- 截至封板（2026-07-21）：历史 F 项（F14–F69）全部修复并经 codex 复核关闭，review.md 无 active findings（最新 baseline e5a6648）；M38/M41/M45/M46/M52 跨家族 gate 均正式通过。**内容批（批A/批B）「codex 跨家族抽查」gate 收口**：89c7b04 复核轮范围明确覆盖 M48/M49 内容批与 M56 交通守卫（提出的 F64/F65/F68 均属该范围且已修复关闭），gate 视为已执行并通过，原「待开」记录就此销项——内容轨道可开新批。 [cc]

## 🪦 Sealed phases

🪦 Phase 1（M1–M25 + 三轮 codex triage）— sealed 2026-07-15 · commit 176512d
   Highlights: 单文件零依赖「下一站扭蛋」上线 GitHub Pages——249 城 + 37 条联程线路，筛选/对比/扭蛋/行程/路书全链路，天气接入（CC BY 合规署名）、打卡足迹 + 零依赖 SVG 中国足迹地图；模块号 M1–M25 永久保留

🪦 三期（M26–M36）— sealed 2026-07-21 · commit 9298442
   Highlights: 分享备份（零依赖 QR/JSON/链接并集合并）、顺路彩蛋真顺路化、路书逐日骨架+每晚落脚点、江浙沪自驾修正、城市卡收录原则治理、扩容至 267 城 53 线、Cloudflare 独立路径发布

🪦 四期（M37–M44）— sealed 2026-07-21 · commit 9298442 ·（M39 未落地，spec 保留 design、排 P2）
   Highlights: Vite+TS 工程化换骨（决策层纯函数 + Vitest 部署门禁）、Cloudflare 免费档后端（KV 短链分享 + Durable Object 同步码云同步）、插画资产管线、吉祥物水豚咔啦、目的地插画共享集 282/282 全量上线（墨线淡彩风格锁冻结）

🪦 五期（M45–M60）— sealed 2026-07-21 · commit 9298442
   Highlights: 主题皮肤系统落地（奶油/山水双肤可切，默认 `ink`）、筛选台手机收纳+界面动作分区、内容三工单（M48 线路全量体检 / M49 +15 卡 +3 tag / M56 西部交通语义修正+282 城通达性体检）、M59 视觉修缮十二项、M60 九区题头晋升共享题头层

---
状态流转规则：会话结束同步本文件（署名）→ commit → push；review.md 有未 triage 的发现时不开下一个实现批次；后端相关模块合入前自查「免费额度内、无绑卡、降级路径存在」三件套。
