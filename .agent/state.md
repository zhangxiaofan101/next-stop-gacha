# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。spec 一律指 design.md，本文件只记时间线，不复述规格。

## 🎯 Status snapshot

**线上**：`lab.medspiral.com/next-stop-gacha/`——Vite+TS 工程化版，282 城 + 53 线（335 条）全链路（筛选/扭蛋/对比/行程/路书/足迹地图/天气）；后端短链分享（KV）+ 同步码云同步（Durable Object）；主题皮肤机制 + 奶油/山水双肤（默认 `ink`）；目的地插画共享集 282/282 全量上线。 [cc]

**封板（2026-07-21）**：三期（M26–M36）、四期（M37–M44，M39 未落地留 P2）、五期（M45–M60）一并封板（见 🪦）。封板核验：codex 复核链收口——89c7b04 曾以 F63–F68 明确阻板，三轮修复/复核后 2ee6223 确认「F68、F69 均已关闭；当前无 Active findings」；封板会话另实跑 `bun run verify` 全绿（217 前端 + 45 workerd，退出码 0）、`git status` 干净、main↔origin 0/0。 [cc]

**六期（进行中，2026-07-21）**：执行顺序 ~~M63 扭蛋连扭备选~~ ✅落地 → **M64 机器/咔啦主页显性化（下一个）** → M66 视觉回归网 → M61 青花 → M62 doodle → M22 北京首发（见 🔜）；~~M65 协议机械门禁~~ ✅先行落地（lint:agent 进 verify + CI 红绿灯，与批次顺序无关的工程护栏）；远期方向=M11 海外版（P2，六期之后）。M63 首个落地（扭蛋舞台重做，双皮肤真机复验通过，见 ✅）；A9 doodle 主题层已终审、M62 资产 gating 解除。 [codex][cc]

## ✅ Implemented

（三期–五期已封板 → 见 🪦 墓碑；M26–M60 全部条目与 Verified 证据明细在 git 历史（至 9298442）；M61–M66 已指配六期，新编号自 M67 起。） [cc]

- **M63 — 扭蛋主舞台重做：连扭备选（蛋堆）[R2 · S2]（used: opus·high，cc 主 session 直落——核心 feature 视觉门槛 + 与用户拍板紧耦合，in-session 合理）**｜舞台（机器 hero + 咔啦操作员气泡）→ 揭晓开壳卡（大票券退役）→ 蛋堆压底（半开蛋壳小卡，SVG + `--cap-*` token 取色）。连扭按 id 排除、上限 CMP_MAX 单点、满堆停旋钮、× 扔回池、整堆拿去对比、机器有蛋堆时收窄、蛋堆扭出第一颗才显、页内会话存续（不进 localStorage）。ink 去装饰 emoji（`.deco-emoji`）/ cream 保留。spec 见 design M63。
  Verified（2026-07-21）：`npm run verify` 全绿（tsc + **223 前端** + **45 workerd**，退出码 0）；gacha 三测迁移不丢断言——compare-pool 保留「对比池覆盖复位」并把结果断言改看开壳卡 `#gReveal`；ticket-eager→reveal 小图 eager；ambience 随大票券退役删除——另新增 `gacha-pile`（排除不重复/容量/toss 恢复/拿去对比/清空/跨 open 存续，6 例）、`gacha-reveal`（开壳卡信息+eager+无 `#gachaTicket`，3 例）。真实浏览器复验（Chrome + dev server）：ink 连扭→开壳卡（城市卡「＋加入行程」/线路卡「整条装入」两形态）→蛋堆 2 颗（半开蛋壳 cradle 小图）→机器收窄→「拿去对比」关弹层开对比表（两城并排）；cream 回退 🎰 机器 + 无咔啦（气泡承担其声）+ emoji 开壳/蛋堆；emoji 纪律 ink 隐 🥚🆚 / cream 显；352px 容器零横向溢出；reduced-motion 同步揭晓（单测跑的正是该路径）。**咔啦透明底候选已补画，待用户目检；codex 跨家族 review gate 待与 M64 合并一轮（见 review backlog）。** [cc][codex]

- **M65 — 协议机械门禁 [R1 · S2]（used: fable——in-session 直落：规则与本会话刚升级的 skill 文本同源，委派要搬运的上下文超过 diff 本身）**｜2026-07-21 用户采纳 cc 工作流评估后立项即落地：`tools/lint-agent.mjs` 六规则（design 无状态 emoji/无时代标记日期/无 F 编号、state 条目署名（缩进续行归条目）、tag 语法、`.agent` 编外文件须经 design 申报）+ `lint:agent` 挂 verify 链首位 fail-fast + `.github/workflows/verify.yml`（push/PR 红绿灯）+ README 徽章；design.md 同步清掉存量违例（4 处时代日期、3 处 F 编号、1 处代码位——内容并入机制行文，出处归 git blame）。skill 侧同步增设「Mechanical enforcement」节 + 第五类常驻领域文件条款 + bootstrap 接线步（codex 经 `~/.codex/skills` 软链自动同步，无需另发）。spec 见 design M65。
  Verified（2026-07-21）：`bun run lint:agent` 真实目录绿；scratchpad fixture 注入六类违例全数红（7 项，退出码 1）；多行条目署名规则在 M63 落地后的真实 state 上实测跑通；`bun run verify` 全链（lint + tsc + 223 前端 + 45 workerd）本地全绿；CI 首跑绿（Actions run 29804811988，22s）。 [cc]

## 🔜 Next batch（六期，2026-07-21 规划；spec 见 design 注册表 M61/M62 与 M22）

轨道并行照旧：**插画轨道（codex，只动 `assets/illustrations/` 与工单）** ∥ **代码轨道（cc，动 src/）**，文件边界零冲突。 [cc]

1. **M64 — 扭蛋机与咔啦主页显性化 [R1 · S2] → sonnet · high（cc）+ 用户目检（下一个）**｜2026-07-21 用户点名「机器不抢眼/咔啦不明显（手机端更甚）」，两答拍板（见 📋）：FAB 升级迷你扭蛋机 + 咔啦趴机、桌面页头探头放大（44→约90px）、手机不设常驻位靠高频出场（toast 咔啦气泡 + M63 舞台操作员 + 趴 FAB）；M63 已落地（舞台操作员气泡已在弹层就位），本模块补主页三处显性化；spec 见 design M64。cream 缺 gacha/mascot 资产，三处均走回退形态（补画待办见 🟡）。**注：M63 已把 `.deco-emoji` 包 span 习语落地（ink 隐藏装饰 emoji），M64 的 FAB「扭一个」emoji/toast 气泡沿用同口径。** [cc]
2. **M66 — 皮肤视觉回归快照 [R2 · S2] → sonnet · high（cc）**｜2026-07-21 与 M65 同轮拍板立项：Playwright 皮肤×关键视图截图基线，改坏任一皮肤机器先于目检报警——皮肤×视图×模块是乘法，目检不可扩展；**排 M64 之后、M61 之前**（基线必须拍在扭蛋新舞台+主页显性化定型后，拍早了全是废片；两套新皮肤落地时直接受益）。spec 见 design M66。 [cc]
3. **M61 — 皮肤：青花（porcelain）[R2 · S2] → sonnet · high（cc）+ 用户终审**｜就绪度最高、排首位：A7 主题层 6 张已终审（mascot v1 / gacha v2 / empty v1 / lotus v2 / cloud v1 / wave v1，empty v1 问号随选择接受）。步骤：①cc 转档 6 张 q90 WebP 入 `picked/porcelain/`，M42 管线出装饰位产物；②porcelain 声明 + token 批（白瓷底/钴蓝；朱红只许出现在 UI chrome 语义色，资产内无红——A7 工单红线）；③共享集钴蓝滤镜首次真实消费（M51 机制）；④cardPhotos 开关按滤镜后目检拍定；⑤工艺件批（texture/seal/placeholder，frame/divider 已撤出成套清单）codex 另开、不阻塞 chrome。 [cc]
4. **M62 — 皮肤：doodle [R2 · S2] → sonnet · high（cc）+ 用户终审**｜A9 已终审：`mascot v2 / gacha v1 / empty v2`，decor 六张（town/plants/travel 各 v1/v2）全部通过，三张落选主题件已从 raw 删除；九区随 M60 共享层不画。下一步由 cc 转档通过版、接声明/token/资产与灰度线稿滤镜。 [codex][cc]
5. **M22 — 自选出发城市·北京首发 [R2 · S3 · 🌫️] → 机制段 cc · 数据批 fable 编排 + opus 分片（M56 体检批先例）**｜排两套皮肤之后——卡池/皮肤稳定后再写北京视角文案，避免二次补写；🌫️=per-origin difficulty/transit schema 方案开工时 AskUserQuestion 拍板（difficulty 还是筛选契约，动它牵连构建校验）；S3 → 落地后单独挂 codex 跨家族 review gate，并试行 S3→分支+PR+Cloudflare preview 的 git 工作流映射（M65 同轮拍板，skill「Mechanical enforcement」可选条）。spec 见 design M22（已按两段式改述）。 [cc]

- 六期 review gate：M63+M64 扭蛋面合并一轮 codex 跨家族复核 → M61+M62 皮肤面合并一轮（同 M46/M52 先例）；M22 因 S3 单独一轮。 [cc]

## ⏭ P2

- 【画面+前端】M39 — 皮肤：手帐（水彩剪贴簿）[R2 · S2] ｜ gating：扭蛋机/空态等 19 张水彩资产用户终审（原 28 张中九区 9 张已随 M60 转素材库存档）；审过 cc 转 picked/；另按成套清单需补工艺件批；施工图=质感样稿 v2（git 历史） [cc]
- 【画面+前端】皮肤：画报（丝网印刷复古）[R2 · S2] ｜ gating：按用户兴致排；spec 见 design 皮肤库表（青花已提前晋升六期 M61） [cc]
- 【内容】M11 — 海外版数据 [R2 · S2] ｜ goal 长期方向；2026-07-21 用户确认为六期之后的远期方向；开工前需 scoping 拍板（海外区域枚举/出发地假设/签证难度维度等）；执行侧 claude（2026-07-20 划转拍板） [cc]
- 【内容】M22·其他出发城市 ｜ 北京批落地验证 per-origin 管线后逐城扩（2026-07-19 用户口径：北京先行、其余往后排）；spec 同 M22 [cc]
- 【前端】顺游半径西部放宽（150→按区域 200km） [R1 · S1] ｜ 2026-07-17 用户认可候补；gating：真实使用中觉得西部（拉萨类）彩蛋太冷清再动，动时注意东部不放宽 [cc]
- 【内容】高时效交通复卡清单（M56 批A 落库随附，定期回查，触发即回写文案/翻转标记）：上海轨交22号线（2026年内通车→chongming norail 翻转）、枣庄翼云（已校飞随时通航→taierzhuang noair）、红河蒙自（在建目标2026→jianshui-mengzi noair）、元阳机场（延期中→yuanyang-terrace）、丽水机场（2025-04 试飞→songyang/缙云片区文案）、冠豸山复航（→changting noair）、牡丹江海浪复航（或至2028→jingpohu noair）、雄忻高铁五台山站（2027-03→wutaishan）、甬石铁路（2027→shipu-xiangshan norail）、郑登洛城际（→dengfeng-songshan norail）、延榆高铁（2028）、兰合铁路（2027→gannan norail）、黑河高铁（→wudalianchi 文案）、漳汕高铁东山岛站（→dongshandao norail）、大瑞铁路保山以西（→ruili norail）、川青黄胜关以北（2028→ruoergai norail）、川藏铁路雅林段（2032→chuanxi-loop norail）、邵永高铁（2027-12→langshan-danxia norail）——共 18 项；**批B 新增 2**（2026-07-21）：云桂线阳宗站客运班次（2026-01 刚开、日约 3 班→chengjiang-fuxianhu 文案/norail 复议）、鄂州花湖机场客运航线存续（2025 收缩至约 1 条→huangshi-daye noair 复议）；**slowrail 批新增 2**（2026-07-21）：白阿线动车化改造（规划中→aershan slowrail 翻转）、滨洲线开行动车（电气化已成暂无动车→hulunbuir slowrail 翻转）——既列「黑河高铁」项触发时同步翻 wudalianchi slowrail [cc]

## 🟡 Pending decisions

- **手帐水彩 19 张用户终审**：M39（P2）gating，不急；九区 9 张已随 M60 退出待审转素材库 [cc]
- **奶油皮肤缺 mascot/gacha 插画**（2026-07-21 用户外观反馈批发现 mascot 缺口；M64 立项后 gacha 缺口同框）：`illustrations/cream/` 从未画过 mascot 与 gacha 母版，咔啦头像在奶油下恒空白（缺图隐藏是既有设计，非 bug）；用户拍板先放着——M63/M64 落地后奶油的舞台操作员/FAB 机器/趴机/toast 气泡均走回退形态；若要补齐需奶油卡通风 mascot+gacha 两件母版一并立批（不能直接复用水墨版，风格家族不同） [cc]
- **咔啦透明底候选（M63 舞台操作员用）**（2026-07-21 已生成，待用户目检）：新增 `raw/ink/ink-mascot-cutout-v1.png`（1024×1024 RGBA），只留咔啦本体及黄帽/红背包/纸地图，原 `ink-mascot-v1.png` 与 `picked/ink/mascot.webp` 均未覆盖；三底色边缘 QA=`raw/ink/qa/qa-mascot-cutout-v1.png`。用户通过后由 cc 转档并按 M63/M64 消费；其余皮肤仍按各自画风另出透明本体，cream 缺资产继续走回退。 [codex]
- 插画轨道执行细节：codex 若无图像 API 可用，降级为「整理批量 prompt 清单交用户手动生成」（工单已写明两种模式）；用哪个图像模型由 codex/用户按可用性定，cc 不锁定 [cc]

## 📋 拍板档案

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

- **M63 扭蛋主舞台重做已落地（2026-07-21），待 codex 跨家族复核**：按六期 review gate 与 M64 扭蛋面合并一轮（M64 落地后开）。复核关注点建议：连扭排除/容量的池语义边界（对比池覆盖 × 蛋堆排除叠加）、揭晓卡与蛋堆同源 `currentPick=堆尾` 单一真相是否漏态、`.deco-emoji` 纪律是否有遗漏的裸 emoji、reduced-motion 与缺资产皮肤回退。改动面：`src/ui/gacha.ts` 重写、`index.html` 弹层重构、`src/style.css` 舞台/开壳卡/蛋堆 + 移除 `#gachaTicket`/`.ticket-ambience`、`src/skins/{cream,ink}.css` 新增 `--cap-*`、`src/ui/events.ts` 委托、gacha 三测迁移。 [cc]
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
