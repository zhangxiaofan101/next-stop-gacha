# 🎰 Next Stop Gacha · 下一站，去哪玩

[![verify](https://github.com/zhangxiaofan101/next-stop-gacha/actions/workflows/verify.yml/badge.svg)](https://github.com/zhangxiaofan101/next-stop-gacha/actions/workflows/verify.yml)

> 给选择困难症准备的中国旅行目的地选择器：295 个目的地、53 条多城联游线路。筛选、比较、扭蛋决定下一站，再把多站串成可带走的路书。

线上入口：[lab.medspiral.com/next-stop-gacha](https://lab.medspiral.com/next-stop-gacha/)

## 可以做什么

- **按条件找地方**：按地区、季节、天数、冷热、预算、抵达难度、体力、同行对象、玩法标签和关键词筛选；支持避开高海拔、收藏/打卡过滤、当季或距离排序，以及「短途」「长途」等概念搜索。
- **比较后再随机**：最多选 6 个目的地比较；扭蛋机可连续抽取最多 6 个候选，也能从比较池定向抽签。
- **从哪出发**：默认上海，现可切换北京；交通提示、距离排序、筛选、行程和路书都会随出发地视角更新。
- **把目的地变成行程**：城市卡和线路卡都能加入行程；一次最多 10 站，支持顺路排序、调整停留天数、站间交通与预算估算，并生成带路线图的逐日路书，可复制或打印为 PDF。
- **保留与分享**：收藏、打卡、行程和皮肤偏好保存在本机；收藏/打卡可通过链接、二维码或 JSON 迁移，也可用同步码跨设备合并。路书可生成短链分享。
- **看得更有趣**：原味、山水、青花、涂鸦四套浅色手绘皮肤可即时切换（或随机）；295 个目的地均有共享插画。详情页提供 7 天天气预报，取不到时不会影响其他功能。

交通与时长、预算均为估算；请以 12306、航班动态和酒店 App 的实际信息为准。

## 数据

仓库的 [`data/`](data/) 是内容唯一真相源。295 个目的地分在六个区域数据文件中，另有 53 条多城联游线路；构建后会生成按区加载的静态数据 chunk。

| 文件 | 覆盖 | 条数 |
| --- | --- | ---: |
| `data-a.json` | 江浙沪 | 46 |
| `data-b.json` | 华东 | 36 |
| `data-c.json` | 华北 + 东北 | 70 |
| `data-d.json` | 西北 | 34 |
| `data-e.json` | 华中 + 华南 + 港澳 | 60 |
| `data-f.json` | 西南 | 49 |
| `routes.json` | 多城联游线路卡 | 53 |

每区的 `data-*-patch.json` 补充坐标、住宿、当地交通、体力、高海拔、抵达难度和同行适配等字段。`registry-origins.json` 与 `origin-*.json` 管理出发地视角；目前发布上海基座与北京视角。

新增或修改内容时，编辑 `data/` 中的源文件，然后运行：

```bash
python3 tools/build.py
```

该脚本会校验 schema、枚举、坐标及线路不变式，并更新 `public/data/` 的发布数据。不要直接把 `public/data/` 当作内容源。

## 本地开发与验证

要求：安装 [Bun](https://bun.sh/)；Python 3 用于数据构建脚本。

```bash
bun install
bun run dev                 # 本地开发服务器
bun run build               # verify 通过后构建 dist/
bun run preview             # 预览构建产物

bun run verify              # .agent 协议 lint + 类型检查 + 前端/Worker 测试
bun run test:unit           # 前端与决策层 Vitest 测试
bun run test                # Cloudflare Worker / Durable Object 请求级测试
bun run test:build-assets   # 构建产物与插画管线校验
bun run test:visual         # 皮肤 × 视图视觉回归测试
```

`bun run test:visual:update` 会以全量模式更新视觉基线；只在确认所有截图变化都正确时使用。

## 技术与部署

前端采用 Vite + TypeScript、零运行时框架；过滤、扭蛋、行程、交通、预算和路书等决策逻辑与 DOM 分离并接受测试。构建产物是静态资产，目的地数据按区按需加载。

部署在 Cloudflare 免费额度内：[`wrangler.jsonc`](wrangler.jsonc) 会先执行数据构建与 `bun run build`，再由 [`cloudflare/worker.mjs`](cloudflare/worker.mjs) 服务 `/next-stop-gacha/` 路径。`/api/*` 提供 KV 短链分享，以及 Durable Object 支持的同步码与限流；后端不可用时，筛选、扭蛋、行程、路书、地图等核心本地能力仍可使用。

该 Worker 只应绑定 `lab.medspiral.com/next-stop-gacha/*`，不要绑定整个 `lab.medspiral.com` 域名，以免接管 Lab 首页。

## 参与协作

`.agent/` 保存本项目的目标、设计、状态和跨模型审阅记录；提交前请至少运行与改动相符的验证命令。

---

🤖 Built with [Claude Code](https://claude.com/claude-code) and Codex
