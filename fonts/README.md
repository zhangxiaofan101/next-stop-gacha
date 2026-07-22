# fonts/ — 山水皮肤字体源（M46）

字体属皮肤维度（design「主题皮肤系统」）：每皮肤 ≤2 字体（标题+正文），构建期
`pyftsubset` 子集化，产物是 `src/skins/fonts/<皮肤id>/*.woff2`（进 git，随 dist 一起发布）。
本目录只放**子集化的输入源**，同 `assets/illustrations/raw/` 的定位——体积大、可从公开地址
重新下载、不进 git（见 `.gitignore`）。

## 山水皮肤：`source/`

| 用途 | 字体 | 来源 | 版本/commit | 许可 |
|------|------|------|------|------|
| 标题（马善政毛笔体档） | Ma Shan Zheng | https://github.com/googlefonts/mashanzheng | `master` 分支 `fonts/ttf/MaShanZheng-Regular.ttf` | SIL OFL 1.1（可商用） |
| 正文（霞鹜文楷档） | LXGW WenKai Regular | https://github.com/lxgw/LxgwWenKai/releases | `v1.522` | SIL OFL 1.1（可商用；附加条款明确允许子集化为 webfont 分发，见 `OFL.txt`） |

下载命令（`tools/build_fonts.py` 需要这两个文件存在于 `fonts/source/` 才能跑）：

```
curl -sL -o fonts/source/MaShanZheng-Regular.ttf \
  https://raw.githubusercontent.com/googlefonts/mashanzheng/master/fonts/ttf/MaShanZheng-Regular.ttf
curl -sL -o fonts/source/LXGWWenKai-Regular.ttf \
  https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf
```

## 管线

`python3 tools/build_fonts.py`（本地跑，需要 `pyftsubset`——`pip install fonttools brotli`）：
按 `public/data/chunk-*.json`（数据全量文本，跑前先 `python3 tools/build.py` 保证是最新）+
`index.html`/`src/**/*.ts`（UI 文案，整文件扫字符，对 TS 语法字符零特殊处理——CJK 字符只可能
来自字符串字面量/注释，效果等价于精确提取但实现简单得多）+ 全部可打印 ASCII 算字符集，对两个
源字体各出一份 `.woff2` 到 `src/skins/fonts/ink/`（`title.woff2`/`body.woff2`——不进 `public/`，
理由见 `tools/build_fonts.py` 顶部的 Vite base 前缀注释）。

**为什么是本地管线、不进 Cloudflare 远端构建**（同 M42 插画管线的理由，见 `tools/build_illustrations.py`
顶部注释）：`pyftsubset` 依赖 `fonttools`+`brotli` 两个第三方 Python 包，Cloudflare 构建镜像不保证
预装；给远端构建加 pip 安装步骤会把部署管线绑定在 PyPI 可用性上，本项目现有的图片资产管线
（`picked/<皮肤id>/*.webp`）已经是「本地处理、产物进 git、远端不重新生成」的先例，字体子集走同一
模式最省心。**代价**：日后数据/UI 文案新增大量新字符时，字体子集不会自动跟上，需人工重新跑本
脚本——现阶段规模下（子集化目标 ≤1MB/字重）没有自动纠偏机制，留作已知限制。

产物 ≤1MB/woff2 是构建校验的红线（脚本内断言），非当前皮肤的字体因浏览器原生的 `@font-face`
懒取值行为自动懒加载（`--round`/`--sans` 只有在 `data-theme="ink"` 时才解析成这两个 family，
奶油皮肤下浏览器永远不会去发起这两个 woff2 的请求）；字体失败或未布置时 `font-family` 栈里的
系统字体兜底（`font-display: swap`），排版不塌。

毛笔标题字体中经实际页面确认容易被误读的字形列在
`src/skins/fonts/ink/title-fallback.txt`。它们仍保留正确文本，但不进 `title.woff2`，浏览器会按
`--round` 字体栈改用 `Ink Body` 的清晰字形；比在各个 UI 模板里单独包字符更稳定，也能覆盖卡片、
详情、扭蛋结果与路书等所有标题消费位。
