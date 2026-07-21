# illustrations — 皮肤插画资产

工单（风格锁 / 逐资产 prompt / 初筛清单 / 命名规范）：[`.agent/illustration-brief.md`](../../.agent/illustration-brief.md)。本目录只管文件流转，**按皮肤分目录**（皮肤 id 与 `data-theme` 值同名，见 design「主题皮肤系统」）：

| 皮肤 id | 名字 | 语言 |
|---------|------|------|
| `cream` | 奶油（默认） | 现行浅色卡通（纯 CSS，暂无插画资产） |
| `ink` | 山水 | 水墨游记 |
| `journal` | 手帐 | 水彩剪贴簿 |
| `porcelain` | 青花 | 青花瓷 |
| `doodle` | 涂鸦 | 童趣线描涂鸦 |
| `poster` | 画报 | 丝网印刷复古 |

**例外目录 `dest/`**（不是皮肤）：目的地插画共享集——全皮肤共用、嵌白框接入（风格隔离舱），流转规则与皮肤目录相同（raw/dest/ 候选 → picked/dest/ 母版），工单见 illustration-brief「M44 目的地插画分批铺量」。

```
assets/illustrations/
├── raw/<皮肤id>/        ← codex 写这里：该皮肤全部文生图候选，PNG ≥1024px，按工单命名（gitignore，只留本地）
│   ├── qa/              ← 并排 QA 总览图
│   └── discarded/       ← 落选/淘汰稿（可随时删）
└── picked/<皮肤id>/     ← cc 写这里：用户终审通过的版本，转 q90 webp 存档（进 git，压缩母版）
```

流转规则：

1. **codex** 每个资产生成 2~4 版放 `raw/<皮肤id>/`，文件名带 `-v{n}`，过一遍工单的初筛核对清单；新皮肤目录不存在就自己建
2. **用户** 挑版终审（并排看，判「换画师」感）
3. **cc** 把通过版转 q90 webp 入 `picked/<皮肤id>/`（存档母版，命名去掉 `-v{n}`），接入时（M42 管线）再从母版产出各装饰位的小尺寸版本（体积上限见 design「资产规范」）
4. `raw/` 整体不进 git——落选候选可随时删；被选中的以 `picked/` 母版为准，raw 原件丢了可按冻结的风格锁重生成
