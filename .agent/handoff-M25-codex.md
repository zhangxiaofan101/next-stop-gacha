# M25 契约 — 内容扩容三批：城市目的地 + 联程线路（codex 实现）

> 本文件是一次性交接契约，由 cc 起草（2026-07-15，用户拍板开轨）。M25 合并验收后由 cc 删除本文件。
> ROLE SWAP：本模块 codex 任实现者；cc 负责合并、独立验收与 state 同步（cc 验收即构成本模块的跨家族复核）。

## 0. 边界（先读，违反任何一条整批打回）

- 从最新 main 拉分支 `codex/m25-data`（开工前先 `git pull`）。若与 cc 同机同目录，先确认工作区干净；更稳妥用 `git worktree` 另开目录，cc 正在 main 上并行改 index.html（M10/M24）。
- **只允许改 13 个文件**：`data/data-{a..f}.json`、`data/data-{a..f}-patch.json`、`data/routes.json`。严禁改 `index.html`、`tools/`、`.agent/`、`README.md`——state 同步由 cc 在合并时做，不要自行编辑四文件。
- 允许本地跑 `python3 tools/build.py` 验证，但它会把数据注入 index.html——**每次跑完必须 `git restore index.html`**，最终 diff 里不得出现 index.html。
- 只追加新记录，**不改既有记录一个字节**。注意各文件序列化格式不同：a/b/c/d/f 及其 patch=多行缩进，**data-e 与 data-e-patch 是紧凑单行**（追加后须断言旧内容是新内容的前缀）。
- 提交到本分支即可，不合并回 main、不 push main。分块小步落盘（每 ≤5 条写一次文件），别攒到最后一次性写。
- 拿不准的条目：**保守跳过并在报告里留档理由**，不要自行发明口径（用户不在线，无人拍板）。

## 1. 任务与规模

| 类型 | 目标 | 优先方向（现状条数） |
|---|---|---|
| 城市目的地 | +30~40 条（上限 40） | 华南(12)、东北(18)、华北(21)、华中(23)优先；江浙沪(42)/西南(37)/西北(29)已密，只收确有遗珠 |
| 联程线路 | +8~12 条（上限 12） | 线路空白区：华北(1)、东北(2)、江浙沪(2)、华南(2)、华中(3)；西北(6)/西南(6)已多 |

收录门槛：真实存在 + 有独立成行价值（值得从上海专程去一趟）+ 知名度足够。**质量优先，宁缺毋滥**——凑不满目标数就如实交付并在报告说明，这是 M15 的既定先例（设计 220+ 实落 218）。

## 2. schema 与文件分工（照抄现有记录，样例看 data-a.json 杭州 / routes.json 河西走廊）

**城市记录**拆两处，键位一个都不能少（build.py REQ 强校验）：
- 基础字段进 `data-X.json`：`id, name, emoji, province, region, crowd, cost, seasons, seasonNote, days, transit, tagline, tags, food, museums, architecture, highlights, plans`
- 补丁字段进 `data-X-patch.json`（键=id）：`coords, hotel, local, effort, alt, difficulty, companions`
- 分区文件：a=江浙沪 · b=华东(皖赣鲁闽) · c=华北+东北 · d=西北 · e=华中+华南+港澳 · f=西南。新城市按 region 入对应文件。

**线路记录**全字段单条进 `routes.json`（无补丁），额外两个字段：
- `regions`: string[]，途经全部大区（非空、⊆ 大区枚举）；`region` 仍填主要/起点大区。
- `stops`: `{id, days}[]`，2~4 站、游览顺序、id 引用城市池（既有 218 + 本批新增均可）、站内无重复、每站 days ∈ [1, 该城市 max(days)]。
- 线路 `id` 必须 `route-` 前缀；所有 id 用小写拼音+连字符。

**枚举**（越界即 build 失败）：
- region ∈ {江浙沪, 华东, 华北, 东北, 华中, 华南, 西南, 西北, 港澳}
- seasons ⊆ {春, 夏, 秋, 冬}（非空）；days ⊆ {2, 3, 4, 5, 7, 10, 14}（非空）
- crowd ∈ {热门, 适中, 小众}；cost ∈ {¥, ¥¥, ¥¥¥}
- tags ⊆ {美食, 博物馆, 古建筑, 古镇古村, 自然风光, 海岛海滨, 徒步, 民俗非遗, citywalk, 夜生活, 温泉, 滑雪, 沙漠, 草原, 摄影出片, 世界遗产, 边境风情, 亲子}，取 3~6 个
- effort ⊆ {躺平, 正常, 费腿, 硬核} 无重复；空数组=通配，先例仅北京/香港/成都/重庆级综合大城市，一般写 1~2 档
- alt: bool（主体游玩区海拔 >2500m 才 true）
- difficulty ∈ {直达, 一次中转, 折腾}
- companions ⊆ {带娃, 带爸妈, 独行, 情侣周末} 无重复且 **≤3 个**（四档全适配必须写 `[]`）

## 3. 内容风格铁律

1. **视角=江浙沪（上海）出发**。transit 写上海出发首段（「上海高铁X h直达」「上海直飞X约X h」）；difficulty 也按上海出发判：显式转乘或落地后另有 >30min 接驳/坐船/索道/包车进山 = 一次中转；边境通行证、不定期小船、全程约 1 天 = 折腾；江浙沪近郊自驾视为直达。
2. **hotel 字段严禁出现任何酒店品牌名（中英文皆禁）**——goal 级硬约束。写供给结构+选址建议，参考「湖滨高端连锁多，近西湖首选；武林、钱江新城选择也丰富」。
3. **线路 name 禁含日数**（build 强制拒 `\d\s*[日天]`）。线路天数契约：stops 天数分配=事实真相=默认装入；days 枚举=弹性档位，须 min(days) ≤ Σstops.days ≤ max(days)，**且每个 days 档位都要有对应 plan**（F8 契约）。
4. 城市 plans：每条 plan 的 days ∈ 该记录 days 枚举（不必每档都有，至少 1 条、建议主档有）；route 用「D1 …；D2 …」格式，写真实景点动线。
5. 线路 alt 保守口径：任一停留站 alt=true → 线路必须 alt=true（build 强制）。
6. tagline 一句话、两个具体画面（「西湖烟雨里划船，龙井村喝一杯明前茶」），不写广告腔；seasonNote 带月份+物候/提示；food/museums/architecture/highlights 全用真实名称，自然型目的地 museums 可留空不硬凑。
7. coords=[纬度, 经度] 两位小数、景区/城中心近似（界内 18~54 / 73~135，线路取起点或代表点）；emoji 每条一个、贴主题。

## 4. 去重

- 开工先读全部现有 218 城 + 27 线的 id 与 name（name 归一化=去「·」去空格）建清单再选题；build 对 name 疑似重复只 warning，本批按 error 对待。
- 粒度先例（M15）：同市不同景区可分立（特克斯喀拉峻 vs 伊犁），但须坐标独立、真实、有独立成行价值；与既有条目高度重叠的换题。

## 5. 自检清单（全过才提交，结果写进提交信息）

1. `python3 tools/build.py` 退出 0（错误+警告都要看），随后 `git restore index.html`
2. `git diff main --stat` 只含上述 13 个数据文件；逐文件断言既有记录零改动（data-e 断言旧单行是新单行前缀）
3. 品牌词扫描零命中：对新增内容 grep 常见酒店品牌中英文（万豪/Marriott/JW/丽思/Ritz/瑞吉/St. Regis/威斯汀/Westin/喜来登/Sheraton/艾美/福朋/万怡/万枫/雅乐轩/希尔顿/Hilton/康莱德/Conrad/凯悦/Hyatt/柏悦/君悦/洲际/InterContinental/皇冠假日/假日/智选/香格里拉/Shangri-La/悦榕庄/Banyan/安缦/Aman/四季/Four Seasons/文华东方/半岛/凯宾斯基/索菲特/Sofitel/雅高/美居/诺富特/亚朵/全季/桔子/汉庭/如家/锦江/维也纳/希岸/丽枫）
4. 新增各字段枚举合法、plans.days ∈ days、线路每档有 plan、Σstops 契约、id/name 全局唯一（含与本批内部互查）
5. 报告（提交信息或分块提交的末次信息）：新增清单（id/name/region）、区域分布前后对比、边界判断留档（收/不收理由）、未达目标数原因、跳过项清单

## 6. 给用户的粘贴入口（cc 备注，codex 无需读）

用户把下面这段粘给 codex 即可启动本契约（见 state.md M25 行）。
