# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。

## ✅ Implemented

（Phase 1 已封板 → 见 🪦 墓碑；M1–M25 全部条目与 Verified 证据明细在 git 历史（至 176512d）；新模块自 M26 起编号） [cc]

- M27 — 行程单站点行移动端适配 [R1 · S1] · cc in-session ｜ Verified: Chrome 注入等效窄屏规则截图——站名整行、控件组第二行缩进（真机 680px 断点由用户手机复验） [cc]
- M28 — 顺路彩蛋真顺路化 [R2 · S2] · cc in-session ｜ Verified: 杭州+黄山行程彩蛋推莫干山/安吉/南浔 +绕1km（莫干山确在黄山→上海返程直线上，插入位置=几何最优）；线路卡不入候选、insertOnWay 拒线路 id、6 站上限保持 [cc]
- M29 — 路书逐日骨架 + 每晚落脚点 [R2 · S2] · 代码 cc，stays 数据 sonnet · medium 起草 + cc 复核（青甘大环线敦煌×2、伊犁十日分晚等主观点已核，标准节奏）｜ Verified: 独库3天+伊犁5天行程文本导出逐日行「20260707 D1 上海→独库公路（飞机 约8h），进线到那拉提 宿那拉提」全链正确；末日「当晚到家」；出发日期 localStorage 回环+垃圾输入拒绝；build 校验 stays 长度==days 两跑幂等 [cc]
- M30 — 江浙沪自驾 [R1 · S2] · legInfo 代码 cc；30 条 transit 文案 sonnet · low + cc 复核（7 条过保守时长收紧：徐州8→7h、连云港7.5→6.5h 等）｜ Verified: 沪杭段（208km）标注从「高铁」变「高铁/自驾」；杭州→黄山（皖）不受影响；build 幂等通过 [cc]
- M26 — 打卡/收藏跨设备分享备份 [R2 · S2] · UI/hash 合并/JSON cc；QR 编码器 sonnet · high（629 行零依赖 ISO 18004 实现）｜ Verified: 编码器与 python-qrcode 逐位交叉验证 6 组向量全一致（v1~v40，含 2331 字节 V40-M 容量边界与中文 UTF-8）+ 浏览器端真实迁移链接矩阵哈希与 python 参考一致（v5/mask2/hash 1967235024）；hash 导入确认条（并集合并、favs 收线路 id、visited 拒线路 id、垃圾 id 过滤、去重、导入后清 hash、hashchange 同页触发）与 JSON 导入导出全部浏览器断言通过；二维码默认收起、点开 230px；超 1200 字符降级提示走 JSON [cc]

## 🔜 Next batch

> 三期批次：2026-07-15 晚用户开批（7 条体验改进 → M26~M31）。分工修订：cc 实现 M26~M30，**大排查类（M31）交 codex**（用户同日拍板，取代此前「下一批全由 codex 实现」的宣布）；cc 代码仍由 codex 跨家族 review。实现顺序按依赖与量级：M27 → M28 → M30 → M29 → M26；M31 codex 并行随时可起。 [cc]

- M31 — 城市卡包含关系排查 [R2 · S2] → **codex**（用户指定：大排查类）｜产出=「谁包含谁+建议处置」清单写 .agent/m31-containment.md，用户逐条拍板后另行修数据；不动代码。cc 已把 codex 会话启动提示词交给用户（2026-07-15 晚） [cc]

## ⏭ P1

（无）

## ⏭ P2

- M11 — 海外版数据（复用 schema，换区域枚举） [R2 · S2] ｜ 理由：goal 里的长期方向，用户未启动 [cc]
- M22 — 自选出发城市 [R2 · S2] ｜ 2026-07-14 用户拍板：目前写死上海，此项放遥远将来。届时分两步：小改=行程/路书起点选择器（预设城市坐标表+tripLegs 换起点，1 个模块量级）；大改=245 条 transit 文案与 difficulty 三档均为上海视角，多出发地需程序化重生成（M15 级数据工程），另立项 [cc]

## 🟡 Pending decisions

- M31 排查清单（codex 产出后）逐条待用户拍板处置：收窄命名/合并/降级/维持并列 [cc]
- M26~M30 为 cc 实现批次，待 codex 跨家族 review（可与 M31 排查同会话做） [cc]
- codex review 第三轮四条（F8/F11/F12/F13）已全部修复入库（176512d），review.md 待 codex 下次会话复核关闭——不阻塞新批次 [cc]
- index.html 已补完整 HTML 骨架（doctype/head/viewport）以适配 GitHub Pages 裸奉；后续若 republish 到 Claude Artifact，其发布器会再包一层壳，需先验证双重包裹是否渲染正常（或临时剥壳）。主发布渠道已切换为 Pages：https://medspiral.com/next-stop-gacha/ [cc]

## ❌ Explicit non-goals

- 房价/余票实时数据：2026-07-15 复评维持不做，理由从「Artifact CSP 禁外联」更正为「无免费开放数据源，需后端+商业接口，与零依赖架构冲突」；天气已移出不做清单 → P1 M23 [cc]
- 第三方瓦片地图（Leaflet+高德/天地图）：2026-07-15 复评维持不做——破坏单文件零依赖 + GCJ-02 坐标偏移；零依赖 SVG 中国地图翻案已作为 M10/M24 交付（2026-07-15 ✅） [cc]
- 用户系统/云同步：localStorage 够用 [cc]

## 🪦 Sealed phases

🪦 Phase 1（M1–M25 + 三轮 codex triage）— sealed 2026-07-15 · commit 176512d
   Highlights: 单文件零依赖「下一站扭蛋」上线 GitHub Pages——249 城 + 37 条联程线路，筛选/对比/扭蛋/行程/路书全链路，天气接入（CC BY 合规署名）、打卡足迹 + 零依赖 SVG 中国足迹地图；模块号 M1–M25 永久保留

---
状态流转规则：会话结束同步本文件（署名）→ commit → push；review.md 有未 triage 的发现时不开下一个实现批次。
