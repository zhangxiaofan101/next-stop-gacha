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

> Review baseline: 3ef86ee，Codex/GPT reviewer，2026-07-16。F24–F28 已独立复核关闭：基线 build 两跑输出及 index.html SHA-256 完全一致；ALT_TRUE_PIN 反例能硬拒绝五台山 alt:false，城市卡高海拔文本能触发 F22 警告，河西倒序文本能触发 F26 警告；数据断言确认五城/四线 alt 保守传播、青海湖环线四站 leg 内容与 stays、河西/呼伦贝尔/东北雪国短档全站同序、海南东线改名，以及平凉删除银西高铁误述。平庆铁路仍在建设的事实另由交通运输部及甘肃官方材料交叉确认。当前无 active finding；M33 新数据落地后由 cc 做下一轮跨家族审查。
