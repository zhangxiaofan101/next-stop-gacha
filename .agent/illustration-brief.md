# 插画工单 — 手绘风资产（M42 装饰位 / M43 目的地样例）

> 工单文档（work order）：分工、风格锁、逐资产 prompt、验收标准。消费完毕后随阶段封板归档。规范类内容（资产格式/回退/一致性判据）以 design.md「手绘视觉系统」为准，本文件不重复。

## 分工

| 谁 | 干什么 |
|----|--------|
| **codex（文生图轨道）** | 按本工单的风格锁+prompt 生成图像。Codex 本体不出图——它的任务是：有图像 API（gpt-image-1 等）就写脚本批量调用；没有就把 prompt 整理成可逐条粘贴的清单交用户去 ChatGPT/即梦/Midjourney 手动生成。每个资产出 2~4 版，按下方「初筛核对清单」做第一轮筛选，产出放 `assets/illustrations/raw/`（PNG 原图，不进 git——.gitignore 已有约定后补） |
| **用户** | 终审：样张并排看，判「换画师」感；吉祥物三选一 |
| **cc** | 质感层全部代码（字体/歪框/纸纹/rough.js，M39）；资产接入管线（webp 压缩、懒加载、emoji 回退，M42）；样张的卡片嵌入演示（M43）；风格锁若两轮跑不齐，回 cc 重新定锁 |

## 风格锁（每条 prompt 的固定前缀，一字不改）

```
Children's picture-book style hand-drawn illustration. Colored pencil with soft
watercolor wash. Warm light pastel palette: sky blue #bfe6f7, cream #fff2df,
coral #ff8f6b, teal #43c1c1, amber #f6b93b; all outlines in soft navy ink
#37485a (never pure black). Wobbly, uneven hand-drawn outlines of varying
thickness. Subtle paper grain texture. Generous negative space. Flat, naive
perspective with childlike charm. No text, no watermark, no photorealism,
no 3D render, no gradient shading, no dark or neon colors.
```

一致性技巧（codex 执行时遵守）：
- 同一会话内连续生成；首张通过的图作为风格参照（image reference）喂给后续每张
- 每张只改「主体描述」段，风格锁前缀一字不动
- 每生成 3~4 张，抽一张与基准并排自检一次

## M42 装饰位资产（排期靠前）

### A1 扭蛋机主视觉 `gacha-machine`（1024×1024，奶油底）

> 风格锁 +

```
A cute retro capsule-toy machine (gashapon) with a big glass dome filled with
tiny colorful travel-themed capsules — inside some capsules peek miniature
landmarks: a tiny pagoda, a little snowy mountain, a hot-air balloon, a small
train. Red coin slot and an oversized turning knob. The machine stands on a
small grassy mound with two tiny flowers. Single object, centered, plain
cream background (#fff8ec).
```

### A2 吉祥物（三选一，1024×1024，奶油底，全身、居中、单角色）

> 风格锁 + 各变体：

- **v1 背包水豚**
  ```
  A round, chubby capybara wearing a tiny yellow bucket hat and a small red
  backpack, holding an unfolded paper map, cheerful sleepy smile, standing
  upright, full body, single character, centered, plain cream background.
  ```
- **v2 渔夫帽柴犬**
  ```
  A plump shiba inu wearing a teal fisherman hat and a tiny camera on a strap
  around its neck, one paw raised as if hailing a train, happy squinting eyes,
  full body, single character, centered, plain cream background.
  ```
- **v3 拖行李箱企鹅**
  ```
  A small round penguin pulling an amber vintage suitcase on wheels, wearing a
  coral scarf, waddling pose, determined cute expression, full body, single
  character, centered, plain cream background.
  ```

### A3 空态插画 `empty-state`（1024×1024，奶油底；**必须在吉祥物选定后、引用其通过图生成**）

> 风格锁 + 已选吉祥物参照图 +

```
The same mascot character sitting on the ground, peering into an empty
upside-down capsule shell with a puzzled expression, a small hand-drawn
question mark doodle floating above its head, plain cream background.
```

### A4 九大区题头涂鸦（第二批，吉祥物与样张定稿后再开；1024×512 横幅，透明底优先）

每区一条小景 prompt（风格锁 + 主体，物件 2~3 个、极简）：

| 区 | 主体描述（英文入 prompt） |
|----|--------------------------|
| 江浙沪 | a small arched stone bridge over water, a black-awning wooden boat, one willow branch |
| 华东 | white Huizhou-style houses with horse-head gable walls, a low green tea hill |
| 华北 | a red city-gate tower with a golden roof, one roundish persimmon tree |
| 东北 | a snow-covered wooden cabin with warm window light, two snowy fir trees |
| 西北 | two camels walking over a sand dune, a tiny crescent-shaped oasis pond |
| 华中 | a tall red-cliff gorge with a small boat on a green river |
| 华南 | an arcade-house street corner (qilou) with a banyan tree, a bowl of steaming food on a small table |
| 西南 | a snowy peak behind terraced rice fields, one tiny prayer-flag string |
| 港澳 | a red vintage tram and a glowing neon-free hand-painted signboard street corner |

## M43 目的地插画样例（本阶段必交付；1536×1024 横图=卡片顶部横幅比例）

三张跨地貌样张，专测风格锁在不同地貌下是否稳得住：

- **S1 杭州（水乡湖景）** — 风格锁 +
  ```
  West Lake in early morning: a gentle stone arch bridge over calm pale-blue
  water, a distant slim pagoda on a soft green hill, weeping willow branches
  framing one corner, a tiny rowing boat with no people, thin morning mist.
  Wide horizontal composition, lots of calm water and sky.
  ```
- **S2 敦煌（西北大漠）** — 风格锁 +
  ```
  Dunhuang desert scene: smooth amber sand dunes with a small camel caravan
  (three camels) walking along the ridge, a tiny crescent lake with a small
  pavilion at the dune's foot, distant honeycomb cave grottoes carved in a
  pale cliff. Warm late-afternoon light. Wide horizontal composition.
  ```
- **S3 三亚（热带海岛）** — 风格锁 +
  ```
  Tropical island beach: two leaning coconut palms on pale sand, clear
  turquoise shallow water with gentle wobbly wave lines, a small white
  sailboat on the horizon, a few seashells and one starfish in the sand
  corner. Bright soft daylight. Wide horizontal composition.
  ```

**样例验收流程**：三张并排 + cc 做一张真实卡片嵌入演示 → 用户终审。判据（design「一致性判据」）：线条粗细、上色方式、饱和度一致，无「换画师」感。通过 → 风格锁冻结进 design，M44 铺量复用；不过 → codex 调锁重跑（最多两轮，两轮不齐回 cc 重新定锁再议）。

## 初筛核对清单（codex 每张图过一遍）

- [ ] 无任何文字/水印/签名
- [ ] 轮廓是柔和藏蓝（≈#37485a），不是纯黑硬线
- [ ] 无照片感/3D 渲染感/渐变高光
- [ ] 饱和度与色相落在色板附近（对照风格锁五色）
- [ ] 底色干净（奶油底均匀 / 透明底无杂边），主体居中完整不出血
- [ ] 与基准图并排看，笔触密度接近

## 交付规范

- 文件名：`gacha-machine-v{n}.png` / `mascot-{capybara|shiba|penguin}-v{n}.png` / `empty-state-v{n}.png` / `region-{jzh|huadong|huabei|dongbei|xibei|huazhong|huanan|xinan|gangao}-v{n}.png` / `dest-{hangzhou|dunhuang|sanya}-v{n}.png`
- 原图 PNG ≥1024px 放 `assets/illustrations/raw/`（不进 git）；用户终审通过的版本由 cc 压缩为 webp 入库（尺寸/体积上限见 design 资产规范）
