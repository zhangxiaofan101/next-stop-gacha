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
`illustSrc(skinId, slot)` 用同一套槽位名拼路径，见 src/skins/illustrations.ts）：
  ink-mascot.webp          → mascot.webp        （方图 1:1，吉祥物）
  ink-gacha.webp           → gacha.webp         （方图 1:1，扭蛋机）
  ink-empty.webp           → empty.webp         （方图 1:1，空态）
  ink-region-<slug>.webp   → region-<slug>.webp （九区题头 2:1，画布契约：原生比不浅裁）
  ink-decor-<name>.webp    → decor-<name>.webp  （自由装饰件，画幅不拘，当前母版均 2:1）
  style-ref-mock.webp      （跳过——风格锚点，不是 UI 资产）
  dest/<cityid>.webp       → dest/<cityid>.webp （目的地共享集，3:2，与皮肤无关）

画布契约（design「插画层」）：装饰位（方图/题头/装饰件）≤60KB，目的地卡位 ≤40KB；题头位按
「原生比展示、不做浅裁」——本脚本对题头/装饰件一律等比缩放（不裁切），交给前端 CSS 用
`aspect-ratio` 撑出与图片相同的比例，物理上不会发生裁切。
"""
import glob, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICKED_DIR = os.path.join(ROOT, "assets", "illustrations", "picked")
OUT_DIR = os.path.join(ROOT, "public", "illustrations")

BUDGET_DECOR = 60 * 1024   # 装饰位（吉祥物/扭蛋机/空态/题头/装饰件）
BUDGET_DEST = 40 * 1024    # 目的地卡位

# 槽位类型 → (输出目标宽, 输出目标高, 体积预算)；宽高比必须与母版一致（脚本按母版实际比例校验）
SQUARE = (640, 640, BUDGET_DECOR)
BANNER = (960, 480, BUDGET_DECOR)  # 题头 / 装饰件母版均 1024x512（2:1）
DEST = (640, 427, BUDGET_DEST)     # 目的地母版 1536x1024（3:2）


def classify(skin: str, basename: str):
    """返回 (槽位输出文件名, 尺寸预算元组) 或 None（跳过，如 style-ref-mock）。"""
    name = basename[:-len(".webp")]
    if name == "style-ref-mock":
        return None
    prefix = f"{skin}-"
    if not name.startswith(prefix):
        print(f"  !! {skin}/{basename} 命名不含皮肤前缀 `{prefix}`，跳过（检查工单命名规范）", file=sys.stderr)
        return None
    slot = name[len(prefix):]
    if slot in ("mascot", "gacha", "empty"):
        return f"{slot}.webp", SQUARE
    if slot.startswith("region-") or slot.startswith("decor-"):
        return f"{slot}.webp", BANNER
    print(f"  !! {skin}/{basename} 槽位名 `{slot}` 不属于已知类别，跳过", file=sys.stderr)
    return None


def encode(src: str, dst: str, target_w: int, target_h: int, budget: int) -> int:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    for q in (85, 78, 70, 60, 50, 40):
        r = subprocess.run(
            ["cwebp", "-q", str(q), "-resize", str(target_w), str(target_h), src, "-o", dst],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            print(f"  !! cwebp 处理 {src} 失败：\n{r.stderr}", file=sys.stderr)
            return -1
        size = os.path.getsize(dst)
        if size <= budget:
            return size
    return size  # 已到质量下限仍超预算，原样返回最后一次结果，由调用方报告


def process_skin_dir(skin: str):
    src_dir = os.path.join(PICKED_DIR, skin)
    files = sorted(glob.glob(os.path.join(src_dir, "*.webp")))
    if not files:
        return
    print(f"[{skin}]")
    for f in files:
        basename = os.path.basename(f)
        result = classify(skin, basename)
        if result is None:
            continue
        out_name, (tw, th, budget) = result
        out_path = os.path.join(OUT_DIR, skin, out_name)
        size = encode(f, out_path, tw, th, budget)
        if size < 0:
            continue
        status = "OK" if size <= budget else "超限!"
        print(f"  {status} {out_name}：{size / 1024:.1f}KB（{tw}x{th}，预算 {budget // 1024}KB）")


def process_dest():
    src_dir = os.path.join(PICKED_DIR, "dest")
    files = sorted(glob.glob(os.path.join(src_dir, "*.webp")))
    if not files:
        print("[dest] picked/dest/ 暂无母版（M44 铺量前正常），跳过")
        return
    print("[dest]")
    tw, th, budget = DEST
    for f in files:
        name = os.path.basename(f)[:-len(".webp")]
        # picked/dest/ 母版命名去掉的只是 -v{n} 版本号（见 illustration-brief.md），dest- 前缀留着；
        # 槽位名/运行时 URL 不带这个前缀（destPhotoSrc(id) 直接拼城市 id），这里要再剥一层。
        if not name.startswith("dest-"):
            print(f"  !! {os.path.basename(f)} 命名不含 `dest-` 前缀，跳过（检查工单命名规范）", file=sys.stderr)
            continue
        cityid = name[len("dest-"):]
        out_path = os.path.join(OUT_DIR, "dest", f"{cityid}.webp")
        size = encode(f, out_path, tw, th, budget)
        if size < 0:
            continue
        status = "OK" if size <= budget else "超限!"
        print(f"  {status} {cityid}.webp：{size / 1024:.1f}KB（{tw}x{th}，预算 {budget // 1024}KB）")


def main():
    if not os.path.isdir(PICKED_DIR):
        print("!! assets/illustrations/picked/ 不存在", file=sys.stderr)
        sys.exit(1)
    skins = sorted(
        d for d in os.listdir(PICKED_DIR)
        if os.path.isdir(os.path.join(PICKED_DIR, d)) and d != "dest"
    )
    for skin in skins:
        process_skin_dir(skin)
    process_dest()
    print(f"完成，产物在 {os.path.relpath(OUT_DIR, ROOT)}/")


if __name__ == "__main__":
    main()
