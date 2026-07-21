# 🎰 Next Stop Gacha · 下一站，去哪玩

[![verify](https://github.com/zhangxiaofan101/next-stop-gacha/actions/workflows/verify.yml/badge.svg)](https://github.com/zhangxiaofan101/next-stop-gacha/actions/workflows/verify.yml)

> 选择困难症旅行救星：267 个中国目的地 + 53 条多城联游线路，筛一筛慢慢比，扭一个听天由命，串几站直接出路书。

**Vite + TypeScript 工程化（零运行时框架），构建产物为纯静态资产** —— `bun install && bun run dev` 本地跑，`bun run build` 出 `dist/`（构建前自动过 `.agent` 协议 lint + `tsc` 类型检查 + 决策层单测门禁；同一门禁在 GitHub Actions 对每次 push/PR 跑红绿灯）。

## 能干什么

| 玩法 | 说明 |
|------|------|
| 🔍 筛选比对 | 按地区 / 季节 / 天数（2天~2周）/ 冷热 / 花费（天花板）/ 抵达难度（天花板）/ 体力（多选）/ 同行适配（带娃·带爸妈·独行·情侣周末）/ 玩法标签 / 关键词组合筛选，另有 ⛰️ 避开高海拔开关；每个筛选项实时标注"点下去还剩几个"，筛空了给一键定向放宽；选中最多 4 个出对比表 |
| 🎰 扭一个 | 定好筛选条件转扭蛋，命运决定下一站（含彩带） |
| 🎫 线路卡 | 53 条精选多城串线（河西走廊 / 滇藏线 / 大湾区……）与城市卡同池筛选和扭蛋，可整条装进行程单 |
| 🧳 行程串联 | 最多 6 站加入行程，一键顺路排序（从上海出发贪心就近），每站可调天数 |
| 📖 路书生成 | 逐日安排 + 站间交通推荐（高铁/飞机/自驾，按坐标估时）+ 每站美食/住宿/市内交通 + 人均预算区间，可复制文本或打印存 PDF |
| ♥ 收藏 | 本地保存，支持「只看收藏」 |
| 👣 打卡足迹 | 详情页打卡「去过」，卡片绿色角标 + 「隐藏去过的」开关；🗺 足迹地图——零依赖内嵌 SVG 中国地图（省界离线简化自公开边界数据），去过省份点亮、收藏心形标记，点位可直接打开详情 |

每个目的地附一句住宿参考（偏高档连锁档位 + 落脚区域建议），小地方会直说「以品质民宿为主」。

## 数据

267 个目的地按六个文件分区存放在 [`data/`](data/)，另有 53 条多城联游线路：

| 文件 | 覆盖 | 条数 |
|------|------|------|
| `data-a.json` | 江浙沪 | 42 |
| `data-b.json` | 华东（皖赣闽鲁） | 35 |
| `data-c.json` | 华北 + 东北 | 55 |
| `data-d.json` | 西北 | 33 |
| `data-e.json` | 华中 + 华南 + 港澳 | 58 |
| `data-f.json` | 西南 | 44 |
| `routes.json` | 多城联游线路卡 | 53 |

每区配套 `data-X-patch.json` 补充 `coords`（坐标）/ `hotel`（住宿情报）/ `local`（当地交通）/ `effort`（体力档，空=通配）/ `alt`（高海拔 >2500m）/ `difficulty`（抵达难度）/ `companions`（同行适配，空=通配）。

字段 schema：`id / name / emoji / province / region / crowd / cost / seasons / seasonNote / days / transit / tagline / tags / food / museums / architecture / highlights / plans[] / coords / hotel / local / effort[] / alt / difficulty / companions[]`；线路卡记录另有 `regions[]`（多区域筛选）与 `stops[]`（`{id, days, leg?}` 引用城市 + 建议停留；`leg` 可带线路视角逐日文案 `route`/每晚落脚点 `stays[]`/显式交通 `transport`），线路 `days` 为筛选档位、须包住各站天数合计，线路途经任一高海拔站则 `alt` 必须为 true，线路名称不带日数（卡面以「约N~M天 · 默认Σ天」展示，各站天数装入行程单后可调），另可选 `entry`/`exit` 声明与首末停留站不同的进出门户城市。全部枚举与校验规则见 [`tools/build.py`](tools/build.py)。

## 改数据 / 加目的地

1. 编辑 `data/` 下对应区域的 JSON（新目的地记得在 patch 文件里补 coords/hotel/local/effort/alt/difficulty/companions；新线路直接加进 `routes.json`）
2. 跑构建校验闸门，通过后把校验+合并后的数据发布为 `public/data/` 下的静态 chunk：

```bash
python3 tools/build.py
```

校验不过会直接报错并指出是哪条数据的哪个字段。Cloudflare 部署构建也会先重跑这个脚本（数据校验闸门，非法数据会让部署直接失败）；`public/data/*.json` 的改动仍建议跟着提交，用于本地预览与产物审计，但部署真相源始终是 `data/`。

## 本地开发 / 构建

```bash
bun install              # 安装依赖（Vite + TypeScript，无运行时框架）
bun run dev              # 本地开发服务器
bun run build            # 先跑 verify 门禁（tsc + 决策层单测 + Worker/DO 请求级测试），再产出 dist/
bun run verify           # 单独跑门禁：tsc --noEmit + vitest run（决策层）+ vitest run --config vitest.workers.config.ts（Worker/DO）
bun run test:unit        # 决策层 Vitest 单测（src/logic/__tests__/，73 条）
bun run test             # Cloudflare Worker/Durable Object 请求级测试——跑在真实本地 workerd 沙箱里（@cloudflare/vitest-pool-workers）
bun run test:build-assets  # 校验 vite 构建产物的资产路径能被 Worker 路由命中（需要真实文件系统/子进程，不进 verify 门禁）
```

代码分层（M38 起）：`src/logic/` 决策层纯函数模块（filter / gacha / itinerary / transport / budget / roadbook / share / map / qr / persist，无 DOM 依赖，Vitest 覆盖）· `src/ui/` 按视图切分的模板渲染模块（筛选台/卡片/详情/对比/扭蛋/行程/路书/地图/分享 + 事件接线）· `src/store.ts`（应用状态与 localStorage）· `src/services/weather.ts`(天气 I/O) · `src/main.ts`（启动编排）· `src/style.css` + `src/cn-map.ts`（足迹地图 SVG 数据）；`index.html` 是 Vite 入口，只保留静态 body 标记。

## 部署

正式入口 `https://lab.medspiral.com/next-stop-gacha/`，内容只在本仓库维护。`wrangler.jsonc` 在 Cloudflare 构建时跑 `python3 tools/build.py && bun install && bun run build`（先重跑数据校验闸门并从 `data/` 重新生成 chunk，再过 `tsc` + 决策层单测 + Worker/Durable Object 请求级测试门禁，最后 Vite 构建产出多文件 `dist/`——数据非法、类型错误、不变式单测失败或 Worker/DO 测试失败都会让部署直接失败），最后由 `cloudflare/worker.mjs` 剥离 `/next-stop-gacha` 路径前缀，`/api/*` 路由到短链分享（存 KV）与同步码/限流（存 Durable Object——两台设备并发同步需要真原子读写，KV 给不了），其余交给静态资源服务——该 Worker 逻辑与资产文件数量无关，天然支持多文件产物，并按路径分层设置缓存（hash 命名资产 immutable 长缓存，HTML/manifest 短缓存重验证）。

仓库配置只负责声明构建和目标 Route；首次上线还需要在 Cloudflare Workers 中连接本仓库并执行一次生产部署。不要给这个 Worker 绑定整个 `lab.medspiral.com` Custom Domain，以免接管 Lab 首页。

## 说明与免责

- 交通方式与时长按坐标直线距离估算，仅供排程参考，出发前以 12306 / 航班动态为准
- 住宿信息为知识性参考，房态与价格以酒店 App 实时为准
- `.agent/` 是多 agent 开发工作流的控制面文件（goal / design / state / review）

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
