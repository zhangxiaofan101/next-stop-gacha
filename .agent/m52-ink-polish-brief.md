# M52 — 山水皮肤一致性精修（工单）

> 消费者：单开的 fable 实现会话。消费后归档（git 历史为档案）。
> 基准：`assets/illustrations/raw/ink/style-ref-mock.png`（或 picked/ink/ 的 webp 版）——**每改完一个区块与 mock 并排对照一次**。
> 红线：奶油皮肤零回归（全部改动挂 `[data-theme="ink"]`、或走「cream 值=现状原样」的新 token）；`bun run verify` 全绿；新 token 必须 cream.css/ink.css 双文件各加一行（漂移钉子测试会拦）。

## 甲、诊断总纲（为什么 M46 落了还是丑）

M46 完成的是 **token 等值换色**：色板、字体、圆角、线宽都换了。但三类**形态语言**仍是奶油的，形态大多写死在视图 CSS 里、token 只管颜色，换肤换不动：

1. **图标语言**：全站 emoji（✈️🎰📤⚖️🧳👣🎨🏝️…）是彩色卡通物件，贴在宣纸上就是塑料贴纸；
2. **投影/交互语言**：`box-shadow: 2px 2px 0 …`/`6px 7px 0 …` 硬偏移贴纸投影 + `translate(2px,2px)` 按压位移，形态字面量在 style.css（17/23/69/78/102/106/127/138/141/189/206/222/233 行等约 20 处），**卡片投影甚至用区域色着色（`--rc`，style.css:138）**——这是用户看到的「奶油色块/阴影还在」的主根因之一；
3. **边线语言**：线宽收细了但仍是均匀直线；mock 是细而略不均的手描墨线。

mock 的语言：细墨线（不均、微抖）+ 宣纸大留白 + 朱红点睛 + 淡彩晕染 + **无投影**。整改按下面五层做，顺序=视觉冲击从大到小。

## 乙、投影与交互形态 token 化（先做，冲击最大）

**机制升级**：投影/按压形态是皮肤语言，必须整条进 token。新增 token（cream 值=现状字面量原样搬入，ink 值见下）：

| 新 token | cream 值（搬现状） | ink 值 |
|---|---|---|
| `--shadow-chip` | `2px 2px 0 rgba(var(--shadow-ink-rgb),.22)` | `none` |
| `--shadow-btn` | `2px 2px 0 rgba(var(--shadow-ink-rgb),.22)` | `none` |
| `--shadow-card` | `6px 7px 0 var(--rc,…), 0 14px 26px -14px …` | `0 1px 4px rgba(var(--ink-rgb),.10)`（极淡晕散，无偏移无色相） |
| `--shadow-card-hover` | 现 hover 值 | `0 3px 10px rgba(var(--ink-rgb),.14)` |
| `--shadow-panel`（console 78 行） | 现值 | `none` 或极淡 |
| `--shadow-fab` | 现值（含 inset 高光） | 朱红方案见丁-3 |
| `--press-shift` | `translate(2px,2px)` | `none`（水墨没有「按下贴纸」，改 opacity .85 反馈） |

逐处替换 style.css 里的 box-shadow/active-transform 字面量为 var()。**`--rc` 区域色投影在 ink 下必须失效**（--shadow-card 的 ink 值不引用 --rc）。太阳光晕（17/20 行）随 .sky 已隐藏不用管。

## 丙、卡片色块去平涂

1. **区域色块退场**：mock 卡片=宣纸面+细墨框，无色块。ink 下 `--region-*` 九色现在还是粉彩平涂思路（e4edf3 一族），改法：
   - 卡片无插画时的 `.c-photo` 占位（264 城现状）：region 底色 → **统一宣纸底 + 极淡墨色山影渐变占位**（CSS 渐变即可，不占资产）；区域归属改用「朱红描边小签」徽章表达（细红框 + 红字 + 透明底）；
   - `--region-*` ink 值整体再降饱和到「隐约可辨」档（或直接全部=宣纸色，区域信息完全交给徽章文字——**推荐后者**，mock 没有区域色概念）；
   - 对比表/地图图例等其他 region 消费点检查一遍，同口径。
2. **chips/badges/tags 填充 → 描边**：ink 下 chip 未选=透明底+1px 墨线+墨字；选中态对照 mock 两种：地区/季节类=**朱红描边+浅底**，玩法类=**淡靛晕染填充**——实现上不必分两种，统一「朱红描边浅底」即可（`.chip.on` 现在是蓝填充+硬投影，style.css:106，全换）。`--tag-bg`/`--badge-*`/`--food-chip-*` 等填充类 token ink 值同步改描边化（bg=transparent 或宣纸，border 承担表达）。
3. **渐变按钮扁平化**：`--grad-btn-*`/`--grad-fab`/`--grad-knob` ink 值改**扁平色**（朱红/黛蓝/苔绿，无高光渐变）；`inset shine` 高光（206 行）随 --shadow-fab token 化后 ink 置无。

## 丁、图标层清剿（皮肤图标机制，两级）

**A 级·功能图标 SVG 化**（结构升级，全皮肤受益）：新建 `src/ui/icons.ts` 输出 inline SVG（`stroke="currentColor"` 单色线形，16/18px），替换以下 emoji——颜色自动随皮肤文字色，奶油下也更精致：

| emoji | 位置 | SVG |
|---|---|---|
| 📤 | index.html:40 icon-btn | 托盘出箭头线形 |
| 🎨 | index.html:63 页脚 | 调色盘线形（或纯文字「换皮肤」） |
| 👣 | render.ts:58-59 足迹胶囊、mapview、detail 打卡钮 | 双足印线形 |
| ⚖️ | cards.ts:53、index.html:71、detail.ts:69 | 天平线形 |
| 🧳 | cards.ts:17、index.html:77、detail.ts:29、trip.ts:21 文案 | 行李箱线形 |
| ♥ | cards/console/mapview/share | 可保留字符（本就单色随 token 变朱红），或换线形心 |
| 🔍 | search 若有 | 放大镜线形 |
| 🖨 | roadbook.ts:64 | 打印机线形（低优先级） |
| ✕/✓ | 各关闭/确认钮 | 已是字符，保留 |

toast/share 文案里的 emoji（`👣 已打卡：…` 等）属语义文案不属视觉层，**保留不动**。

**B 级·装饰 emoji 皮肤处置位**（形态属皮肤）：

| 现状 | 位置 | ink 处置 |
|---|---|---|
| ✈️ 飘动小飞机 | index.html:36 `.plane` | `[data-theme="ink"] .plane { display:none }`，页头留白即可（mock 标题旁没有物件；如嫌空，cc 手绘一只淡墨雁影 SVG 置右上，对照 mock 顶部飞鸟） |
| 🎰 | index.html:67 FAB | ink 下去 emoji（`font-size:0` 或按皮肤模板渲染），纯文字**「抽一个」朱红印章钮**（见下） |
| 🏝️ 空态 fallback | index.html:54 | 已接 ink-empty 资产，fallback 仅缺图兜底，不动 |
| 卡名旁 `d.emoji` | cards.ts | **用户已豁免**（将来 M44 插画上位），不动 |

## 戊、印章重做 + 手绘边线

1. **印章**（用户点名丑）：现状=CSS 方块+「印」字（style.css:506-511），换成 **cc 手绘 inline SVG 印章** 2~3 枚：竖排双字「下一站」/「去哪玩」白文印（SVG path 手写篆意笔画，不求真篆书、求「印的质感」；`feTurbulence` 微糙边缘 + 2px 圆角 + 微旋转 + opacity .85）。放置对照 mock：①副标题尾；②区段标题「热门推荐」类旁；③页脚右下。**≤3 处，克制**。SVG 填色用 `var(--red)` 保持 token 纪律。
2. **手绘边框**：
   - 小件（chip/btn/输入框）：**不对称圆角**手绘 trick——`border-radius: 255px 15px 225px 15px / 15px 225px 15px 255px` 一族（数值按件微调，ink 专属 override），1px 墨线立刻有手描感，零资产零性能成本；
   - 大容器（console 面板/卡片/sheet/扭蛋机）：伪元素叠一条 **SVG feTurbulence 抖动描边**（`filter: url(#ink-wobble)`，inline SVG filter 一枚全站复用；displacement scale 1.5~2 很轻），或 cc 画一个 wobble 矩形 SVG 走 border-image 9-slice——**二选一，先试 filter 方案**（代码少），手机滚动掉帧再降级 border-image；
   - 分隔线：M46 已做抖动虚线（console-foot/rb-cover），口径保持，其他 dashed 分隔线（--divider-* 消费点）同手法推广。
3. **抽一个/FAB 印章化**：朱红扁平底+白字+微糙边（同印章 SVG 滤镜）+ 不对称圆角，去掉高光渐变与硬投影——mock 的「抽一个」就是一枚横版朱印。

## 己、mock 逐区对照补漏（收尾细扫）

- **console 右上咔啦**：已接 mascot-decor——核对用的是**圆形墨圈构图版**（picked/ink/ink-mascot.webp 即圆墨圈版），尺寸/透明度对照 mock（mock 里是细墨圈、约头像大小、不抢戏）；
- **装饰件落位核对**（index.html:26-30 已挂）：竹枝=console 右缘、柳桥=区段标题上方小景、远山=页底氛围带，逐一与 mock 位置/大小/透明度对照，远山建议 `opacity:.5~.7` 垫底不压文字；
- **选中态/悬停态**全景过一遍：chip.on/btn 按压/card hover 的形态在乙丙改完后逐个目检；
- **宣纸纹理**：全局 body 叠极淡纤维噪点（inline SVG feTurbulence 做 background-image，tile 256px，opacity ≤.04）——mock 的纸感很大程度来自这个；手机滚动性能实测，卡就撤；
- **扭蛋弹层/详情/路书/地图/分享**五个 overlay 逐视图过：同样的投影/边线/图标语言收编（地图 SVG 的省份描边色已 token 化，核对 ink 值是否墨线感）；
- **字体兜底**：毛笔标题字下的数字/英文（计数徽章、天数）如果 fallback 生硬，给 `--round` 的 ink 值补数字友好的 serif 兜底。

## 庚、执行顺序与验收

**顺序**：乙（投影/交互）→ 丙（色块）→ 丁A（SVG 图标）→ 戊（印章+边线）→ 丁B（装饰位）→ 己（细扫）。每层完成截图对照 mock 一次，别攒到最后。

**验收**：
1. 山水下**手机 390px + 桌面**逐视图（首页/筛选展开/详情/扭蛋/对比/行程/路书/地图/分享）与 mock 并排目检，气质一致；
2. **奶油零回归**：复用 M45 计算样式哈希法或逐视图截图 diff（新 token 的 cream 值=字面量原样搬入，理论上零像素变化）；
3. `bun run verify` 全绿（含 token 双文件漂移钉子、no-hardcoded-visuals 审计——新增 shadow/形态 token 记得补进审计 allowlist 口径）；
4. push 后生产地址复验；
5. 落地后更新 state（✅ 条目 + 🔜 划掉），**喊 codex 把 M45+M46+M52 一轮 review 关掉**（州 gate 记录见 state 🔜 第 1 条）。
