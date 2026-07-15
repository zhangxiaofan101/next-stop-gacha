# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。

## ✅ Implemented

（Phase 1 已封板 → 见 🪦 墓碑；M1–M25 全部条目与 Verified 证据明细在 git 历史（至 176512d）；新模块自 M26 起编号） [cc]

## 🔜 Next batch

- （空——下一批新功能由 codex 实现（用户 2026-07-15 宣布），等用户开批定义模块；cc 届时转跨家族 reviewer） [cc]

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
