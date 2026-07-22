# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。spec 一律指 design.md，本文件只记时间线，不复述规格。

## 🎯 Status snapshot

**线上**：`lab.medspiral.com/next-stop-gacha/`——Vite+TS 工程化版，295 城 + 53 线（348 条）全链路（筛选/扭蛋/对比/行程/路书/足迹地图/天气）；出发地双视角（上海基座/北京，全站数据视角 + 距离排序）；后端短链分享（KV）+ 同步码云同步（Durable Object）；主题皮肤机制 + 原味（cream，原名奶油）/山水/青花/涂鸦四肤（默认 `ink`）；目的地插画共享集 295/295 全量上线。 [cc][codex]

**封板（2026-07-22）**：六期（M61–M69、M71、M73 + M22 北京首发）封板（见 🪦；一至五期先前已封，核验记录见 git 历史）。封板核验：四道 review gate 全过——代码面（F70–F77）、皮肤面（F89–F91）、M22 S3（F78–F88）、M73 终审——review.md 无 Active findings（最新 baseline b077de4）；封板会话实跑 `bun run verify` 全绿（lint:agent + tsc + 294 前端 + 50 workerd，退出码 0）、`bun run test:visual` 24/24、`git status` 干净、main↔origin 同步。 [cc]

**七期（已排未开工）**：M72 装饰件体系 → M70 PWA（见 🔜）；远期池见 🗄。新编号自 M77 起。 [codex]

## ✅ Implemented

- **M76 — 水墨标题易混字回退 [R2 · S2] → codex-medium · high（used: gpt-5.6-sol in-session；需紧贴用户字形反馈且差异小于委派开销）**｜2026-07-22 用户定位「白洋淀」在默认水墨皮肤下被误读为「白洋绽」，不改变七期 M72 → M70 排序；spec 见 design M76。字体 cmap 实查仍是 U+6DC0，根因是毛笔字形的三点水连笔近似绞丝旁；「淀」现从标题子集排除、全标题消费位稳定回退到 Ink Body，其余毛笔标题不变。Verified：子集 cmap 标题无「淀」/正文有「淀」；focused 26/26；卡片 23px + 详情 34px 真实字体栈渲染目检清晰；`bun run verify` 全绿（前端 299/299 + workerd 50/50）；`bun run test:visual` 24/24。 [codex]

- **M75 — 省级地名搜索消歧 [R2 · S2] → codex-medium · high（used: gpt-5.6-terra delegated）**｜2026-07-22 用户插入线上小 bug，不改变七期 M72 → M70 排序；spec 见 design M75。根因是全文无边界子串把银川的「贺兰山东麓」误判为省名「山东」；完整省级地名现只查结构化省份分段，跨省卡保留命中，普通全文/aka 搜索不变。Verified：focused 27/27；`bun run verify` 全绿（前端 298/298 + workerd 50/50）；`git diff --check` 通过。 [codex]

- **M74 — 项目说明同步 [R1 · S1] → codex-small · low（used: gpt-5.6-terra delegated）**｜2026-07-22 用户插入 README 修缮，不改变七期 M72 → M70 排序；全面对齐现行产品能力、295 城 + 53 线数据规模、上海/北京双出发地、四套皮肤、数据维护入口、验证命令与 Cloudflare 部署/降级边界，去掉易漂移的硬编码测试条数。Verified：六区源数据计数 46+36+70+34+60+49=295，`routes.json` 53；`package.json` 脚本逐项核对；`bun run verify` 全绿；`git diff --check` 通过。 [codex]

- **M22 增补 — 新增 13 城目的地插画转正 [R1 · S2] → codex-small · high（used: gpt-5.6-sol in-session；纯机械转档，委派开销更高）**｜2026-07-22 用户终审通过 Batch 17 全部候选；13 张 1536×1024 RGB raw 以 `cwebp -q 90` 转入 `picked/dest/`，再由 M42 管线生成 640×427 卡位产物。picked 从 282 增至 295，正式城市数据 295/295 均有母版与 public 产物；既有 282 张永久跳过、零覆盖。Verified：`python3 tools/build_illustrations.py` 零违规；13 张卡位均 ≤40KiB（22.5–38.4KiB，最高 `shidu` 38.4KiB）；`bun run test:build-assets` 23/23 全绿。 [codex]

（一期–六期已封板 → 见 🪦 墓碑；六期全部条目与 Verified 证据明细在 git 历史——封板前版本至 817b9ca。新编号自 M77 起。） [codex]

## 🔜 Next batch（七期，2026-07-22 排定）

> 排期话术（2026-07-22 统一）：**「N 期」=已排的执行批次**；**「远期」=有 spec/方向、未排期**（用户点名才升期）；**「触发式」=条件触发不占期**。P1/P2 旧称废止。 [cc]

1. 【画面+前端】M72 — 装饰件体系：增补与编排 [R2 · S2 · 🌫️] ｜ 2026-07-22 用户点名七期头名：各皮肤装饰件大小参差、还可能加件，要系统化「加什么、怎么排好看」——每肤可不同排法、可上弹层悬窗；开工时逐肤出 mock 拍板；spec 见 design M72 [cc]
2. 【前端】M70 — 手机 App 化第一步：PWA [R2 · S2 · 🌫️] ｜ 2026-07-21 用户新增方向（App 化从 PWA 起步），2026-07-22 拍板排七期第二位；开工前 scoping 拍板（SW 缓存/更新策略、安装引导位）；spec 见 design M70 [cc]

- 七期 review gate：两模块均 🌫️、开工先 AskUserQuestion；gate 排法（合并轮/分轮）开工规划时定。 [cc]

## 🗄 远期（未排期；2026-07-22 用户拍板「其他都放更远」）

- 【画面+前端】M39 — 皮肤：手帐（水彩剪贴簿）[R2 · S2] ｜ gating：扭蛋机/空态等 19 张水彩资产用户终审（原 28 张中九区 9 张已随 M60 转素材库存档）；审过 cc 转 picked/；另按成套清单需补工艺件批；施工图=质感样稿 v2（git 历史） [cc]
- 【画面+前端】皮肤：画报（丝网印刷复古）[R2 · S2] ｜ gating：按用户兴致排；spec 见 design 皮肤库表（青花已提前晋升六期 M61） [cc]
- 【内容】M11 — 海外版数据 [R2 · S2] ｜ goal 长期方向；开工前需 scoping 拍板（海外区域枚举/出发地假设/签证难度维度等）；执行侧 claude（2026-07-20 划转拍板） [cc]
- 【内容】M22·其他出发城市 ｜ 北京批落地验证 per-origin 管线后逐城扩（2026-07-19 用户口径：北京先行、其余往后排）；spec 同 M22 [cc]
- 【前端】顺游半径西部放宽（150→按区域 200km） [R1 · S1]（触发式） ｜ 2026-07-17 用户认可候补；gating：真实使用中觉得西部（拉萨类）彩蛋太冷清再动，动时注意东部不放宽 [cc]
- 【内容】高时效交通复卡清单（M56 批A 落库随附，定期回查，触发即回写文案/翻转标记）：上海轨交22号线（2026年内通车→chongming norail 翻转）、枣庄翼云（已校飞随时通航→taierzhuang noair）、红河蒙自（在建目标2026→jianshui-mengzi noair）、元阳机场（延期中→yuanyang-terrace）、丽水机场（2025-04 试飞→songyang/缙云片区文案）、冠豸山复航（→changting noair）、牡丹江海浪复航（或至2028→jingpohu noair）、雄忻高铁五台山站（2027-03→wutaishan）、甬石铁路（2027→shipu-xiangshan norail）、郑登洛城际（→dengfeng-songshan norail）、延榆高铁（2028）、兰合铁路（2027→gannan norail）、黑河高铁（→wudalianchi 文案）、漳汕高铁东山岛站（→dongshandao norail）、大瑞铁路保山以西（→ruili norail）、川青黄胜关以北（2028→ruoergai norail）、川藏铁路雅林段（2032→chuanxi-loop norail）、邵永高铁（2027-12→langshan-danxia norail）——共 18 项；**批B 新增 2**（2026-07-21）：云桂线阳宗站客运班次（2026-01 刚开、日约 3 班→chengjiang-fuxianhu 文案/norail 复议）、鄂州花湖机场客运航线存续（2025 收缩至约 1 条→huangshi-daye noair 复议）；**slowrail 批新增 2**（2026-07-21）：白阿线动车化改造（规划中→aershan slowrail 翻转）、滨洲线开行动车（电气化已成暂无动车→hulunbuir slowrail 翻转）——既列「黑河高铁」项触发时同步翻 wudalianchi slowrail；**M22 北京批新增 7**（2026-07-22，均为 origin-beijing.json 北京视角条目或京畿新卡守卫的复核项）：嘉峪关北京直飞冬航季密度（暑运 2-3 班/日边界标「直达」→冬航季复核）、连云港花果山机场北京航线存续（→连云港「直达」降档复议）、淮安直飞北京存疑（现写保守中转）、北京—漠河直飞未证实（现写普速夜车/经哈尔滨）、攀枝花新航线频次观察（2025-10 新开）、雄忻高铁涞源站（2027→laiyuan-baishishan slowrail 翻转，与既列五台山站同线同期）、古北水镇 S5 怀密线直通班次（约 2 对/日→gubei-shuizhen slowrail 依据，班次变动翻标） [cc]

## 🟡 Pending decisions

- **手帐水彩 19 张用户终审**：M39（远期）gating，不急；九区 9 张已随 M60 退出待审转素材库 [cc]
- **奶油皮肤缺 mascot/gacha 插画**（2026-07-21 用户外观反馈批发现 mascot 缺口；M64 立项后 gacha 缺口同框）：`illustrations/cream/` 从未画过 mascot 与 gacha 母版，咔啦头像在奶油下真正隐藏（M64 顺手修了个此前一直存在的潜伏 bug——旧版只是「看起来空白」的空心圆圈，`.mascot-decor`/`.toast-kara` 缺 `[hidden]` CSS 覆盖导致 frame.hidden 不生效，见 M64 Verified）；用户拍板先放着——M63/M64 落地后奶油的舞台操作员/FAB 机器/趴机/toast 气泡均走回退形态；若要补齐需奶油卡通风 mascot+gacha 两件母版一并立批（不能直接复用水墨版，风格家族不同） [cc]
- **京津承类线路北京视角首段显示**（M22 遗留）：整线装入后首段呈现「北京→北京 0km」——显示层怎么收（隐藏首段/合并文案）待定夺，后续修缮批处理 [cc]
- 插画轨道执行细节：codex 若无图像 API 可用，降级为「整理批量 prompt 清单交用户手动生成」（工单已写明两种模式）；用哪个图像模型由 codex/用户按可用性定，cc 不锁定 [cc]

## 📋 拍板档案

- （三期–六期拍板全文见 git 历史——五期前版本至 9298442、六期至 817b9ca；已升华的规则以 design.md / goal.md / content-checklist / illustration-brief 现行文本为准。Phase 1 拍板见墓碑范围） [cc]

## ❌ Explicit non-goals（dated triage 记录）

- 房价/余票实时数据：2026-07-15 复评维持不做；2026-07-17 理由随架构拍板更新为「无免费开放数据源，商业接口与绝不付费约束冲突」 [cc]
- 第三方瓦片地图：维持不做——GCJ-02 偏移 + 外部依赖/配额；SVG 足迹地图已交付够用 [cc]
- 用户账号体系（注册/登录/找回）：2026-07-17 原「用户系统/云同步不做」翻案收窄——云同步进 scope（M41 匿名同步码），账号体系维持不做 [cc]

## 📥 Review backlog（triage 结果）

- 截至六期封板（2026-07-22）：历史 F 项（F14–F91）全部修复并经 codex 复核关闭；六期四道 gate——代码面（F70–F77，baseline 9322468）、皮肤面（F89–F91，fb52544 复核）、M22 S3（F78–F88，PR #4 三轮）、M73 终审（baseline b077de4）——全部通过；review.md 无 active findings。 [cc]

## 🪦 Sealed phases

🪦 Phase 1（M1–M25 + 三轮 codex triage）— sealed 2026-07-15 · commit 176512d
   Highlights: 单文件零依赖「下一站扭蛋」上线 GitHub Pages——249 城 + 37 条联程线路，筛选/对比/扭蛋/行程/路书全链路，天气接入（CC BY 合规署名）、打卡足迹 + 零依赖 SVG 中国足迹地图；模块号 M1–M25 永久保留

🪦 三期（M26–M36）— sealed 2026-07-21 · commit 9298442
   Highlights: 分享备份（零依赖 QR/JSON/链接并集合并）、顺路彩蛋真顺路化、路书逐日骨架+每晚落脚点、江浙沪自驾修正、城市卡收录原则治理、扩容至 267 城 53 线、Cloudflare 独立路径发布

🪦 四期（M37–M44）— sealed 2026-07-21 · commit 9298442 ·（M39 未落地，spec 保留 design、排 P2）
   Highlights: Vite+TS 工程化换骨（决策层纯函数 + Vitest 部署门禁）、Cloudflare 免费档后端（KV 短链分享 + Durable Object 同步码云同步）、插画资产管线、吉祥物水豚咔啦、目的地插画共享集 282/282 全量上线（墨线淡彩风格锁冻结）

🪦 五期（M45–M60）— sealed 2026-07-21 · commit 9298442
   Highlights: 主题皮肤系统落地（奶油/山水双肤可切，默认 `ink`）、筛选台手机收纳+界面动作分区、内容三工单（M48 线路全量体检 / M49 +15 卡 +3 tag / M56 西部交通语义修正+282 城通达性体检）、M59 视觉修缮十二项、M60 九区题头晋升共享题头层

🪦 六期（M61–M69、M71、M73 + M22 北京首发；M70/M72 编号归七期）— sealed 2026-07-22 · commit 817b9ca
   Highlights: 扭蛋主舞台重做（连扭蛋堆）+ 机器/咔啦主页显性化、青花/涂鸦两肤上线（四肤成军，奶油改名原味）、搜索增强（119 城地理别名 + 概念词筛选映射）、出发地全站视角落地（北京首发 + 京畿 12 卡 + 距离排序，S3 分支+PR 流首试）、协议机械门禁 + 皮肤视觉回归网

---
状态流转规则：会话结束同步本文件（署名）→ commit → push；review.md 有未 triage 的发现时不开下一个实现批次；后端相关模块合入前自查「免费额度内、无绑卡、降级路径存在」三件套；发布产物提交一律显式路径、禁宽泛 add（iCloud 同步目录会产生「 2」后缀副本文件，曾混入发布物）。
