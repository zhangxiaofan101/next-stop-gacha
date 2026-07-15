# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。

## ✅ Implemented

（Phase 1 已封板 → 见 🪦 墓碑；M1–M25 全部条目与 Verified 证据明细在 git 历史（至 176512d）；新模块自 M26 起编号） [cc]

- M27 — 行程单站点行移动端适配 [R1 · S1] · cc in-session ｜ Verified: Chrome 注入等效窄屏规则截图——站名整行、控件组第二行缩进（真机 680px 断点由用户手机复验） [cc]
- M28 — 顺路彩蛋真顺路化 [R2 · S2] · cc in-session ｜ Verified: 杭州+黄山行程彩蛋推莫干山/安吉/南浔 +绕1km（莫干山确在黄山→上海返程直线上，插入位置=几何最优）；线路卡不入候选、insertOnWay 拒线路 id、6 站上限保持 [cc]
- M29 — 路书逐日骨架 + 每晚落脚点 [R2 · S2] · 代码 cc，stays 数据 sonnet · medium 起草 + cc 复核（青甘大环线敦煌×2、伊犁十日分晚等主观点已核，标准节奏）｜ Verified: 独库3天+伊犁5天行程文本导出逐日行「20260707 D1 上海→独库公路（飞机 约8h），进线到那拉提 宿那拉提」全链正确；末日「当晚到家」；出发日期 localStorage 回环+垃圾输入拒绝；build 校验 stays 长度==days 两跑幂等 [cc]
- M30 — 江浙沪自驾 [R1 · S2] · legInfo 代码 cc；30 条 transit 文案 sonnet · low + cc 复核（7 条过保守时长收紧：徐州8→7h、连云港7.5→6.5h 等）｜ Verified: 沪杭段（208km）标注从「高铁」变「高铁/自驾」；杭州→黄山（皖）不受影响；build 幂等通过 [cc]
- M26 — 打卡/收藏跨设备分享备份 [R2 · S2] · UI/hash 合并/JSON cc；QR 编码器 sonnet · high（629 行零依赖 ISO 18004 实现）｜ Verified: 编码器与 python-qrcode 逐位交叉验证 6 组向量全一致（v1~v40，含 2331 字节 V40-M 容量边界与中文 UTF-8）+ 浏览器端真实迁移链接矩阵哈希与 python 参考一致（v5/mask2/hash 1967235024）；hash 导入确认条（并集合并、favs 收线路 id、visited 拒线路 id、垃圾 id 过滤、去重、导入后清 hash、hashchange 同页触发）与 JSON 导入导出全部浏览器断言通过；二维码默认收起、点开 230px；超 1200 字符降级提示走 JSON [cc]
- M31 — 城市卡包含关系排查 [R2 · S2] · codex 主审 + 2 个 GPT 只读分片复核｜产出 `.agent/m31-containment.md`：全量覆盖 249 城，确认 34 个包含配对（25 行政/地理 + 9 城市文件伪线路）及 5 个非严格包含的内容重叠项；逐条含证据与处置建议，未改数据｜Verified: 六区计数 42+34+54+29+53+37=249；全量 id/name/plan 互查、易误判组合卡反查、关键行政关系用政府资料交叉验证 [codex]
- M31·处置执行 — 2026-07-15 用户四组拍板（纯名义包含维持现名/A2 照做/环线归线路卡/C+D 都做），cc 执行：西宁·青海湖环线收窄为「西宁」纯城市卡（id 保留）、独库公路城市卡删除并重构 route-duku-highway（stops=伊犁/巴音布鲁克/库车）、ROUTE_STAY 收缩至 6 张、伊犁/喀什删越界内容并重写 stays、阿勒泰→布尔津·喀纳斯禾木、黄山→黄山风景区、武功山→萍乡·武功山（金顶）、6 张卡越界日程改「可接《某卡》」提示（sonnet · medium 执行 + cc 复核）；口径 248 城+37 线（README/meta 同步）｜Verified: build 两跑幂等含线路契约校验；浏览器断言独库线路展开装入=yili:2,bayanbulak:1,kuqa:2、伊犁 7 日路书无琼库什台宿昭苏、全站《卡名》引用逐一存在性校验通过；收录原则五条已写入 design [cc]

## 🔜 Next batch

（三期 M26–M31 已全部完成；M26–M30 跨家族 review 新发现 F14–F17，先 triage，不开下一实现批次。） [codex]

## ⏭ P1

（无）

## ⏭ P2

- M11 — 海外版数据（复用 schema，换区域枚举） [R2 · S2] ｜ 理由：goal 里的长期方向，用户未启动 [cc]
- M22 — 自选出发城市 [R2 · S2] ｜ 2026-07-14 用户拍板：目前写死上海，此项放遥远将来。届时分两步：小改=行程/路书起点选择器（预设城市坐标表+tripLegs 换起点，1 个模块量级）；大改=245 条 transit 文案与 difficulty 三档均为上海视角，多出发地需程序化重生成（M15 级数据工程），另立项 [cc]

## 🟡 Pending decisions

- M31 清单已全部拍板并执行（见 ✅ M31·处置执行与 m31-containment.md 拍板段）；连同 F14–F17 修复待 codex 下轮 review 复核 [cc]
- codex review 第四轮四条（F14/F15/F16/F17）cc 已全采纳修复入库：F14 trip 城市 id 清洗+天数校验、F15 江浙沪 42 条自驾口径补全（断言通过）、F16 导入非对象 JSON 防御、F17 绕路增量改用未取整距离（248 候选零负值回归）；review.md 待 codex 下次会话复核关闭 [cc]
- 2026-07-15 codex 复核：F14–F17 均已确认修复并从 review.md 删除，上述两条“待复核”状态由本行取代；M31 处置新发现 F18/F19（P1）与 F20（P2），待 cc triage，详见 review.md [codex]
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
