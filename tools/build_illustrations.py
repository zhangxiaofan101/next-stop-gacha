#!/usr/bin/env python3
"""插画接入管线（M42，随山水皮肤 M46 首落地）——本地工具，不进 Cloudflare 远端构建。

用法：python3 tools/build_illustrations.py
输入：assets/illustrations/picked/<皮肤id>/*.webp（用户终审通过的母版，q90 webp，进 git）
      assets/illustrations/picked/dest/*.webp（目的地共享集母版，M44 铺量落地后逐批出现，
      本脚本对空目录/不存在目录静默跳过——不假设 M44 已交付）
输出：public/illustrations/<皮肤id>/<槽位名>.webp（按下方画布契约重新编码到目标尺寸/体积）
      public/illustrations/dest/<城市id>.webp

**为什么是本地管线、不进 Cloudflare 远端构建**：处理用 `cwebp`（resize+重编码一步到位），本机可用，
但 Cloudflare 构建镜像是否预装不保证；本项目图片资产历来是「本地处理、产物进 git、远端不重新生成」
（picked/ 母版本身就是这么来的），本脚本的输出继续走这个模式，同 fonts/README.md 里字体管线的理由。

命名规则（母版 → 槽位名，去掉皮肤前缀——目录本身已经承载皮肤信息，槽位名跨皮肤统一，运行时
`illustSrc(assetDir, slot)` 用同一套槽位名拼路径，见 src/skins/illustrations.ts）：
  ink-mascot.webp          → mascot.webp        （方图 1:1，吉祥物）
  ink-mascot-cutout.webp   → mascot-cutout.webp （方图 1:1，吉祥物透明底 die-cut 变体——M64：叠放场景
                                                  用（FAB 趴机/舞台操作员），自带底晕的整圆版贴图，
                                                  非该变体不强制——缺图即回退整圆版或隐藏，见 design M64）
  ink-gacha.webp           → gacha.webp         （方图 1:1，扭蛋机）
  ink-empty.webp           → empty.webp         （方图 1:1，空态）
  ink-decor-<name>.webp    → decor-<name>.webp  （自由装饰件，画幅不拘，当前母版均 2:1）
  ink-texture-<desc>.webp  → texture.webp       （M57 底材纹理 512x512 无缝 tile，描述性后缀归一化去掉）
  ink-frame-<desc>.webp    → frame.webp         （M57 容器边框 1024x1024 空心框，border-image 9-slice）
  ink-divider-<desc>.webp  → divider.webp       （M57 分隔线笔触 1024x32 横条）
  ink-placeholder-<desc>.webp → placeholder.webp（M57 图位垫底，画布同题头 960x480）
  ink-seal-<name>.webp     → seal-<name>.webp   （M57 印章 256x256，多实例保留描述性 name）
  style-ref-mock.webp      （跳过——风格锚点，不是 UI 资产）
  dest/dest-<cityid>.webp  → dest/<cityid>.webp （目的地共享集，3:2，与皮肤无关）
  dest/region-<slug>.webp  → dest/region-<slug>.webp （M60：九区题头晋升共享题头层，2:1，画布契约：
    原生比不浅裁；与目的地个图同目录、各自按自己的比例校验，互不误伤——九区从此彻底退出皮肤
    素材维度，`<skin>-region-*` 命名在皮肤目录下不再被识别为合法槽位，见 classify()）

画布契约（design「插画层」）：装饰位（方图/题头/装饰件）≤60KB，目的地卡位 ≤40KB；题头位按
「原生比展示、不做浅裁」——本脚本对题头/装饰件一律等比缩放（不裁切），交给前端 CSS 用
`aspect-ratio` 撑出与图片相同的比例，物理上不会发生裁切。

**违规校验与退出码（F60 补齐，2026-07-20）**：此前本脚本对比例/预算/命名/编码违规只打印、不拦截，
`main()` 恒零退出——`bun run test:build-assets`/部署门禁形同虚设。现在：
  ① 编码前用 `webpinfo` 读源图真实宽高，与槽位期望比例比对，超出 2% 容差直接拒绝（不做拉伸变形，
     旧版本"按母版实际比例校验"的说法此前是假的，resize 会无条件把任何比例的源图硬拉伸）；
  ② 命名不合规、槽位未知、webpinfo/cwebp 失败、质量下限 q40 仍超预算，全部计入违规清单；
  ③ 运行结束若违规清单非空，`sys.exit(1)`——只要有一项没扛住，退出码就不能是 0。

**M60（2026-07-21）**：九区题头母版从各皮肤目录（原仅 `picked/ink/`）转入共享题头层
`picked/dest/region-<slug>.webp`，产物 `public/illustrations/dest/region-<slug>.webp`，与目的地个图
`dest-<cityid>.webp` 同目录、同 `process_dest()` 处理，按各自槽位类型（题头 2:1 960×480 / 个图 3:2
640×427）分别校验，互不误伤。皮肤目录内 `<skin>-region-*` 命名从此不再被 `classify()` 识别（九区
彻底退出皮肤素材维度，新皮肤成套不必再画 9 个题头版位）。
"""
import glob, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 测试专用覆盖（tests/build-illustrations.test.mjs）：默认路径不变，测试用临时目录跑真实
# cwebp/webpinfo 二进制而不碰 assets/picked 与 public/illustrations 真实资产。
PICKED_DIR = os.environ.get("BUILD_ILLUST_PICKED_DIR") or os.path.join(ROOT, "assets", "illustrations", "picked")
OUT_DIR = os.environ.get("BUILD_ILLUST_OUT_DIR") or os.path.join(ROOT, "public", "illustrations")

BUDGET_DECOR = int(os.environ.get("BUILD_ILLUST_BUDGET_DECOR", 60 * 1024))   # 装饰位（吉祥物/扭蛋机/空态/题头/装饰件）
BUDGET_DEST = int(os.environ.get("BUILD_ILLUST_BUDGET_DEST", 40 * 1024))     # 目的地卡位

# 槽位类型 → (输出目标宽, 输出目标高, 体积预算)；宽高比必须与母版一致（编码前用 webpinfo 校验，
# 容差见 RATIO_TOLERANCE，超出直接拒绝，不做拉伸）
SQUARE = (640, 640, BUDGET_DECOR)
BANNER = (960, 480, BUDGET_DECOR)  # 题头 / 装饰件母版均 1024x512（2:1）
DEST = (640, 427, BUDGET_DEST)     # 目的地母版 1536x1024（3:2）
# M57 工艺件（design「工艺件画布契约」）：不做 SQUARE 那种 1024→640 缩放——底材/边框/分隔线/
# 印章都是被 CSS 平铺/切片/拉伸消费的材质图，不是缩放进一个盒子里的插画，保原生分辨率更利于
# border-image 9-slice 中段拉伸时不糊、texture 平铺时颗粒不放大失真
TEXTURE = (512, 512, BUDGET_DECOR)   # 底材纹理，四方连续无缝 tile
FRAME = (1024, 1024, BUDGET_DECOR)   # 容器边框，空心框走 border-image 9-slice
DIVIDER = (1024, 32, BUDGET_DECOR)   # 分隔线笔触，横条整笔
SEAL = (256, 256, BUDGET_DECOR)      # 印章/徽记，每枚独立命名（seal-<name>）

RATIO_TOLERANCE = 0.02  # 母版实际宽高比与槽位期望比的容许偏差


def classify(skin: str, basename: str, violations: list):
    """返回 (槽位输出文件名, 尺寸预算元组) 或 None（跳过，如 style-ref-mock 或违规命名/槽位）。"""
    name = basename[:-len(".webp")]
    if name == "style-ref-mock":
        return None
    prefix = f"{skin}-"
    if not name.startswith(prefix):
        msg = f"{skin}/{basename} 命名不含皮肤前缀 `{prefix}`"
        print(f"  !! {msg}，跳过（检查工单命名规范）", file=sys.stderr)
        violations.append(msg)
        return None
    slot = name[len(prefix):]
    if slot in ("mascot", "mascot-cutout", "gacha", "empty"):
        return f"{slot}.webp", SQUARE
    # M60：region- 已从皮肤目录退场，晋升共享题头层（picked/dest/region-<slug>.webp，见
    # process_dest()）——皮肤目录内的 `<skin>-region-*` 命名不再被识别，会落进下方「未知类别」
    # 违规分支，这是刻意的（九区彻底退出皮肤素材维度，新皮肤不应再补画这 9 个版位）。
    if slot.startswith("decor-"):
        return f"{slot}.webp", BANNER
    # M57 工艺件：texture/frame/divider/placeholder 皮肤内单例，母版命名允许带描述性后缀
    # （如 ink-texture-paper.webp）——后缀是这批母版的自选说明，不是稳定的运行时标识符，输出
    # 归一化成裸槽位名（texture.webp），供 illustrations.ts 用固定槽位名拼 URL，换母版不用改代码。
    # seal 例外：一皮肤可以有多枚不同用途的印章（下一站/去哪玩），name 本身就是稳定标识符，
    # 原样保留（同 decor-<name> 的多实例槽位先例）。
    if slot.startswith("texture"):
        return "texture.webp", TEXTURE
    if slot.startswith("frame"):
        return "frame.webp", FRAME
    if slot.startswith("divider"):
        return "divider.webp", DIVIDER
    if slot.startswith("placeholder"):
        return "placeholder.webp", BANNER
    if slot.startswith("seal-"):
        return f"{slot}.webp", SEAL
    msg = f"{skin}/{basename} 槽位名 `{slot}` 不属于已知类别"
    print(f"  !! {msg}，跳过", file=sys.stderr)
    violations.append(msg)
    return None


def source_size(path: str):
    """用 webpinfo 读源图真实宽高（只读 RIFF header，不整图解码）。读不出返回 None。"""
    r = subprocess.run(["webpinfo", path], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    w = re.search(r"Width:\s*(\d+)", r.stdout)
    h = re.search(r"Height:\s*(\d+)", r.stdout)
    if not w or not h:
        return None
    return int(w.group(1)), int(h.group(1))


def encode(src: str, dst: str, target_w: int, target_h: int, budget: int, violations: list) -> int:
    size = source_size(src)
    if size is None:
        msg = f"{src}: webpinfo 读取源图宽高失败"
        print(f"  !! {msg}", file=sys.stderr)
        violations.append(msg)
        return -1
    src_w, src_h = size
    src_ratio, target_ratio = src_w / src_h, target_w / target_h
    if abs(src_ratio - target_ratio) / target_ratio > RATIO_TOLERANCE:
        msg = (f"{src}: 源图比例 {src_w}x{src_h}（{src_ratio:.3f}）与槽位期望比例 "
               f"{target_w}x{target_h}（{target_ratio:.3f}）偏差超过 {RATIO_TOLERANCE:.0%} 容差")
        print(f"  !! {msg}，拒绝（不做拉伸变形，检查母版是否画错画布/裁切走样）", file=sys.stderr)
        violations.append(msg)
        return -1
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    out_size = -1
    for q in (85, 78, 70, 60, 50, 40):
        r = subprocess.run(
            ["cwebp", "-q", str(q), "-resize", str(target_w), str(target_h), src, "-o", dst],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            msg = f"{src}: cwebp 编码失败：{r.stderr.strip()}"
            print(f"  !! {msg}", file=sys.stderr)
            violations.append(msg)
            return -1
        out_size = os.path.getsize(dst)
        if out_size <= budget:
            return out_size
    msg = f"{src}: 质量下限 q40 仍超预算（{out_size / 1024:.1f}KB > {budget // 1024}KB）"
    print(f"  !! {msg}", file=sys.stderr)
    violations.append(msg)
    return out_size  # 已到质量下限仍超预算，原样返回最后一次结果（已计入违规），调用方仍打印供人工核对


def process_skin_dir(skin: str, violations: list):
    src_dir = os.path.join(PICKED_DIR, skin)
    files = sorted(glob.glob(os.path.join(src_dir, "*.webp")))
    if not files:
        return
    print(f"[{skin}]")
    claimed: dict = {}  # out_name → 先占用它的源文件 basename（F62：撞名检测，见下）
    for f in files:
        basename = os.path.basename(f)
        result = classify(skin, basename, violations)
        if result is None:
            continue
        out_name, (tw, th, budget) = result
        # F62：texture/frame/divider/placeholder 归一化去后缀后可能撞名（如
        # ink-frame-a.webp 与 ink-frame-b.webp 都归一化成 frame.webp）；sorted(glob) 保证顺序
        # 确定，但先到先得会悄悄丢弃后一个母版——按文件名排序取第一个，其余计入违规并跳过，
        # 不静默覆盖。seal/decor 等多实例槽位输出名本身就含 name，正常不会撞，这里
        # 用同一套「out_name 去重」兜底即可，不需要为它们单独分支。
        if out_name in claimed:
            msg = f"{skin}/{basename} 归一化输出名 `{out_name}` 与 {skin}/{claimed[out_name]} 撞名（同一皮肤只能有一个源产出这个槽位）"
            print(f"  !! {msg}，跳过（保留 {claimed[out_name]}，清理多余母版或改描述性后缀避免混淆）", file=sys.stderr)
            violations.append(msg)
            continue
        claimed[out_name] = basename
        out_path = os.path.join(OUT_DIR, skin, out_name)
        size = encode(f, out_path, tw, th, budget, violations)
        if size < 0:
            continue
        status = "OK" if size <= budget else "超限!"
        print(f"  {status} {out_name}：{size / 1024:.1f}KB（{tw}x{th}，预算 {budget // 1024}KB）")


def process_dest(violations: list):
    src_dir = os.path.join(PICKED_DIR, "dest")
    files = sorted(glob.glob(os.path.join(src_dir, "*.webp")))
    if not files:
        print("[dest] picked/dest/ 暂无母版（M44 铺量前正常），跳过")
        return
    print("[dest]")
    for f in files:
        name = os.path.basename(f)[:-len(".webp")]
        # M60：picked/dest/ 现同时容纳两族母版——目的地个图 `dest-<cityid>.webp`（3:2）与九区共享
        # 题头 `region-<slug>.webp`（2:1，已从皮肤目录晋升至此）；各自按自己的槽位类型校验比例/
        # 预算，互不误伤。picked/dest/ 母版命名去掉的只是 -v{n} 版本号（见 illustration-brief.md），
        # dest- 前缀留着；槽位名/运行时 URL 不带这个前缀（destPhotoSrc(id) 直接拼城市 id），这里要
        # 再剥一层；region- 前缀原样保留（输出名与源文件名一致，见 src/skins/illustrations.ts 的
        # regionHeaderSrc()）。
        if name.startswith("region-"):
            out_name = f"{name}.webp"
            tw, th, budget = BANNER
        elif name.startswith("dest-"):
            out_name = f"{name[len('dest-'):]}.webp"
            tw, th, budget = DEST
        else:
            msg = f"{os.path.basename(f)} 命名不含 `dest-`/`region-` 前缀"
            print(f"  !! {msg}，跳过（检查工单命名规范）", file=sys.stderr)
            violations.append(msg)
            continue
        out_path = os.path.join(OUT_DIR, "dest", out_name)
        size = encode(f, out_path, tw, th, budget, violations)
        if size < 0:
            continue
        status = "OK" if size <= budget else "超限!"
        print(f"  {status} {out_name}：{size / 1024:.1f}KB（{tw}x{th}，预算 {budget // 1024}KB）")


def main():
    if not os.path.isdir(PICKED_DIR):
        print("!! assets/illustrations/picked/ 不存在", file=sys.stderr)
        sys.exit(1)
    violations: list = []
    skins = sorted(
        d for d in os.listdir(PICKED_DIR)
        if os.path.isdir(os.path.join(PICKED_DIR, d)) and d != "dest"
    )
    for skin in skins:
        process_skin_dir(skin, violations)
    process_dest(violations)
    print(f"完成，产物在 {os.path.relpath(OUT_DIR, ROOT)}/")
    if violations:
        print(f"\n!! 本次运行累计 {len(violations)} 项违规，非零退出：", file=sys.stderr)
        for v in violations:
            print(f"  - {v}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
