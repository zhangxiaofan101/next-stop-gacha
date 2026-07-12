# 🎰 Next Stop Gacha · 下一站，去哪玩

> 选择困难症旅行救星：144 个中国目的地，筛一筛慢慢比，扭一个听天由命，串几站直接出路书。

**单文件、零依赖、纯静态** —— 打开 `index.html` 就能用。

## 能干什么

| 玩法 | 说明 |
|------|------|
| 🔍 筛选比对 | 按地区（江浙沪短途优先）/ 季节 / 天数（2天~2周）/ 冷热 / 18 种玩法标签 / 关键词组合筛选，选中最多 4 个出对比表 |
| 🎰 扭一个 | 定好筛选条件转扭蛋，命运决定下一站（含彩带） |
| 🧳 行程串联 | 最多 6 站加入行程，一键顺路排序（从上海出发贪心就近），每站可调天数 |
| 📖 路书生成 | 逐日安排 + 站间交通推荐（高铁/飞机/自驾，按坐标估时）+ 每站美食/住宿/市内交通 + 人均预算区间，可复制文本或打印存 PDF |
| ♥ 收藏 | 本地保存，支持「只看收藏」 |

每个目的地附一句住宿参考（偏高档连锁档位 + 落脚区域建议），小地方会直说「以品质民宿为主」。

## 数据

144 个目的地按六个文件分区存放在 [`data/`](data/)：

| 文件 | 覆盖 | 条数 |
|------|------|------|
| `data-a.json` | 江浙沪 | 30 |
| `data-b.json` | 华东（皖赣闽鲁） | 24 |
| `data-c.json` | 华北 + 东北 | 23 |
| `data-d.json` | 西北 | 17 |
| `data-e.json` | 华中 + 华南 + 港澳 | 25 |
| `data-f.json` | 西南 | 25 |

每区配套 `data-X-patch.json` 补充 `coords`（坐标）/ `hotel`（住宿情报）/ `local`（当地交通）。

字段 schema：`id / name / emoji / province / region / crowd / cost / seasons / seasonNote / days / transit / tagline / tags / food / museums / architecture / highlights / plans[] / coords / hotel / local`，枚举值见 [`tools/build.py`](tools/build.py)。

## 改数据 / 加目的地

1. 编辑 `data/` 下对应区域的 JSON（新目的地记得在 patch 文件里补 coords/hotel/local）
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
