# State — 下一站，去哪玩

> 更新纪律：每个工作会话结束时本文件必须与代码现实一致；每条新增/修改行带作者署名 [cc] 或 [codex]。

## ✅ Implemented

- M1 — 六区数据 144 条 [R2 · S3] → fable/opus 分区并行生成，构建校验全过（used: fable 5 + opus 4.8 收尾） [cc]
- M2 — 补丁字段 coords/hotel/local 144/144 [R1 · S2] （used: fable 5 + opus 4.8） [cc]
- M3 — 构建管线 tools/build.py [R1 · S3] 幂等，枚举/必填/去重/坐标范围强校验 [cc]
- M4 — 筛选/搜索/排序 [R1 · S2] 标签 AND、天数桶、当季优先排序 [cc]
- M5 — 卡片/详情/对比（≤4） [R1 · S2] [cc]
- M6 — 扭蛋随机 [R1 · S1] 条件池 + 减速动画 + 彩带 [cc]
- M7 — 行程规划器 [R2 · S2] ≤6 站、贪心顺路、距离分档交通、预算区间、顺路彩蛋（500km 内推荐加站） [cc]
- M8 — 路书生成 [R2 · S2] 逐日装配 + 文本复制 + 打印 CSS [cc]
- M9 — 浅色卡通视觉 [R2 · S1] 第一版深色发车牌风被用户否决后重做，用户偏好已存全局记忆 [cc]

## 🔜 Next batch

（空——首版已交付，等用户反馈定优先级） [cc]

## ⏭ P1

- 真机走查：iOS Safari / 微信内置浏览器上过一遍扭蛋、路书打印，Yuanti 字体在非 mac 上的降级效果 [R1 · S2] → sonnet · low ｜ 理由：目前只在桌面验证过 [cc]
- 交通启发式校准：抽 10 条真实高铁/航班时长对比估算误差，必要时调分档参数 [R1 · S2] → sonnet · low ｜ 理由：估算参数是拍脑袋的，未实测 [cc]

## ⏭ P2

- M10 — 去过打卡 + 足迹统计 [R1 · S1] ｜ 理由：nice-to-have，等用户想要 [cc]
- M11 — 海外版数据（复用 schema，换区域枚举） [R2 · S2] ｜ 理由：goal 里的长期方向，用户未启动 [cc]

## 🟡 Pending decisions

- 路书起点写死"上海"，是否要支持自选出发城市？（等用户表态） [cc]
- Artifact 发布版与 repo 版是同一文件，后续改动是否每次都要同步 republish？（建议：是，跑完 build.py 顺手发） [cc]

## ❌ Explicit non-goals

- 实时 API（天气/房价/余票）：Artifact CSP 禁外联，goal 已明确排除 [cc]
- 地图瓦片可视化：同上，考虑过 SVG 手绘中国地图但性价比低，暂拒 [cc]
- 用户系统/云同步：localStorage 够用 [cc]

## 🪦 Sealed phases

（无）

---
状态流转规则：会话结束同步本文件（署名）→ commit → push；review.md 有未 triage 的发现时不开下一个实现批次。
