# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。

## ✅ Implemented

（Phase 1 已封板 → 见 🪦 墓碑；M1–M25 全部条目与 Verified 证据明细在 git 历史（至 176512d）；新模块自 M26 起编号） [cc]

## 🔜 Next batch

> 三期批次：2026-07-15 晚用户开批（7 条体验改进 → M26~M31）。分工修订：cc 实现 M26~M30，**大排查类（M31）交 codex**（用户同日拍板，取代此前「下一批全由 codex 实现」的宣布）；cc 代码仍由 codex 跨家族 review。实现顺序按依赖与量级：M27 → M28 → M30 → M29 → M26；M31 codex 并行随时可起。 [cc]

- M27 — 行程单站点行移动端适配 [R1 · S1] → cc 顺手（几行 CSS，委派开销>收益）｜用户真机截图：站名被 天数下拉+↑↓✕ 挤压；680px 断点站点行改两行，顺手过其余弹层 [cc]
- M28 — 顺路彩蛋真顺路化 [R2 · S2] → cc 顺手（算法小但与 renderTrip 紧耦合）｜已实锤 bug：候选池没排除线路卡，点＋把线路 id 当城市塞进 trip；语义改最小绕路插入（见 design） [cc]
- M30 — 江浙沪自驾 [R1 · S2] → legInfo 代码 cc 顺手；30 条 transit 文案 sweep → sonnet · low（海岛/轮渡特例单独口径），cc 逐条复核后走 build 校验 [cc]
- M29 — 路书逐日骨架 + 每晚落脚点 [R2 · S2] → cc 主实现（路书装配三口径重构）；8 条 ROUTE_STAY 城市的 plans[].stays 数据 → sonnet · medium 起草 + cc 复核｜拍板记录：宿地按用户样例格式逐日给出；出发日期可选，不填保持 D1/D2 [cc]
- M26 — 打卡/收藏跨设备分享备份 [R2 · S2] → QR 编码器（独立纯函数）→ sonnet · high + python 参考实现交叉验证；hash 合并导入/JSON/入口 UI cc｜拍板记录（2026-07-15）：分享对象=打卡+收藏（非行程）；合并=并集不覆盖；UI 克制不占地 [cc]
- M31 — 城市卡包含关系排查 [R2 · S2] → **codex**（用户指定：大排查类）｜产出=「谁包含谁+建议处置」清单进 review.md 或独立文档，用户逐条拍板后另行修数据；不动代码 [cc]

## ⏭ P1

（无）

## ⏭ P2

- M11 — 海外版数据（复用 schema，换区域枚举） [R2 · S2] ｜ 理由：goal 里的长期方向，用户未启动 [cc]
- M22 — 自选出发城市 [R2 · S2] ｜ 2026-07-14 用户拍板：目前写死上海，此项放遥远将来。届时分两步：小改=行程/路书起点选择器（预设城市坐标表+tripLegs 换起点，1 个模块量级）；大改=245 条 transit 文案与 difficulty 三档均为上海视角，多出发地需程序化重生成（M15 级数据工程），另立项 [cc]

## 🟡 Pending decisions

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
