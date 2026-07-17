# illustrations — 手绘插画资产

工单（风格锁 / 逐资产 prompt / 初筛清单 / 命名规范）：[`.agent/illustration-brief.md`](../../.agent/illustration-brief.md)。本目录只管文件流转：

```
assets/illustrations/
├── raw/      ← codex 写这里：全部文生图候选，PNG ≥1024px，按工单命名（gitignore，只留本地）
└── picked/   ← cc 写这里：用户终审通过的版本，转 q90 webp 存档（进 git，作为压缩母版）
```

流转规则：

1. **codex** 每个资产生成 2~4 版放 `raw/`，文件名带 `-v{n}`，过一遍工单的初筛核对清单
2. **用户** 终审（并排看，判「换画师」感；吉祥物三选一）
3. **cc** 把通过版转 q90 webp 入 `picked/`（存档母版，命名去掉 `-v{n}`），接入时（M42/M44）再从母版产出各装饰位的小尺寸版本（体积上限见 design「资产规范」）
4. `raw/` 不进 git——没被选中的候选可随时删；被选中的以 `picked/` 母版为准，raw 原件丢了可按冻结的风格锁重生成
