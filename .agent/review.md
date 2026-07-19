# Review — 下一站，去哪玩

> 本文件由 reviewer（与实现者不同模型家族，默认 Codex/GPT）拥有。发现项在此存活直到被处置：
> ① 代码修复后删除 ② 移入 state.md 成为待办（带署名）③ 升级为 design.md 持久变更 ④ 驳回并留一行理由。

## Reviewer 提示词模板

审阅本仓库最近的变更（git log 定位范围），从八个轴逐项检查，发现写入下方 Active findings：

1. **goal ↔ design 对齐**：设计是否偏离 goal.md 的意图与硬约束（免费额度、后端失效可降级、无账号、浅色手绘）？
2. **design ↔ code 对齐**：当前实现及工程化迁移是否与 design.md 的机制、不变式和模块验收一致？
3. **数据完整性**：data/*.json 与补丁是否通过 tools/build.py 校验？枚举、坐标范围、id 唯一性？地名/菜名/酒店有无明显编造？
4. **错误处理**：空筛选结果、空行程、localStorage 损坏、剪贴板失败等边界是否处理？
5. **测试/验证覆盖**：构建脚本校验之外，关键交互（扭蛋、路书装配、顺路排序）有无验证记录？
6. **可维护性**：展示/决策/数据/边缘层边界是否清晰？schema 与迁移的影响面是否可控？
7. **估算的诚实性**：交通时长/预算是否始终明示为估算？有无伪装精确的文案？
8. **遗漏**：goal 中承诺但未实现、或实现了但 state.md 未记录的内容？

## Active findings

> Review baseline: 757c8e2，Codex/GPT reviewer，2026-07-19。审阅范围 `deb252e..757c8e2`；对照 goal/design/state/code 复核新落地的 M47 `[R2 · S2]` 与 M45 `[R2 · S3]`。M47 的移动端收纳、筛选状态保持与桌面展开行为通过，但新增 F57；M45 的当前交互与生产产物可用，但皮肤机制尚未达到 design 约定的“冻结”条件，新增 F54–F56。两模块仍有 active finding，跨家族 review gate 尚未过闸。
>
> 独立证据：`bun run build` 通过（TypeScript + 决策/UI Vitest 8 文件 82/82 + workerd Worker/DO 45/45 + Vite，共 127 条），`bun run test:build-assets` 1/1，`git diff --check` 通过。375×812 浏览器实测：折叠控制台高 69px、扭蛋入口可见；选中“江浙沪 + ¥¥”后折叠仍显示 badge=2、命中 45/320，再展开选择未丢失；1100×800 下完整控制台常显。皮肤弹层、随机选择、刷新持久化均可操作且控制台无报错。生产 HTML 已含首帧主题脚本，线上 `index-DhgtIa1i.js` / `index-BlQ8xKGF.css` 与本地产物 SHA-256 完全一致。

### F54 — [P1] M45 已宣称冻结，但皮肤声明仍不能驱动一套完整皮肤

design 要求每套皮肤声明同时包含 token 文件、字体组合、素材目录和装饰开关，并把字体子集化/懒加载纳入 M45；当前 `src/skins/registry.ts` 的声明没有 token 文件字段，`src/style.css` 仍静态 `@import "./skins/cream.css"`，而 `fonts`、`assetDir`、`decorations` 只是未被任何渲染路径消费的元数据。唯一的 cream 选项还使“即时切换”实际成为 cream→cream，现有测试只能证明 id 解析与内联脚本里的 `S`/`D` 文本没有漂移，不能证明新增第二套皮肤会加载其 token、字体、素材或装饰。state 又把字体管线推迟到 M46，同时把 M45 DOM/token 标成“冻结”，与当前 design 的模块边界互相矛盾。

M46 将直接依赖这份契约，因此不能把未被真实消费的声明当作 S3 基建过闸。应在 M45 完成声明驱动的 token/字体/素材/装饰装载，并用第二套最小测试皮肤或等价探针验证切换与首帧一致性；或者先由用户拍板修改 design/state，明确哪些职责移入 M46，并保持 M45 gate 未关闭，直到 M46 的真实皮肤证明该契约。字体子集化/懒加载也需在对应模块的验收与测试中有可执行证据，不能只靠注释性字段。

### F55 — [P2] 皮肤 token 抽取仍漏过模板、错误态和地图语义文案

`index.html` 的日期输入仍内联写死 `border:2px`、`border-radius:10px`、`background:#fff`，新皮肤会留下奶油白控件；`src/main.ts` 的数据加载失败条继续写死 `#ef6461`；`src/ui/mapview.ts` 把图例文案固定为“灰点/绿点”，但 design 又允许 `--map-dot-idle` / `--map-dot-visited` 按皮肤重映射，届时文案可能直接描述错误颜色。这与“所有可换配色、背景、边框、阴影、圆角、字体必须走 token”的冻结条件不一致，也与实现者提醒过的 extraction gap 属于同类风险。

应把上述视觉值迁入语义 token，并让地图图例使用不依赖具体颜色的语义文案或由皮肤声明提供标签。现有测试只机械检查 `REGION_COLOR_*` token，无法发现 HTML/TS 中的遗漏；补一条跨 HTML/TS/CSS 的硬编码视觉值审计并维护窄 allowlist（例如 QR 黑白输出、透明色、effects fallback），否则 M46 仍可能在已“冻结”的壳层里暴露 cream 残留。

### F56 — [P2] 损坏的主题 localStorage 会让实际主题与选择器状态互相矛盾

首帧脚本和 `resolveSkinId()` 都会把未知的持久化值安全回退为 cream，但 `src/ui/skin.ts` 渲染当前项时使用 `getSkinChoice() || SKINS[0].id`，对任意非空脏值不会归一化；结果是页面实际应用 cream，弹层里却没有 cream 或“随机”任何一项高亮。现有 drift test 只钉住脚本的 skin id/default，没有钉住 storage key 或这条回退算法，两个独立实现以后也可能再次分叉。

渲染选择器前应通过同一个解析规则归一化持久化值（并按拍板决定清理脏值还是只显示回退项），同时把 storage key 与首帧解析契约纳入单一来源或回归测试。需增加未知值、无法访问 localStorage、random 三条首帧与弹层状态一致性用例。

### F57 — [P2] M47 的折叠控制台只改变视觉 class，没有暴露 disclosure 状态

`src/ui/console.ts` 新增的 `#filterToggle` 没有 `aria-expanded` / `aria-controls`，`.console-body` 也没有可关联 id；点击处理只切换 `.open` 和按钮文字。键盘虽可触发原生 button，但读屏无法知道该按钮控制哪块内容、当前是展开还是折叠，动态状态也不会被宣告。

给控制按钮和面板建立稳定关联，初始化并在每次切换时同步 `aria-expanded`；面板的隐藏语义应与移动端 `display:none` 保持一致。补一条 DOM 测试覆盖初始折叠、展开、再次折叠三个状态。M47 的筛选计数、状态保持和桌面行为本轮均已通过，本 finding 只针对新增 disclosure 的可访问性契约。
