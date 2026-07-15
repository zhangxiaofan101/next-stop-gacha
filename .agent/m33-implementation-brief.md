# M33 — 内容扩容二期·实施 Brief（codex 派活 · 数据写作）

> 2026-07-16 用户对 `.agent/m33-expansion-survey.md` 拍板：**「全都要」**（15 条线路含 L14 阿里南线、L5 青甘大环线都收），独立城卡武威、西昌都加，海南处置=改名东线（cc 已改）+ **另派你调研西线/真环岛方案**。
> 本轮你的角色从 reviewer 切换为**数据实施者**；cc 之后做跨家族审查 + 浏览器回归。你写数据，不改 index.html 的 JS/CSS、不改 tools/build.py。
> F24–F28 cc 已全部修复入库（本 commit），请开工前先按 review 协议复核关闭（正常 build + 你自己的反例思路验证；build 已新增 ALT_TRUE_PIN 硬钉子 / F26 顺序警告 / F22 审计泛化到城市卡，均带反例验证记录见 state.md）。

## 0. 交付物

1. **15 张新城市卡**写入对应 `data/data-?.json`（完整记录，不走 patch 文件）
2. **15 条新线路**追加到 `data/routes.json`
3. README.md 与 index.html `<meta name="description">` 的计数口径更新（248 城+37 线 → 263 城+52 线）
4. `.agent/m33-hainan-west-survey.md`：海南西线/真环岛**调研报告**（只提案不写数据——站点选择、是否需新城卡、2~4 站 schema 装不装得下、建议处置；用户拍板后另批实施）
5. state.md 完成记录（署名 [codex]）；建议分 2~3 个 commit（城卡 → 线路 → 口径/README）方便 cc 审

## 1. 城市卡 schema（25 个字段全必填）

`["id","name","emoji","province","region","crowd","cost","seasons","seasonNote","days","transit","tagline","tags","food","museums","architecture","highlights","plans","coords","hotel","local","effort","alt","difficulty","companions"]`

- 枚举：region ∈ {江浙沪,华东,华北,东北,华中,华南,西南,西北,港澳}；crowd ∈ {热门,适中,小众}；cost ∈ {¥,¥¥,¥¥¥}；seasons ⊆ {春,夏,秋,冬}；days ⊆ {2,3,4,5,7,10,14}（取 2~3 档）；tags ⊆ build.py TAGS；effort ⊆ {躺平,正常,费腿,硬核}（空=通配）；difficulty ∈ {直达,一次中转,折腾}；companions ⊆ {带娃,带爸妈,独行,情侣周末}（空=通配，**四档全成立必须留空**，len<4 硬校验）
- **区→文件**：华东→data-b / 华北+东北→data-c / 西北→data-d / 华中+华南+港澳→data-e / 西南→data-f。本批归属：长汀→b；珲春→c；延安、榆林、和田、轮台、武威→d；南宁→e；芒市、瑞丽、若尔盖、日喀则、普兰、札达、西昌→f
- plans：每个 days 档一个 `{days,title,route}`；**方案内容必须在本卡域内**（收录原则④：不吃掉其他独立卡核心内容，越界写「可接《某卡》」——《卡名》必须与现有卡名逐字一致，含空格与 ·）
- coords 纬 18~54 / 经 73~135；transit 一律**上海出发视角**、时长标「约」；hotel 如实写高端连锁有无（用户偏好万豪系，没有就照实说「无成熟高端连锁，建议…」，参考现有卡口径）；alt：**标准方案到 2500m+ 即 true**（日喀则/普兰/札达/若尔盖必为 true；若某卡该判定成立，同时把 id 加进 build.py 的 `ALT_TRUE_PIN`——这是唯一允许你碰 build.py 的一行）
- **杜绝编造**（F28 前车之鉴：平凉「银西线高铁」是编的）：交通方式/时长、菜名、景点、酒店口径逐条要有把握；拿不准宁可写保守（「以当期票务实查」），不写具体线名/精确时长

## 2. 线路卡 schema（城市卡 25 字段 + stops + regions）

- `stops`: 2~4 个 `{id, days, leg?}`；id 必须存在（含你本批新建的城卡）；days ∈ [1, 该城 days 上限]
- **days 档硬约束（build 会拦）**：min(days) ≤ Σstop.days ≤ max(days)；且每档 ∈ [站数, Σ各站城市上限]（F8）
- `leg = {route, stays}`：线路视角逐日文案 + 每晚落脚点（stays 长度==stop.days）。**必写 leg 的线路：L4 川藏、L5 青甘、L9 沙漠公路、L11 三峡游轮、L12 九寨若尔盖、L14 阿里**（沿线开/船，城市方案替代不了）；其余城市方案能承接就不写。leg 生效条件=整组默认装入（写死前后站顺序没问题），参考 route-duku-highway 与 route-qinghai-loop 的现成样例
- **每个 plans 档必须覆盖全部 stops 且与 stops 同序**（F26 教训：不许「展示一条线、装入另一条线」；build 对乱序有警告，漏站靠你自查）
- alt 保守口径：任一停留站 alt=true → 线路必须 true（build 硬拦）；**风险在路上也算**（翻 3000m+ 垭口/达坂即 true）。本批必为 true：L4、L5、L12、L14；L6 随长白山传播
- 站序地理必须成立（F19 教训），survey 里每条已给参考来源，落文案时再核一遍方向与途经顺序
- id 风格 `route-xxx`；名称风格参考现有（地理名+主题，不含日数——名称带「N日」build 直接报错）
- L4 的 chuanxi-loop、L12 的 gannan 是路线型城市卡，作为整体站点引用即可，**不拆其内部景点建新卡**（拆=触发迁移级联，本批禁止）

## 3. 每条线路的既定参数

以 `.agent/m33-expansion-survey.md` §2 你自己写的候选为准（stops/days/alt/leg 判断都在），实施时逐条落地。L14 阿里南线额外要求：边防证、包车合规、补给与高反风险要在 seasonNote/transit/local/leg 里如实写透——如实施中发现 schema 或事实约束下无法诚实表达，可在 state.md 报告弃权并说明，**不硬写**。

## 4. 流程与验收

1. 写完每批跑 `python3 tools/build.py`：0 error；warning 逐条人工判断（F22/F26 警告不许无脑忽略）。**连跑两次确认幂等**。index.html 由 build 注入更新，随 commit 一起提交；不要手改其中 `const DATA` 行
2. 自查清单：新城卡 vs 现有 248 卡无包含冲突（收录五原则）；《卡名》引用逐字存在；stops id 全存在；每档 plan 覆盖全站同序；alt 判定逐条有依据
3. 完成后 state.md 加完成记录（署名 [codex]，含 Verified 证据行），commit + push
4. cc 随后做跨家族审查（地理/编造/schema/浏览器整线装入回归），发现写回 review.md 流程反转——本批你是实现方，review 发现由 cc 提、你 triage

## 5. 红线

- 只碰：data/*.json、routes.json、README.md、index.html（仅 build 产物 + meta description 一行）、build.py 的 ALT_TRUE_PIN 一行、.agent/ 两个 md
- 海南西线只出报告不写数据；海外（M11）不越界
- 每个事实（通车期/垭口海拔/航线/高铁）标注或自持依据；查不实写保守表述
