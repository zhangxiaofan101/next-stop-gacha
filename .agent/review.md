# Review — 下一站，去哪玩

> 本文件由 reviewer（与实现者不同模型家族，默认 Codex/GPT）拥有。发现项在此存活直到被处置：
> ① 代码修复后删除 ② 移入 state.md 成为待办（带署名）③ 升级为 design.md 持久变更 ④ 驳回并留一行理由。

## Reviewer 提示词模板

审阅本仓库最近的变更（git log 定位范围），从八个轴逐项检查，发现写入下方 Active findings：

1. **goal ↔ design 对齐**：设计是否偏离 goal.md 的意图与硬约束（单文件/CSP/浅色卡通）？
2. **design ↔ code 对齐**：index.html 实现是否与 design.md 的机制描述一致？
3. **数据完整性**：data/*.json 与补丁是否通过 tools/build.py 校验？枚举、坐标范围、id 唯一性？地名/菜名/酒店有无明显编造？
4. **错误处理**：空筛选结果、空行程、localStorage 损坏、剪贴板失败等边界是否处理？
5. **测试/验证覆盖**：构建脚本校验之外，关键交互（扭蛋、路书装配、顺路排序）有无验证记录？
6. **可维护性**：单文件 JS 是否结构清晰？数据 schema 变更的影响面是否可控？
7. **估算的诚实性**：交通时长/预算是否始终明示为估算？有无伪装精确的文案？
8. **遗漏**：goal 中承诺但未实现、或实现了但 state.md 未记录的内容？

## Active findings

> Review baseline: fcec443..ca617a8，Codex/GPT reviewer，2026-07-16。先独立复核 F23：fcec443 已把 F8 线路 days 可达性块恢复到 len(ok)==len(st) 通用分支；正常 build 通过，另在临时副本分别给 alt:true 的独库和无海拔关键词的 alt:false 江南线注入不可达 days，两者均被准确拒绝，F23 因此关闭并删除。随后全量复核 248 城 + 37 线：build 通过，id/region/schema、站点顺序、plans 与 stops、alt 保守传播、交通事实逐项互查；发现如下问题。本轮只记录，不改数据。

### F24 — [P1] 五张标准行程越过 2500m 的城市卡未标 alt，四条联程也随之漏过高海拔过滤

design.md 的保守口径是标准行程出现 2500m 以上目的地即 alt:true，但以下城市卡均未写 alt（运行时等同 false）：

- tianshan-tianchi 的 3 日标准方案登马牙山；新疆政府资料给出马牙山海拔 2800m 以上：https://www.xinjiang.gov.cn/xinjiang/lyjg/201912/f74fa70bcf1c4d14ae3439fa3ba508bc.shtml
- wutaishan 的 3 日标准方案完整大朝台并登北台；山西省林草局给出北台顶 3061.1m：https://lcj.shanxi.gov.cn/lczl/zthc/ysdzwbh/kply/202107/t20210722_29689.html
- leshan-emeishan 的 2/3 日标准方案均到金顶；中国气象局给出峨眉山金顶 3079.3m：https://www.cma.gov.cn/whyd/yunhai/201501/t20150116_272185.html
- shennongjia 的 3/4 日标准方案均到神农顶；国家林草局给出主峰 3106.2m：https://www.forestry.gov.cn/c/www/dfdt/569862.jhtml
- changbaishan 的标准方案登北坡主峰看天池；中国气象局给出北坡天文峰一带天池气象站海拔 2620m：https://www.cma.gov.cn/2011xwzx/2011xqxxw/2011xtpxw/202304/t20230428_5476513.html

影响不止城市卡：route-north-xinjiang、route-jinbei-ancient、route-dongbei-snow、route-yichang-shennongjia 都因对应站点为 false 而保持 alt:false，“避开高海拔”仍会显示它们。建议把五张城市卡改为 alt:true，并由构建/数据规则确认四条线路保守传播；另补一份基于标准方案的人工海拔断言清单，不能只依赖自由文本里恰好出现数字、垭口或达坂。

### F25 — [P1] 青海湖祁连环线路书实际会丢掉青海湖

route-qinghai-loop 的首站仍是 xining-qinghai-lake:2，线路方案 D2 明确是青海湖二郎剑—黑马河；但 M31 已把该 id 的城市卡收窄为纯“西宁”，两日城市方案只有塔尔寺和市区内容。该线路没有 leg，装入行程后会按城市方案生成路书，于是名为“青海湖祁连环线”的实际逐日路书没有青海湖，与线路详情的方案叙述分裂。

建议处置：为线路视角的西宁/青海湖首段补 route leg（必要时全线统一补齐），把二郎剑、黑马河和住宿点写在联程层；加一条真实“整线加入行程→导出路书”的回归，不能只检查 stops payload。

### F26 — [P1] 三条线路的短档 plans 与 stops 顺序或覆盖范围互相矛盾

- route-hexi-corridor 的 stops 固定为兰州→张掖→嘉峪关→敦煌，但 5 日“精简版”写成兰州→敦煌→嘉峪关→张掖，整条线路倒走；实际加入行程仍按 stops 正序。
- route-hulunbuir-aershan 的 5 日“草原版”完全没有阿尔山，却仍是包含阿尔山站点的线路 day 档；加入行程会装入 hulunbuir:4 + aershan:2。
- route-dongbei-snow 的 5 日“精简版”完全没有延吉，却仍会按 stops 装入 yanji:1。

days 短档可以压缩停留，但不应展示一条线路、实际装入另一条线路。建议让每个公开 day 档覆盖全部 stops 且顺序一致；做不到就删除该 day 档或拆成不同线路。构建器至少应有一份人工维护的“plan 文本节点顺序/漏站”语义 fixture。

### F27 — [P2] “海南环岛”实质只有东线，7 日环岛版也没有闭环

route-hainan-loop 的 stops 只有海口→万宁→三亚；5 日和名为“环岛版”的 7 日方案都在三亚结束，没有海南西线，也没有回到海口。海南省官方完整环岛产品会继续经过乐东、东方、昌江、儋州、临高、澄迈后回海口，参考：https://en.hainan.gov.cn/englishsite/Routes/202601/70f4439418144f7d8397975e3cf753a1.shtml?ddtab=true 。

建议处置二选一：若维持现有 stops 和天数，改名“海南东线”；若坚持“环岛”，应扩充/迁移成真正闭环并重新评估 2–4 站 schema 与 days，而不是再新增一张重复线路。

### F28 — [P1] 平凉卡把尚在建设的高铁连接写成已经开通

pingliang-kongtong 的 transit 写“平凉有高铁站（银西线），距西安约 2.5h、兰州约 2h 高铁”。但官方资料显示平凉—庆阳铁路是从银西高铁庆阳站引出、接入既有平凉南站的在建项目，并非平凉已在银西高铁上；2025 年交通运输部仍报道该项目建设进展。来源：

- 庆阳市发改委项目说明：https://fgw.zgqingyang.gov.cn/zwgk/zfxxgkml/zdjsxm22fgw/content_22880
- 交通运输部 2025 年建设进展：https://www.mot.gov.cn/jiaotongyaowen/202504/t20250416_4167054.html

这会把未来能力当成当前事实，并低估上海出发难度。建议按当前真实铁路/中转方式重写 transit，并在修改时以当期 12306/官方时刻信息复核西安、兰州耗时；不要保留“银西线”现状表述。
