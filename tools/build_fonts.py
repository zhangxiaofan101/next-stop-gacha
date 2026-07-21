#!/usr/bin/env python3
"""字体子集化管线（M46，山水皮肤首落地）——本地工具，不进 Cloudflare 远端构建
（理由见 fonts/README.md：pyftsubset 依赖第三方包，远端构建镜像不保证预装）。

用法：python3 tools/build_fonts.py
前置：① 跑过 python3 tools/build.py（本脚本读 public/data/ 的最新 chunk 算数据文本语料）
     ② fonts/source/ 下有 MaShanZheng-Regular.ttf 与 LXGWWenKai-Regular.ttf（来源见 fonts/README.md）
     ③ 系统装了 pyftsubset（pip install fonttools brotli，brotli 是 woff2 输出必需）

字符集分两档，非共用一份——`--round`（标题字体挂载点，见 src/style.css 全部 `var(--round)` 引用）
在本项目里覆盖标题/按钮/徽章/城市名等短文本，但**不覆盖**美食/博物馆/亮点/住宿/交通/行程路线等长
文案（那些走 `--sans`）；马善政毛笔体单字笔画点数远高于霞鹜文楷，若也按「data 全量文本」算字符集
会撑破 1MB 预算（实测 3043 字→1.19MB）。故标题字体的语料 = UI 文案（index.html + src/**/*.ts）∪
仅 `name`/`province` 两个数据字段（--round 实际消费到的数据字段，逐个 var(--round) 选择器核对过：
城市/线路名、`.c-route` 拼的「上海 ✈ 某省 · 某区」）；正文字体的语料 = UI 文案 ∪ **data 全量文本**
（--sans 覆盖数据里的一切其余字段，必须全量，宁可语料偏大不可漏字）。两档都再并上全部可打印 ASCII
（覆盖数字/英文标签，如「citywalk」「D1」「267 个目的地」）。
"""
import glob, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "fonts", "source")
# 产物落 src/skins/fonts/（不进 public/）：Vite 的 base 前缀改写只对模块图里能追踪到的资产生效——
# CSS url() 指向 public/ 时不会被改写成带 base 前缀的路径（Vite 已知限制），public/ 只适合被 JS 用
# import.meta.env.BASE_URL 显式拼接（data/manifest.json、插画走的正是这条路）。字体走 @font-face
# CSS url()，必须留在 src/ 下让 Vite 当模块资产处理（哈希文件名 + 正确带 base 拷进 dist/assets/），
# 否则会重演 F39 那次「base 配错导致资产 404」的事故形状。见 src/skins/ink.css 里的 @font-face。
OUT_DIR = os.path.join(ROOT, "src", "skins", "fonts", "ink")
MAX_BYTES = 1024 * 1024  # design「主题皮肤系统」：单字重 ≤1MB woff2

# (输出文件名, 源字体, 标签, 是否用全量 data 文本——False=只取 name/province 字段)
FONTS = [
    ("title.woff2", os.path.join(SRC_DIR, "MaShanZheng-Regular.ttf"), "标题（马善政毛笔体档）", False),
    ("body.woff2", os.path.join(SRC_DIR, "LXGWWenKai-Regular.ttf"), "正文（霞鹜文楷档）", True),
]


def load_chunks() -> list:
    chunk_files = glob.glob(os.path.join(ROOT, "public", "data", "chunk-*.json"))
    if not chunk_files:
        print("!! public/data/ 下没有 chunk 文件，先跑 python3 tools/build.py", file=sys.stderr)
        sys.exit(1)
    return [json.load(open(f, encoding="utf-8")) for f in chunk_files]


def collect_data_text_full(chunks: list) -> set:
    chars = set()

    def walk(x):
        if isinstance(x, str):
            chars.update(x)
        elif isinstance(x, list):
            for i in x:
                walk(i)
        elif isinstance(x, dict):
            for v in x.values():
                walk(v)

    for c in chunks:
        walk(c)
    return chars


def collect_data_text_names(chunks: list) -> set:
    chars = set()
    for c in chunks:
        for d in c:
            chars.update(d.get("name", ""))
            chars.update(d.get("province", ""))
    return chars


def collect_ui_text() -> set:
    chars = set()
    files = [os.path.join(ROOT, "index.html")]
    files += glob.glob(os.path.join(ROOT, "src", "**", "*.ts"), recursive=True)
    # .css 也扫——CSS `content: "印"` 这类伪元素文案是唯一不在 .ts/.html 里出现却真的会上屏的
    # 文字来源（印章之类纯 CSS 自绘装饰），漏了这一类会在对应皮肤下现字体缺字方框。
    files += glob.glob(os.path.join(ROOT, "src", "**", "*.css"), recursive=True)
    for f in files:
        chars.update(open(f, encoding="utf-8").read())
    return chars


def main():
    if not os.path.isdir(SRC_DIR) or not any(
        os.path.exists(p) for _, p, _, _ in FONTS
    ):
        print("!! fonts/source/ 缺源字体文件，见 fonts/README.md 的下载命令", file=sys.stderr)
        sys.exit(1)

    chunks = load_chunks()
    ui_text = collect_ui_text()
    ascii_printable = {chr(c) for c in range(0x20, 0x7F)}
    narrow_charset = ui_text | collect_data_text_names(chunks) | ascii_printable
    full_charset = ui_text | collect_data_text_full(chunks) | ascii_printable

    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"标题语料：{len(narrow_charset)} 字符（UI 文案 + name/province）；"
          f"正文语料：{len(full_charset)} 字符（UI 文案 + data 全量文本）")
    ok = True
    for out_name, src_path, label, use_full in FONTS:
        if not os.path.exists(src_path):
            print(f"!! 缺 {os.path.basename(src_path)}，跳过 {label}", file=sys.stderr)
            ok = False
            continue
        charset = full_charset if use_full else narrow_charset
        # 语料落盘进 git（M69）：woff2 是二进制黑盒，语料文本是它唯一可 diff/可断言的影子——
        # font-corpus 测试拿它对照源文件字符集，UI/数据新增字没重跑本脚本时红灯（「堆」缺字复发案）
        corpus_path = os.path.join(OUT_DIR, out_name.replace(".woff2", ".corpus.txt"))
        open(corpus_path, "w", encoding="utf-8").write("".join(sorted(charset)))
        out_path = os.path.join(OUT_DIR, out_name)
        r = subprocess.run(
            [
                "pyftsubset", src_path,
                f"--text-file={corpus_path}",
                "--flavor=woff2",
                "--no-hinting",
                "--desubroutinize",
                f"--output-file={out_path}",
            ],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            print(f"!! pyftsubset 处理 {label} 失败：\n{r.stderr}", file=sys.stderr)
            ok = False
            continue
        size = os.path.getsize(out_path)
        status = "OK" if size <= MAX_BYTES else "超限!"
        print(f"{status} {out_name}（{label}）：{size / 1024:.1f}KB")
        if size > MAX_BYTES:
            ok = False

    if not ok:
        sys.exit(1)
    print(f"完成，产物在 {os.path.relpath(OUT_DIR, ROOT)}/")


if __name__ == "__main__":
    main()
