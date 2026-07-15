# 🎰 Next Stop Gacha · 下一站，去哪玩

> 选择困难症旅行救星：249 个中国目的地 + 37 条多城联游线路，筛一筛慢慢比，扭一个听天由命，串几站直接出路书。

**单文件、零依赖、纯静态** —— 打开 `index.html` 就能用。

## 能干什么

| 玩法 | 说明 |
|------|------|
| 🔍 筛选比对 | 按地区 / 季节 / 天数（2天~2周）/ 冷热 / 花费（天花板）/ 抵达难度（天花板）/ 体力（多选）/ 同行适配（带娃·带爸妈·独行·情侣周末）/ 玩法标签 / 关键词组合筛选，另有 ⛰️ 避开高海拔开关；每个筛选项实时标注"点下去还剩几个"，筛空了给一键定向放宽；选中最多 4 个出对比表 |
| 🎰 扭一个 | 定好筛选条件转扭蛋，命运决定下一站（含彩带） |
| 🎫 线路卡 | 37 条精选多城串线（河西走廊 / 滇藏线 / 大湾区……）与城市卡同池筛选和扭蛋，可整条装进行程单 |
| 🧳 行程串联 | 最多 6 站加入行程，一键顺路排序（从上海出发贪心就近），每站可调天数 |
| 📖 路书生成 | 逐日安排 + 站间交通推荐（高铁/飞机/自驾，按坐标估时）+ 每站美食/住宿/市内交通 + 人均预算区间，可复制文本或打印存 PDF |
| ♥ 收藏 | 本地保存，支持「只看收藏」 |
| 👣 打卡足迹 | 详情页打卡「去过」，卡片绿色角标 + 「隐藏去过的」开关；🗺 足迹地图——零依赖内嵌 SVG 中国地图（省界离线简化自公开边界数据），去过省份点亮、收藏心形标记，点位可直接打开详情 |

每个目的地附一句住宿参考（偏高档连锁档位 + 落脚区域建议），小地方会直说「以品质民宿为主」。

## 数据

248 个目的地按六个文件分区存放在 [`data/`](data/)，另有 37 条多城联游线路：

| 文件 | 覆盖 | 条数 |
|------|------|------|
| `data-a.json` | 江浙沪 | 42 |
| `data-b.json` | 华东（皖赣闽鲁） | 34 |
| `data-c.json` | 华北 + 东北 | 54 |
| `data-d.json` | 西北 | 29 |
| `data-e.json` | 华中 + 华南 + 港澳 | 53 |
| `data-f.json` | 西南 | 37 |
| `routes.json` | 多城联游线路卡 | 37 |

每区配套 `data-X-patch.json` 补充 `coords`（坐标）/ `hotel`（住宿情报）/ `local`（当地交通）/ `effort`（体力档，空=通配）/ `alt`（高海拔 >2500m）/ `difficulty`（抵达难度）/ `companions`（同行适配，空=通配）。

字段 schema：`id / name / emoji / province / region / crowd / cost / seasons / seasonNote / days / transit / tagline / tags / food / museums / architecture / highlights / plans[] / coords / hotel / local / effort[] / alt / difficulty / companions[]`；线路卡记录另有 `regions[]`（多区域筛选）与 `stops[]`（`{id, days}` 引用城市 + 建议停留），线路 `days` 为筛选档位、须包住各站天数合计，线路途经任一高海拔站则 `alt` 必须为 true，线路名称不带日数（卡面以「约N~M天 · 默认Σ天」展示，各站天数装入行程单后可调）。全部枚举与校验规则见 [`tools/build.py`](tools/build.py)。

## 改数据 / 加目的地

1. 编辑 `data/` 下对应区域的 JSON（新目的地记得在 patch 文件里补 coords/hotel/local/effort/alt/difficulty/companions；新线路直接加进 `routes.json`）
2. 跑构建（校验 schema + 注入 `index.html`）：

```bash
python3 tools/build.py
```

校验不过会直接报错并指出是哪条数据的哪个字段。

## 说明与免责

- 交通方式与时长按坐标直线距离估算，仅供排程参考，出发前以 12306 / 航班动态为准
- 住宿信息为知识性参考，房态与价格以酒店 App 实时为准
- `.agent/` 是多 agent 开发工作流的控制面文件（goal / design / state / review）

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
