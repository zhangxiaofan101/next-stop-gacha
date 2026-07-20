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

> Review baseline: 342c465（`origin/main`）+ 当前未跟踪的 M44 八城母版/产物，Codex/GPT reviewer，2026-07-21。确认范围 `ccab80e..342c465`（20 个提交），覆盖 M48/M49 内容批、M56 交通守卫、M59/M60 视觉与共享题头、默认皮肤反馈批及八城插画接入；F61/F62 维持关闭。**当前有 4 个 P1 + 2 个 P2，不能封板。**
>
> 独立证据：`git diff --check ccab80e..342c465`；`/usr/bin/python3 tools/build.py`（282 城+53 线、9 chunk）；`bun run verify`（前端 215/215 + workerd 45/45）；`PATH="/usr/bin:$PATH" bun run test:build-assets`（11/11）；`bun run build`；真实全量 `tools/build_illustrations.py`（199 城个图+九区题头全部比例/预算过闸，退出码 0）。八张新母版均 1536×1024、发布图均 640×427 且 ≤40KB，逐张目检风格/文字水印/主体安全区通过；本地真实浏览器逐城确认八张卡图与宜昌详情图 `complete=true`、`naturalWidth=640`、控制台零 warn/error。首次 sandbox 内 Worker 验证仍因 Wrangler 日志目录/`127.0.0.1` 权限退出，沙箱外同命令全绿。

### F63 — P1 — 实时切换皮肤不会同步卡片照片开关

`cardPhotosEnabled()` 只在 `cardHTML()` 构造字符串时读取当前皮肤，但 `selectSkin()` 只调用 `applySkinChoice()`/`renderSkin()`，没有让现有网格重新渲染。真实浏览器复现：山水→奶油后 `data-theme=cream`，当前 3 张卡仍各有 `.c-photo`；触发一次搜索重渲染后才变成 0；再奶油→山水后仍为 0，直到下一次网格 render 才恢复。弹层文案承诺「点一下立即切换，不用刷新」，design M59 也要求奶油关/山水开，现状两边都违约。修复应让切肤事务同步刷新网格（并补“先渲染→切肤”的回归测试），不能只测分别在两种 theme 下新建 `cardHTML()`。

### F64 — P1 — 「飞机+包车」把整段大圆距离再次按包车计价

`tripBudget()` 对所有非纯「飞机」段都加 `0.5 * l.km`，因此「飞机+包车」同时按整段距离收机票价和包车价；但该档语义是飞到区域门户后只包最后一程，`l.km` 是起终点整段近似里程，不是接驳里程。真实全库有 63 个上海首末段命中：上海→特克斯 4640km 被加 ¥2320“包车”、上海→札达 4915km 被加 ¥2458，均与 3h 最后一程的时长模型自相矛盾并大幅抬高总预算。需要给组合档一个独立、诚实的接驳计价口径（独立距离/固定区间/明确保守代理均可），并用跨省真实样本断言不再把全程重复计价。

### F65 — P1 — 新增「榕江·村超」赛季窗口已经过时

`data/data-f.json` 的新卡写「2025-2026 赛季……2026 年 6 月总决赛」，但贵州省体育局 2026-05-14 发布、国家体育总局转载的现行赛程明确：7 月 11–26 日仍有附加赛，8 月 1 日起排位赛，8 月 22 日在榕江总决赛（https://www.sport.gov.cn/n14471/n14495/n14543/c29623470/content.html）。当前日期正是 7 月，旧文案会把仍在进行的核心玩法误写成已经结束，违反 content-checklist 的强季节/易变信息红线。应按现行官方赛程改写，并保留「以当期官方赛程为准」。

### F66 — P1 — 八城插画只在工作树，未进入任何提交或部署

当前 `assets/illustrations/picked/dest/dest-{chaozhou,chenzhou,huangyao,hulunbuir,mohe,qiqihar-zhalong,yanji,yichang}.webp` 及对应 `public/illustrations/dest/*.webp` 共 16 个文件全部是 `??`。本地加载、全量管线与目检都通过，但 `origin/main` 不含这些对象；现在封板/部署仍会回退大区题头。应把母版与可复现产物按 M44 边界正式提交，并同步 state 的终审/接入证据。

### F67 — P2 — state 顶部快照与已落地现实多处漂移

`.agent/state.md` 仍称线上 267 城（实际 282）、F61/F62 尚待 reviewer 关闭（review commit 11c3c28 已关闭并已在 main）、M44 为 191/267 且八城仍待挑版（当前工作树已有 199/282 母版/产物）。这会让封板墓碑与后续会话从错误基线出发。修复 F66 时应一次收敛顶部 snapshot/在飞项/M44 进度与内容 gate 结果，历史条目无需回写。

### F68 — P2 — build 闸门声明 `norail`/`slowrail` 互斥但不执行

`tools/build.py` 只逐字段验证布尔类型与线路卡禁用，注释和 design/content-checklist 明确的互斥不变式没有条件检查；未来一张城市卡同时标两者仍会过闸，而运行时因 `norail` 分支在前静默忽略 `slowrail`。当前数据没有冲突（独立扫库为 0），但这是新 schema 的防漂移缺口；应在 build 中拒绝两者同时为 true，并补最小回归。
