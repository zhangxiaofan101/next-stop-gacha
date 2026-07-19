# 插画工单 — 手绘风资产（M42 装饰位 / M43 目的地样例）

> 工单文档（work order）：分工、风格锁、逐资产 prompt、验收标准。消费完毕后随阶段封板归档。规范类内容（资产格式/回退/一致性判据）以 design.md「手绘视觉系统」为准，本文件不重复。

## 分工

| 谁 | 干什么 |
|----|--------|
| **codex（文生图轨道）** | 按本工单的风格锁+prompt 生成图像。优先用 Codex built-in imagegen；不可用时才降级为整理可逐条粘贴的 prompt 清单交用户手动生成。每个资产出 2~4 版，按下方「初筛核对清单」做第一轮筛选，产出放 `assets/illustrations/raw/`（PNG 原图，不进 git；目录结构与流转规则见 `assets/illustrations/README.md`） |
| **用户** | 终审：三地样张并排判「换画师」感；复核咔啦身份延续与 A3/A4 最终资产 |
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
landmarks: a tiny pagoda, a small cluster of layered Huangshan-style granite
peaks with one crooked pine, a hot-air balloon, a small train. The mountain
silhouette must be asymmetric, with no isolated cone, volcano shape, or
Fuji-like snow cap. Red coin slot and an oversized turning knob. The machine
stands on a small grassy mound with two tiny flowers. Single object, centered,
plain cream background (#fff8ec).
```

### A2 吉祥物 `mascot`（已拍板：水豚；1024×1024，奶油底，全身、居中、单角色）

**原创性红线（用户要求：不得与现有水豚 IP 冲突）**：不得出现**头顶柑橘/柚子**、**嘴叼草**、**温泉毛巾/温泉场景**——这三类是已知水豚形象（カピバラさん Kapibara-san、"橘子头温泉水豚" meme 一族）的标志元素，prompt 里已显式排除，初筛必查。本角色的固定辨识三件套＝**黄色渔夫帽 + 红色小背包 + 摊开的纸地图**。

> 风格锁 +

```
An original capybara character design, not based on any existing mascot or
brand character. A round, chubby capybara wearing a tiny yellow bucket hat
and a small red backpack, holding an unfolded paper map, cheerful sleepy
smile, standing upright, full body, single character, centered, plain cream
background. No fruit or objects on top of the head, no grass in the mouth,
no towel, no hot-spring elements.
```

生成 3~4 版供用户挑体型/表情；通过版即全站唯一角色，header/空态/后续引导气泡复用。

### A3 空态插画 `empty-state`（1024×1024，奶油底；**必须引用 A2 通过图生成，保证是同一只**）

> 风格锁 + A2 通过图参照 +

```
The same original capybara mascot character from the reference image sitting
on the ground, peering into an empty upside-down capsule shell with a puzzled
expression, a small hand-drawn question mark doodle floating above its head,
plain cream background. Preserve the exact facial proportions, fur colors,
yellow bucket hat, red backpack, and soft navy outlines from the reference;
place its folded paper map beside it. No fruit or objects on top of the head,
no grass in the mouth, no towel, no hot-spring elements, and no resemblance
to any existing mascot or brand character.
```

### A4 九大区题头涂鸦（第二批，吉祥物与样张定稿后再开；1024×512 横幅，透明底优先）

实际生成统一引用 `dest-hangzhou-v1.png` **只作画风参照**，并在风格锁后追加以下公共 prompt；本批为避免水彩细枝叶抠图杂边，采用 design 允许的均匀奶油底而非透明底：

```
Use input image 1 as a STYLE REFERENCE ONLY. Do not copy its West Lake bridge,
boat, willow arrangement, composition, or exact objects.

Create one minimal Chinese region-heading decorative doodle containing ONLY
the described 2–3 objects. Plain uniform cream background #fff8ec. Centered
compact cluster in a wide 2:1 banner composition with generous horizontal
margins and breathing room. No words, letters, numbers, logos, emblems,
signatures, frames, borders, maps, or extra landmarks. Keep every object fully
inside the canvas. Create at 1024×512 or larger.
```

每区一条小景主体 prompt（风格锁 + 上述公共 prompt + 主体，物件 2~3 个、极简）：

| 区 | 主体描述（英文入 prompt） |
|----|--------------------------|
| 江浙沪 | a small arched stone bridge over water, a black-awning wooden boat, one willow branch |
| 华东 | white Huizhou-style houses with horse-head gable walls, a low green tea hill |
| 华北 | a red city-gate tower with a golden roof, one roundish persimmon tree |
| 东北 | a snow-covered wooden cabin with warm window light, two snowy fir trees |
| 西北 | two camels walking over a sand dune, a tiny crescent-shaped oasis pond |
| 华中 | a tall red-cliff gorge with a small boat on a green river |
| 华南 | an arcade-house street corner (qilou) with a banyan tree, a bowl of steaming food on a small table |
| 西南 | an asymmetric multi-ridge snowy mountain behind terraced rice fields, one tiny string of plain unlettered prayer-flag shapes; no isolated symmetrical cone, volcano, or Fuji-like silhouette |
| 港澳 | a red vintage tram and a generic street corner with a blank hand-painted signboard; absolutely no lettering, symbols, neon, branding, or famous building |

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

## A6 山水皮肤固定资产批（M46 消费；2026-07-19 皮肤化拍板后首个皮肤资产批）

> 方向参照=用户已认可的水墨整页 mock（codex 自产）。**开批第一步：把该 mock 原图存为 `raw/ink/style-ref-mock.png`**，后续每张生成都以它为 image reference（挑版时 cc 转 webp 入 `picked/ink/` 永久锚定）；下述风格锁批内一字不改。产出进 **`assets/illustrations/raw/ink/`**（QA 总览进 `raw/ink/qa/`；结构见 assets/illustrations/README.md），等用户挑版，挑版后 cc 转 `picked/ink/` 接入。

水墨风格锁（每条 prompt 固定前缀；口径=**水墨淡彩**，与 mock 校准——mock 实际是墨骨+克制淡彩，非严格双色）：

```
Traditional Chinese ink wash painting (shuimo) style with restrained light
color washes (dancai). Xuan rice-paper cream background (#faf3e3) with subtle
fiber texture. Expressive charcoal-black brush strokes with natural dry-brush
breaks and five-tone ink gradation; large deliberate blank space (liubai).
Ink dominates every composition; only sparing muted washes are allowed: pale
indigo #7ba7c9, soft tea-green, warm ochre sand, and small vermilion #e85d3d
accents. Asymmetric poetic composition. No text, no watermark, no
photorealism, no 3D render, no bright saturated colors, no thick uniform
cartoon outlines.
```

资产清单（文件名 `ink-` 前缀）：

- `ink-mascot-v{n}.png`（1024×1024，2~4 版）——咔啦水墨版：写意萌物笔法；**角色参照=咔啦水彩通过版（`raw/journal/mascot-capybara-v4.png`），mock 只作风格参照不作角色参照**——mock 里那只形象偏猪，必须画回水豚（方吻、小圆耳贴头、憨圆身形）；身份三件套不变（黄渔夫帽/红背包/纸地图，淡彩点染）；IP 红线照旧（无头顶柑橘/叼草/温泉毛巾）；「圆形墨圈内」构图可出一版
- `ink-gacha-v{n}.png`（1024×1024，2 版）——扭蛋机水墨版：主体 prompt 同 A1（非对称山形红线照旧），末句 grassy mound 改为留白
- `ink-empty-v{n}.png`（1024×1024，2 版）——空态：引用 `ink-mascot` 通过版，场景同 A3
- `ink-region-{jzh|huadong|huabei|dongbei|xibei|huazhong|huanan|xinan|gangao}-v{n}.png`（1024×512，各 2 版）——九区题头：主体同 A4 各区描述 + A4 公共 prompt（底色改宣纸 #faf3e3），水墨笔法重出
- `ink-decor-{willow|bamboo|hill}-v{n}.png`（横幅或方形，各 2 版）——页面装饰件：柳桥小景 / 竹枝 / 淡墨远山；透明底优先，杂边明显则宣纸底
- 印章、朱红点缀、抖动分隔线由 cc 侧 CSS/SVG 自绘，不占本批

初筛照用下方核对清单，另加三条：①**墨为骨、淡彩为饰**（靛蓝/茶绿/赭黄/朱红点缀），第一眼仍读作水墨而非水彩；②与 `style-ref-mock` 并排看笔触/留白/色量一致，无「换画师」感；③吉祥物必须是水豚咔啦，不得跟着 mock 跑成猪/熊脸。

标题字不出图像资产：山水皮肤标题用毛笔字体（Ma Shan Zheng 档，可商用开源），保持文字可选中可访问。

## A7 青花皮肤资产批（P2 预置——锁文本已按用户认可的青花整页 mock 锚定，开批时直接用）

> 方向参照=用户已认可的青花瓷整页 mock（codex 自产）。开批第一步：把 mock 原图存为 `raw/porcelain/style-ref-mock.png`，后续每张以它为 image reference。

青花风格锁（每条 prompt 固定前缀）：

```
Blue-and-white porcelain (qinghua) underglaze painting style. Soft
porcelain-white background (#f7f5ef) with a faint glaze sheen. ALL linework,
shading and washes in cobalt blue ONLY (#2b4d9e family) — strict one-color
cobalt monochrome with tonal gradation like underglaze painting; fine, even,
delicate outlines with dense detailed shading (finer and denser than ink-wash
brushwork). Ornate qinghua scroll-cloud-floral motifs may frame the corners.
No other colors, no text, no watermark, no photorealism, no 3D render.
```

资产清单同 A6 结构（`qh-` 前缀，产出进 `raw/porcelain/`）：mascot（**角色参照=咔啦通过版**，通体钴蓝但保持水豚特征与三件套形状——mock 中的熊形象不作角色参照）/ gacha / empty / region ×9 / decor（缠枝莲角饰/云纹/青花浪纹）。朱红元素（抽一个/印章/热门徽章）是 UI chrome，由 cc 侧 CSS 承担，**资产内不得出现红色**。

## 初筛核对清单（codex 每张图过一遍）

- [ ] 无任何文字/水印/签名
- [ ] 轮廓是柔和藏蓝（≈#37485a），不是纯黑硬线
- [ ] 无照片感/3D 渲染感/渐变高光
- [ ] 饱和度与色相落在色板附近（对照风格锁五色）
- [ ] 底色干净（奶油底均匀 / 透明底无杂边），主体居中完整不出血
- [ ] 与基准图并排看，笔触密度接近
- [ ] 吉祥物类资产：无头顶柑橘/叼草/温泉毛巾等既有水豚 IP 标志元素；辨识三件套（黄渔夫帽/红背包/纸地图）齐全

## 交付规范

- 文件名：`gacha-machine-v{n}.png` / `mascot-capybara-v{n}.png` / `empty-state-v{n}.png` / `region-{jzh|huadong|huabei|dongbei|xibei|huazhong|huanan|xinan|gangao}-v{n}.png` / `dest-{hangzhou|dunhuang|sanya}-v{n}.png`
- 原图 PNG ≥1024px 放 `assets/illustrations/raw/<皮肤id>/`（不进 git；水彩批=`raw/journal/`，山水批=`raw/ink/`）；用户终审通过的版本由 cc 转 q90 webp 存 `assets/illustrations/picked/<皮肤id>/`（进 git 的压缩母版），接入时再产出各装饰位小尺寸版本（尺寸/体积上限见 design 资产规范）
