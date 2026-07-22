# 插画轨道工单 — 皮肤资产 & 目的地共享集

> 双层结构：**常驻规矩**（分工 / 通用一致性技巧 / 皮肤资产成套清单 / 初筛核对清单 / 交付规范——长期有效，规矩变了先改这里再开批；本次规整后集中在前半部）＋**批工单**（M42/M43/M44/A6–A9 各节，按批次时序排在后半部——消费完毕随阶段封板归档，已收官批只留结果记录与留档 prompt）。规范类内容（画布契约/资产规范/回退/一致性判据）以 design.md「主题皮肤系统」为准，本文件不重复。姊妹规程：内容质检=`.agent/content-checklist.md`。

## 分工

| 谁 | 干什么 |
|----|--------|
| **codex（文生图轨道）** | 按各批工单的风格锁+prompt 生成图像。优先用 Codex built-in imagegen；不可用时才降级为整理可逐条粘贴的 prompt 清单交用户手动生成。皮肤件每资产出 2~4 版（**mascot-cutout=基于终审整版只出 1 版**；**dest 共享集=每城只画 1 版**，见 M44 节），按「初筛核对清单」做第一轮筛选，产出放 `assets/illustrations/raw/<目录>/`（PNG 原图，不进 git；目录结构与流转规则见 `assets/illustrations/README.md`） |
| **用户** | 终审挑版：并排判「换画师」感、角色身份、城市辨识度；✗ 的带意见要求补画（一次补 1 版） |
| **cc** | 终审通过版转档入 `picked/`（cwebp `-q 90`；⚠️ macOS `sips` 声称支持 webp 实则写不出，勿用）；M42 管线出装饰位小图与代码接入；初筛复核与风格锁维护（两轮跑不齐回 cc 重新定锁） |

## 通用一致性技巧（所有批次遵守）

- 同一会话内连续生成；首张通过的图（皮肤批=style-ref-mock）作为风格参照（image reference）喂给后续每张
- 每张只改「主体描述」段，风格锁前缀一字不动
- 每生成 3~4 张，抽一张与基准并排自检一次
- 任一批与基准/mock 并排出现「换画师」感即**停批报告**，不硬画完；换模型/参数须先重画一张基准比对，通过才继续
- 每批出 QA 总览网格（基准/mock 置首行）+ notes 记录批号/起止/淘汰理由，停下等用户挑版——**画不等接入**

## 皮肤资产成套清单（造一套新皮肤要画什么 · 常驻规矩，2026-07-20 立册）

> **常驻清单，非一次性工单**：每开一个新皮肤资产批（A6/A7/A8…）按此列画单；规矩变了先改这里再开批。
> 机制与画布契约的规范原文以 design「主题皮肤系统·插画层」为准，本节管「画什么、怎么开批、怎么过筛」。
> 立册背景（2026-07-20 用户拍板）：M52 用 CSS/SVG 模拟印章、抖动边线、纸纹后确认这三类已到代码上限
> （能用、不惊艳）——**工艺件自此入画**；A6 时期「印章/分隔线由 cc 侧 CSS 自绘」的口径向后作废
> （已收官批次记录不回改）。

### 第 0 件 · 整页 mock（风格基准，必须最先）

codex 整页 mock → 用户认可 → 存 `raw/<id>/style-ref-mock.png` → 风格锁按 mock 校准预置。
**没有用户认可的 mock 不开批**（2026-07-20 皮肤画风基准约定）。mock 只锚风格、不锚角色。

### 第一层 · 主题插画件（画「画面」，7~15 个版位）

| 槽位 | 画布 | 版数 | 要点 |
|---|---|---|---|
| mascot（整版） | 1024×1024 | 2~4 | 角色参照=咔啦通过版（mock 不作角色参照）；三件套形状恒定、颜色随皮肤语言；IP 红线照旧；可含本皮肤语言的圆框/底饰 |
| mascot-cutout | 1024×1024 透明底 | 1 | **常驻双版之二（2026-07-21 立册；每皮肤 mascot 必出两版=整版+cutout）**：整版终审后补画——只保留主体（帽/包/地图齐全），无圆框/花边/地面阴影，透明底无杂边；以整版通过图锁角色重出（键控去背须查残色边）；叠放场景专用（design M64），缺图回退整版或隐藏形态 |
| gacha | 1024×1024 | 2 | 扭蛋机主视觉；非对称构图红线照旧 |
| empty | 1024×1024 | 2 | 必须引用本皮肤 mascot 通过版生成，保证同一只 |
| decor ×2~3 | 画幅不拘 | 各 2 | 自由浮动装饰件，母题随皮肤自选（山水=柳桥/竹枝/远山，青花=缠枝莲/云纹…）；透明底优先 |

> **不随皮肤画的版位**：九区题头归共享题头层（M60 起皮肤无关，全皮肤共用 A6 水墨九张 `region-<slug>`；手帐水彩九张已转素材库存档）；目的地共享集同为皮肤无关（M44 节）。皮肤画单不再含这两类。

### 第二层 · 工艺件（M52 后新增；画的是界面「材质」——笔触与质地本身，不是画面）

| 槽位 | 画布 | 版数 | 要点 |
|---|---|---|---|
| texture（底材纹理） | 512×512 **无缝** | 2 | 平铺无可辨重复母题；近底色低对比（叠加 opacity ≤.06 量级仍读得出质感） |
| seal（印章/徽记，可选） | 256×256，2~3 枚 | 每枚 3+ | 皮肤有印章语言才画（山水有并已入画；青花 A7 拍板不画——朱红印章归 UI chrome/CSS，资产保持钴蓝单色；奶油无）；**风格锁「No text」对本槽位开例外**——印文是主体不是水印；文生图汉字保真差：垫真实印蜕做 image reference、逐字核对无错字缺笔，保不住字形就保留代码版 |
| placeholder（图位垫底，可选） | 960×480 | 2 | 比 decor 更淡更空的氛围底，图位加载期/缺省垫底，不与正式插画抢戏 |

> **frame/divider 不设槽位**（2026-07-21 实证撤销）：发丝级母版压到接入尺寸后与纯色边框/CSS 虚线无肉眼差（M59 ②⑧），**代码版即正式样式**；山水已画两件留用不删、消费点照旧。将来重拾前提=先重画抗压缩母版（框线 12px+ 粗、分隔线均匀中段构图）并过拉伸预演再立项。

### 第三层 · 不入画清单（永远代码，别画）

功能图标（16px 锐利 + currentColor 随皮肤取色，图片做不到）；一切带文字的按钮与交互态（文字烤进图=锁死文案和 hover/按压/禁用）；chip/badge/选中态（尺寸随内容伸缩、状态组合多）；标题字（用字体，保可选中可访问）。

### 开批规矩

1. 批号 A{n} 顺延；产出 `raw/<皮肤id>/`、QA 进 `raw/<皮肤id>/qa/`；命名 `<皮肤id>-<slot>-v{n}.png`；
2. 风格锁前缀批内一字不改；首张通过图作 image reference 传染全批；
3. 初筛=「初筛核对清单」+ 该皮肤加严条款（各批自定）；**工艺件另过两项**：texture 2×2 拼贴自检无缝、seal 逐字核对（frame/divider 撤出成套清单后，拉伸预演项随之退役）；
4. 用户终审 → cc 转 q90 webp 入 `picked/<皮肤id>/` → M42 管线出装饰位小图（≤60KB）；**画不等接入**，接入随代码小项按批换上；
5. 目的地共享集（dest）皮肤无关，不在本清单内（见 M44 节）。

## 初筛核对清单（codex 每张图过一遍）

- [ ] 无任何文字/水印/签名
- [ ] 轮廓/笔触色符合该批风格锁（水彩=柔和藏蓝 ≈#37485a 非纯黑；水墨=炭黑墨；青花=钴蓝单色）
- [ ] 无照片感/3D 渲染感/渐变高光
- [ ] 饱和度与色相落在该批风格锁色板附近
- [ ] 底色干净（奶油底均匀 / 透明底无杂边），主体居中完整不出血
- [ ] 与基准图并排看，笔触密度接近
- [ ] 吉祥物类资产：无头顶柑橘/叼草/温泉毛巾等既有水豚 IP 标志元素；辨识三件套（黄渔夫帽/红背包/纸地图）齐全
- [ ] cutout 变体：透明底无杂边、无键控残色；无框/花边/地面阴影；主体与三件套完整不缺切
- [ ] 横幅资产（题头/装饰）：主体集中在垂直中央约 2/3——接入位可能比生成画布更浅，上下各 1/6 须经得起裁切（构图安全区，2026-07-20 起全皮肤生效）

## 交付规范

- 文件名：皮肤批=`<皮肤id>-<slot>-v{n}.png`（开批规矩①；历史水彩首批 A1–A4 为无前缀命名，收官记录不回改）；raw 批允许简写前缀（如青花批 `qh-`），**转 picked 时统一为 `<皮肤id>-<slot>.webp`**（如 `qh-mascot-cutout-v1.png` → `porcelain-mascot-cutout.webp`）；目的地共享集=`dest-<cityid>-v{n}.png`（cityid 与 data 记录一字不差）；共享九区题头=`region-<slug>` 系 A6 水墨版转档产物（M60 后不再按皮肤新画）
- 原图 PNG ≥1024px 放 `assets/illustrations/raw/<皮肤id>/`（不进 git；水彩批=`raw/journal/`，山水批=`raw/ink/`）；用户终审通过的版本由 cc 转 q90 webp 存 `assets/illustrations/picked/<皮肤id>/`（进 git 的压缩母版），**cutout 等透明底槽位转档保留 alpha**；接入时再产出各装饰位小尺寸版本（尺寸/体积上限见 design 资产规范）
- **picked/ 纪律：只收用户终审定案**——终审前不转档、不接入（曾有一次抢跑转档被回滚的先例）；转 picked 时命名去 `-v{n}` 后缀；比稿/复议期间相应 picked 目录保持原状不动
- **同一母题双版都通过时**（如 M62 doodle 的 decor town/plants/travel 各出两版、六张全部终审通过，非「挑一留一」）：转 picked 不再是单纯去 `-v{n}`，改**去 `v` 前缀留数字**（`doodle-decor-town-v1.png`/`-v2.png` → `doodle-decor-town-1.webp`/`-2.webp`），两版作为两个独立槽位永久共存，接入时按需挑选启用哪个/哪几个（build_illustrations.py 的 `decor-<name>` 归类对任意后缀通用，不用改代码）

---

# 批工单 / 批记录（时序）

## M42 装饰位资产 · 水彩首批 A1–A4（已生成初筛完毕，归手帐皮肤素材库，终审挂 P2 M39；prompts 留档供补画）

### 手帐（水彩绘本）风格锁——现仅手帐皮肤件专用（曾为全局锁；共享集用 B 锁、山水用水墨锁，正文见 design「已冻结风格锁」与各批节）

```
Children's picture-book style hand-drawn illustration. Colored pencil with soft
watercolor wash. Warm light pastel palette: sky blue #bfe6f7, cream #fff2df,
coral #ff8f6b, teal #43c1c1, amber #f6b93b; all outlines in soft navy ink
#37485a (never pure black). Wobbly, uneven hand-drawn outlines of varying
thickness. Subtle paper grain texture. Generous negative space. Flat, naive
perspective with childlike charm. No text, no watermark, no photorealism,
no 3D render, no gradient shading, no dark or neon colors.
```

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

### A4 九大区题头涂鸦（第二批；1024×512 横幅。九区题头已 M60 晋升共享层不再按皮肤画——本节九区主体描述表仍是共享九张日后返工/补画时的母题源，留档）

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

## M43 目的地插画样例（已消费：三样张终审成为 M44 batch 0 基准；prompts 留档；1536×1024 横图=卡片顶部横幅比例）

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

## M44 目的地插画分批铺量（皮肤无关共享集；codex 长期分批任务）

> **这是本工单的完整约束，开工前通读；每批开工时重读「每批流程」。**
> 目的地插画**不属于任何皮肤**——全皮肤共用一套，接入时嵌白框（风格隔离舱，见 design「主题皮肤系统·成本模型」）。产出进 **`raw/dest/`**（QA 进 `raw/dest/qa/`），不进任何 `raw/<皮肤id>/`。

**前置（batch 0，一次性）**：~~用户终审 M43 三样张~~ 2026-07-20 完成（杭州v2/敦煌v2/三亚v1 → `picked/dest/`）。**同日用户复议共享集画风（batch 1 挂起）**：四个心头好皮肤（水墨/水彩/青花/doodle）三素一甜，现行绘本水彩锁只服务甜端——启动候选比稿，拍板前不开 batch 1。

**画风候选比稿（已拍板：B 胜出，2026-07-20）**：codex 按 B 锁重画三样张，用户看图直接终审通过（「超级好看」）；cc 已转 `picked/dest/` 新基准三张、B 锁冻结晋升 design。比稿关闭，batch 1 解锁。

- 候选 A=现行绘本水彩锁（样例=`raw/dest/` 杭州v2/敦煌v2/三亚v1；原 picked/dest/ 转档已回滚删除，比稿胜者出炉前 picked/dest/ 保持为空）
- 候选 B=**墨线淡彩旅行速写**（三素皮肤的重心点），锁文本：

```
Travel journal ink-and-wash sketch. Expressive dark sepia-ink linework with
lively, slightly wobbly strokes on warm off-white paper (#faf6ec) with subtle
grain; loose sketchbook feel — the drawing fades out before reaching the
paper's edge. Muted transparent watercolor washes applied loosely, sometimes
slightly outside the lines: dusty blue, tea green, warm ochre, soft brick red;
low saturation, no candy pastels. Generous white paper left showing. A page
from a seasoned traveler's sketchbook. No text, no watermark, no
photorealism, no 3D render, no bright saturated colors, no thick uniform
cartoon outlines.
```

**恒定规则（每张都适用）**：

- **风格锁**：「墨线淡彩旅行速写」锁（B 胜出已冻结，正文见 design「已冻结风格锁·目的地共享集」，与下方候选 B 原文同文）一字不改；每张生成以 `picked/dest/` 基准三张为 image reference。⚠️ 手帐水彩绘本锁自此只属手帐皮肤件（正文见 M42 节），与共享集无关
- **画布**：1536×1024（3:2 横图，卡片顶部横幅比例）；**构图安全区=垂直中央约 2/3**（接入位可能裁浅）
- **命名**：`dest-<cityid>-v{n}.png`，cityid=data 六区文件里该城市记录的 `id`，一字不差（cc 接入按 id 对号）
- **每城一句 subject**：由该城数据卡的景观意象自拟（参照 M43 三句的句式：场景 + 2~3 个具体元素 + 构图提示），画**标志景观**不画美食/人物近景（远景点缀小人/小船可以）；地标做手绘意象化，不照片复刻
- **城市辨识度 prompt 硬闸（2026-07-20 用户纠偏）**：写 subject 前先读该城市记录的 `tagline / architecture / highlights`，再给同批城市做一张“视觉母题分配表”。每城必须指定：①一个**独占主角**（地标、地貌或空间类型）；②两个只为该城服务的辅助线索；③明确列出同批禁用元素。只写泛称“江南水乡 / 湖光山色 / 古塔小舟”视为 prompt 不合格，不得开画
- **同区域去同质化**：相邻批优先按区域或易混母题成簇质检，但同批不得复用相同构图骨架。尤其 `水面 + 小船 + 塔/亭 + 远山` 只允许杭州基准承担；其他城市即使真实存在这些元素，也必须换主角、视点或空间结构。水面和小船只能作为城市资料明确支持的辅助线索，且同批最多连续两张出现；塔/亭不是“江浙沪默认装饰”，未被该城独占母题点名时删除。**建筑类别本身不算撞型**：朱红墙、城门洞、歇山顶、飞檐、寺塔、亭阁等全国性传统构件不得单独触发返工；若画面对应数据卡点名的当地真实地标，且主体形制与空间关系足以辨认，就按地方特色放行。只有无资料出处的通用门楼/小庙/小阁，或把当地地标形制画错、仍靠通用骨架冒充辨识度，才记为问题
- **生成 prompt 固定增补段**（接在 subject 后、红线前）：`City identity is the priority. This must not read as a generic Jiangnan lake scene. Use <独占主角> as the unmistakable focal subject, supported by <线索1> and <线索2>. Composition skeleton: <该城独有构图>. Explicitly avoid <同批禁用元素>; do not borrow Hangzhou's lake + small boat + pagoda/pavilion + distant-hills composition.` 其中尖括号每城必须填实，不得原样保留
- **区域完成后的回看闸**：一个区域/易混母题簇画完后，把本轮 raw 与该簇已有 `picked/dest/` 一起放进 QA 总览复查。picked 仍是“默认永久跳过”，但若用户点名或并排检查确认与同簇撞母题，可只生成更高 `v{n}` 的替代候选；用户终审前不得覆盖 picked。复查结论须逐张记录“保留 / 返工 + 撞了什么”，不能只查文字和安全区
- **只画城市记录**：含 `stops` 的线路记录一律不画（届时另议）
- **红线**：无文字/水印/签名；无照片感/3D；无国界地图元素；初筛核对清单每张过一遍

**分批节奏（用户口径：10~20 张/批，方便质检）**：

- **batch 1 = 10 城试跑**（校准命中率），此后 **20 城/批**；顺序=按 data 六区文件顺序推进，每批记录起止 id
- **开批去重（硬闸）**：按上述顺序取记录前，先扫描 `picked/dest/dest-<cityid>.webp`；已存在即视为用户通过版，**永久跳过、不生成、不占本批名额**，继续向后补足本批 20 个未入选 cityid。QA notes 须记录本批起止 id 与跳过清单；不得因记录仍出现在 data 文件里而重画
- **去重例外只有一种**：用户明确点名复查/替换某个 picked，或“区域完成后的回看闸”确认它撞母题；此时旧 picked 原位保留，新图只进 raw、版本号递增，待用户再次终审后才替换。未进入这份返工清单的 picked 仍永久跳过
- 每城**只画 1 版**（用户终审口径 2026-07-20），不出双版挑选；用户打 ✗ 的城带其意见**补画 1 版**并入下一批
- **每批流程**：①逐张过初筛清单 → ②出该批 QA 总览网格图 `raw/dest/qa/qa-m44-b{n}.png`（**基准三张放首行**，供并排防漂移比对）→ ③初筛记录追加到 `raw/dest/qa/qa-m44-notes.md`（批号/起止/淘汰与理由/谨慎候选）→ ④停下等用户挑版 → ⑤cc 把通过版转 q90 webp 入 `picked/dest/`（命名去 `-v{n}`）
- **集中铺量例外（2026-07-20 用户拍板）**：batch 5 后改为连续生成多个 20 城批次，不再逐批等待；目标连同此前 44 张做到约 200 个唯一城市，再由用户看统一 QA 集中审。内部仍按 20 城出独立 QA、逐批初筛并记录淘汰；未经用户集中终审的候选一律留在 raw，不转 picked。本轮固定为 batch 6–11 共 120 城，完成后总唯一城市数 199，统一总览=`raw/dest/qa/qa-m44-total-199.png`。
- **QA 并排新增一轴**：除“同画师 / 文字 / 安全区”外，逐张检查“遮住文件名还能否凭主角认出该城”以及“与同区域任一张是否共享三项以上**具体空间关系**（例如同一视点下的开阔水面、前景小船、孤塔、远山层叠）”。朱红、飞檐、城门、塔、亭等单个建筑类别不计项；数据卡明确点名且形制可信的本地地标不因同类建筑多而返工。命中三项具体空间关系且当地地标仍不成主角时才返工，不以单张好看为放行理由
- **防漂移**：任一批与基准并排出现「换画师」感即停批报告，不硬画完；模型/参数换代必须先重画基准三张之一比对，通过才继续

### Batch 17 — M22 新增 13 城（2026-07-22，已终审转正）

- 数据差集只含 13 个新 cityid：`shanghai` / `baiyangdian` / `cuandixia-jingxi` / `fengning-bashang` / `zhangbei-caoyuantianlu` / `gubei-shuizhen` / `jinshanling-changcheng` / `jizhou-panshan` / `zunhua-qingdongling` / `laiyuan-baishishan` / `shidu` / `yesanpo` / `wulingshan-xinglong`；既有 282 个 picked 永久跳过、未重画未覆盖。
- 用户看 `qa-m44-b17.png` 与 `qa-m44-b17-huabei-cluster.png` 后确认全部通过；13 张 v1 已转 q90 WebP 入 `picked/dest/`，M42 管线同步生成 public 卡位产物。
- 全量结果：295/295 城同时具备 picked 母版和 public 产物；13 张新卡位均为 640×427、22.5–38.4KiB，未开 40KiB 预算例外；`build_illustrations.py` 零违规，资产门测试 23/23 通过。

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

初筛照用「初筛核对清单」，另加三条：①**墨为骨、淡彩为饰**（靛蓝/茶绿/赭黄/朱红点缀），第一眼仍读作水墨而非水彩；②与 `style-ref-mock` 并排看笔触/留白/色量一致，无「换画师」感；③吉祥物必须是水豚咔啦，不得跟着 mock 跑成猪/熊脸。

标题字不出图像资产：山水皮肤标题用毛笔字体（Ma Shan Zheng 档，可商用开源），保持文字可选中可访问。

### A6 挑版结果（2026-07-20 用户终审）与补画轮

通过 13 张 + style-ref 已由 cc 转 q90 webp 入 `picked/ink/`（命名去 -v 后缀）：mascot=v1、gacha=v1、empty=v2；region：华北v2 / 华东v1 / 江浙沪v1 / 华中v2 / 华南v1 / 西南v1 / 西北v2；decor：柳桥v1 / 竹枝v2 / 远山v1。

**补画 ×2**（风格锁与初筛加严三条照旧，仍以 `style-ref-mock` 为 image reference，产出进 `raw/ink/`，v 号接续）：

- `ink-region-dongbei-v3+`——以 **v1 为构图基准**重画：视野放宽（更远景），弱化/缩小屋舍，突出雪岭山体与林海层次——山与林是主角，房子只作点景
- `ink-region-gangao-v3+`——以 **v1 为构图基准**精简：街景附属细节做减法，保留天际线与海港意象，留白量向已通过的七张题头看齐（与 `picked/ink/` 并排自检）

补画已交付并终审（2026-07-20）：东北=v5、港澳=v5，cc 已转 `picked/ink/`——**A6 全批收官，16 张母版齐备**（题头槽位=原生 2:1 不浅裁 + 逐资产 focal 微调的接入口径见 design「装饰位画布契约」）。

**mascot-cutout 补件（2026-07-21，M64 用户终审通过）**：`ink-mascot-cutout-v1`——透明底 die-cut 变体（叠放场景专用，见 design M64「咔啦跨皮肤同一角色」与皮肤部件清单），cc 已转 q90 webp 入 `picked/ink/ink-mascot-cutout.webp`（保留 alpha），build_illustrations.py 新增同名槽位识别。其余皮肤按各自画风另出该变体，缺图回退整圆版或隐藏形态。

## A7 青花皮肤资产批（已收官——M61 消费，全部资产 2026-07-21 终审通过）

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

资产清单同 A6 结构（`qh-` 前缀，产出进 `raw/porcelain/`）：mascot（**角色参照=咔啦通过版**，通体钴蓝但保持水豚特征与三件套形状——mock 中的熊形象不作角色参照）/ gacha / empty / decor（缠枝莲角饰/云纹/青花浪纹）——region ×9 已删（M60 共享题头层承担，见成套清单注）。朱红元素（抽一个/印章/热门徽章）是 UI chrome，由 cc 侧 CSS 承担，**资产内不得出现红色**。

### A7 主题层首批（2026-07-21，主题层终审通过）

已按上述风格锁用 built-in imagegen 生成 12 张候选，均以 `raw/porcelain/style-ref-mock.png` 作画风参照；mascot 另以 `raw/journal/mascot-capybara-v4.png` 作角色参照，empty 再以本批 `qh-mascot-v1.png` 锁同一角色。候选位：mascot v1/v2、gacha v1/v2、empty v1/v2、decor-lotus/cloud/wave 各 v1/v2。原图留 `raw/porcelain/`，总览=`raw/porcelain/qa/qa-a7-theme-v1.png`。

初筛：全批为瓷白底 + 钴蓝单色，无红黄残留、文字、水印、照片感或 3D 感；咔啦仍可读为方吻小圆耳水豚，帽/包/地图三件套形状齐；两版扭蛋机均为非对称黄山群峰而非孤锥。谨慎项：empty v1 含直接问号图形，虽承接 A3 原 prompt，但按「不烤符号」的长期纪律优先推荐 empty v2。首轮推荐组合=`mascot v2 + gacha v2 + empty v2 + lotus v2 + cloud v2 + wave v2`（更轻、更适合 UI 留白）；v1 组保留作更繁密的瓷盘/器物感备选。

**用户终审拍板（2026-07-21）**：`mascot v1` / `gacha v2` / `empty v1` / `decor-lotus v2` / `decor-cloud v1` / `decor-wave v1`。empty v1 的直接问号图形随本次明确选择一并接受，不再作为待返工项。由 cc 按职责转 q90 WebP 入 `picked/porcelain/`；其余候选留 raw，不接入。

为验证目的地共享集只做整体调色是否够用，另对 picked 基准三张（杭州/敦煌/三亚）做了**仅 QA、不改母版**的瓷白→钴蓝亮度映射预演，总览=`raw/porcelain/qa/qa-dest-cobalt-map.png`。本批不转 `picked/`、不接代码；用户终审后再由 cc 转档并开青花声明/滤镜实验。第二层工艺件（texture/seal/placeholder——frame/divider 已撤出成套清单，见成套清单注）尚未开画，不阻塞本轮 dest 调色判断。

### A7 工艺件与 mascot-cutout 补件（2026-07-21，已终审收官）

承接用户「把剩下的组件画完」与上轮推荐方案：seal 不画（朱红印章继续归 UI chrome / CSS-SVG，资产保持钴蓝单色），frame/divider 按成套清单已撤；本批只画 texture、placeholder，并补 M64 叠放场景使用的透明 mascot-cutout。全部用 built-in imagegen，以 `style-ref-mock.png` 为画风参照；cutout 另以终审 `qh-mascot-v1.png` 锁角色，洋红键控后用官方 helper 去背。

- `qh-texture-glaze-v2.png` / `v3.png`——两张合格无缝釉纹候选；2×2 拼贴无肉眼接缝。初生 v1 因横向接缝淘汰、只留 raw 取证
- `qh-placeholder-mist-v1.png` / `v2.png`——两张 2:1 极淡图位垫底：v1=远山云水，v2=云浪浅滩；均不与正式目的地图抢视觉
- `qh-mascot-cutout-v1.png`——只保留青花咔啦本体（帽/包/地图齐全），无瓷盘圆框、花边、地面阴影；1254×1254 RGBA，透明角与主体边界通过检查，未检出洋红残边

终审总览=`raw/porcelain/qa/qa-a7-craft-v2.png`。

**用户终审拍板（2026-07-21）**：texture=v3、placeholder=v2、mascot-cutout=v1 全部通过。cc 已转 q90 WebP 入 `picked/porcelain/`（前缀统一皮肤 id：`porcelain-texture-glaze.webp` / `porcelain-placeholder-mist.webp` / `porcelain-mascot-cutout.webp`，cutout 保留 alpha），M61 已接入生产——A7 全批收官。

## A8 山水工艺件补画批（M52 后首个工艺件批；已收官——消费方 M57 已接入）

> 立项背景（2026-07-20 用户拍板「工艺件入画」）：M52 已用 CSS/SVG 把印章/抖动边线/纸纹顶到代码上限，按「皮肤资产成套清单」第二层补画。风格参照照旧=`picked/ink/style-ref-mock.webp`；风格锁=A6 水墨锁（**seal 槽位对 No text 开例外**）；产出进 `raw/ink/`，新槽位 v 号自 1 起。

- `ink-texture-paper-v{n}.png`（512×512 无缝，2 版）——宣纸纤维 tile：帘纹+细纤维絮，近 `#faf3e3` 低对比，**无墨点/母题**（它是纸不是画）；2×2 拼贴自检无缝
- `ink-frame-brush-v{n}.png`（1024×1024 空心矩形框，3 版）——手描墨线容器框：单线细墨、微起伏、干笔但**四边粗细均匀**、四角自然搭接不闭死；透明底，框线贴边 32~48px 内
- `ink-divider-brush-v{n}.png`（1024×32，2 版）——干笔横触分隔线：一笔到底、首尾收笔自然、中段飞白克制；透明底
- `ink-seal-nextstop-v{n}.png` / `ink-seal-wheretoplay-v{n}.png`（256×256，各 3+ 版）——白文印「下一站」/「去哪玩」：朱底白文（印泥色 `#c1502f` 家族）、篆意可放宽到隶意但**逐字可辨无错字缺笔**、边缘残破感、微不对称；垫真实印蜕做 image reference；连抽保不住字形即弃该槽位，保留现 SVG 代码版（M52 产物）
- `ink-placeholder-mist-v{n}.png`（960×480，2 版）——极淡墨远山霭：比 `ink-decor-hill` 更淡更空（墨量约其一半以内），无前景母题；作卡图/详情头图加载垫底

初筛：「初筛核对清单」 + A6 三条加严照旧 + 成套清单工艺件专项（当时为三项：无缝自检/拉伸预演/逐字核对）。

终审结果（2026-07-20 用户拍板）：`ink-texture-paper-v2` / `ink-frame-brush-v2` / `ink-divider-brush-v2` / `ink-seal-nextstop-v2` / `ink-seal-wheretoplay-v4` / `ink-placeholder-mist-v1`。六件已由 cc 转 q90 webp 入 `picked/ink/` 并经 M57 全部接入生产（frame/divider 后经 M59 ②⑧ 渲染参数校准）。**后记（2026-07-21 拍板）**：frame/divider 两槽位因隐形实证撤出成套清单——本批已画两件留用不删、消费点照旧，新皮肤不再画（详见成套清单注与 design「工艺件画布契约」）。

## A9 Doodle 皮肤主题层（2026-07-21，用户终审通过）

> 用户直接启动「画一下 doodle 的皮肤组件」。画风基准=`raw/doodle/style-ref-mock-v1.png`；mock 只锚画风，咔啦角色另以 `raw/journal/mascot-capybara-v4.png` 锚身份。候选只进 `raw/doodle/`，终审前不转 `picked/`、不接代码。九区题头由 M60 共享层承担，本批不重复画；文字/按钮/功能图标继续留给代码。

Doodle 风格锁（按已认可整页 mock 校准；本批每条 prompt 固定前缀）：

```
Warm ivory fibrous drawing paper. Predominantly deep charcoal-black fountain-
pen linework: thin, lively, imperfect and variable, with occasional doubled
strokes, tiny crosshatching and scribbled fill; spontaneous naive crooked
handmade charm. Sparse muted mustard-yellow and brick-red accents together
under 10% of the image. Generous ivory breathing room. No clean vector
precision, no watercolor, no marker rendering, no blue-and-white porcelain,
no screen-print halftone, no photorealism, no 3D render, no text, no watermark.
```

主题层首轮共 12 张：`doodle-mascot-v1/v2`、`doodle-gacha-v1/v2`、`doodle-empty-v1/v2`、`doodle-decor-{town|plants|travel}-v1/v2`。empty 各自引用同版 mascot；全批用 built-in imagegen 生成，原图均为 1254×1254 RGB PNG。QA 总览=`raw/doodle/qa/qa-doodle-theme-v2.png`。

初筛：12/12 无文字、水印、照片感或 3D 感；墨线、纸色与稀疏芥末黄/砖红点缀一致，无「换画师」漂移；两版咔啦均保住方吻、小圆耳、黄帽/红包/纸地图且未跑成猪熊；两版扭蛋机均为非对称层叠山景，不是孤立对称锥体。版型差异：v1 组整体更紧凑安静，v2 组动作/横向延展更强。

**用户终审拍板（2026-07-21）**：`mascot v2` / `gacha v1` / `empty v2`；三组 decor 明确评价「都很好」，故 `town v1/v2 + plants v1/v2 + travel v1/v2` 六张全部通过，作为可组合自由装饰保留。未选的 `mascot v1` / `gacha v2` / `empty v1` 已按用户指示从 raw 删除。cc 已转 q90 WebP 入 `picked/doodle/`（decor 双版命名规则见「交付规范」新增条）并随 M62 接入生产——克制铺量只挂 town-1/plants-1/travel-1 三件，-2 版留档候补。

**mascot-cutout 补画与终审（2026-07-22）**：按常驻双版规矩，以终审 `doodle-mascot-v2.png` 锁角色生成 `doodle-mascot-cutout-v1.png`；只保留咔啦本体与黄帽/红包/纸地图，无框、装饰、地面线或阴影。1254×1254 RGBA，四角透明、未检出键控绿边；用户终审通过后已转 q90 WebP 为 `picked/doodle/doodle-mascot-cutout.webp`，alpha 保留，待 M62 消费。
