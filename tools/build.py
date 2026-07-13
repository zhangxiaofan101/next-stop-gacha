#!/usr/bin/env python3
"""合并 data/ 下六区数据与补丁 → 校验 → 注入 index.html 的 DATA 数组。

用法：python3 tools/build.py
改了 data/*.json 之后跑一次即可，幂等。
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
HTML = os.path.join(ROOT, "index.html")

REGIONS = {"江浙沪", "华东", "华北", "东北", "华中", "华南", "西南", "西北", "港澳"}
SEASONS = {"春", "夏", "秋", "冬"}
DAYS = {2, 3, 4, 5, 7, 10, 14}
CROWDS = {"热门", "适中", "小众"}
COSTS = {"¥", "¥¥", "¥¥¥"}
TAGS = {"美食", "博物馆", "古建筑", "古镇古村", "自然风光", "海岛海滨", "徒步", "民俗非遗", "citywalk", "夜生活", "温泉", "滑雪", "沙漠", "草原", "摄影出片", "世界遗产", "边境风情", "亲子"}
EFFORTS = {"躺平", "正常", "费腿", "硬核"}  # effort 可为空数组=通配
REQ = ["id", "name", "emoji", "province", "region", "crowd", "cost", "seasons", "seasonNote", "days", "transit", "tagline", "tags", "food", "museums", "architecture", "highlights", "plans", "coords", "hotel", "local", "effort", "alt"]

files = [f"data-{c}.json" for c in "abcdef"]
all_rows, errors, warnings = [], [], []

for f in files:
    p = os.path.join(DATA_DIR, f)
    if not os.path.exists(p):
        errors.append(f"缺文件: {f}"); continue
    try:
        arr = json.load(open(p))
    except Exception as e:
        errors.append(f"{f} JSON 解析失败: {e}"); continue
    if not isinstance(arr, list):
        errors.append(f"{f} 顶层不是数组"); continue
    pp = p.replace(".json", "-patch.json")
    patch = {}
    if os.path.exists(pp):
        try:
            patch = json.load(open(pp))
        except Exception as e:
            errors.append(f"{os.path.basename(pp)} JSON 解析失败: {e}")
    else:
        errors.append(f"缺补丁文件: {os.path.basename(pp)}")
    for d in arr:
        pt = patch.get(d.get("id"))
        if pt:
            d.update(pt)
        else:
            errors.append(f"{f}/{d.get('id')} 缺补丁(coords/hotel/local)")
    all_rows += [(f, d) for d in arr]

seen_id, seen_name = {}, {}
for src, d in all_rows:
    tag = f"{src}/{d.get('id') if isinstance(d, dict) else '?'}"
    if not isinstance(d, dict):
        errors.append(f"{tag} 不是对象"); continue
    for k in REQ:
        if k not in d: errors.append(f"{tag} 缺字段 {k}")
    if d.get("id") in seen_id: errors.append(f"id 重复: {d['id']} ({seen_id[d['id']]} & {src})")
    seen_id[d.get("id")] = src
    nk = str(d.get("name", "")).replace("·", "").replace(" ", "")
    if nk in seen_name: warnings.append(f"name 疑似重复: {d.get('name')} ({seen_name[nk]} & {src})")
    seen_name[nk] = src
    if d.get("region") not in REGIONS: errors.append(f"{tag} region 非法: {d.get('region')}")
    if d.get("crowd") not in CROWDS: errors.append(f"{tag} crowd 非法: {d.get('crowd')}")
    if d.get("cost") not in COSTS: errors.append(f"{tag} cost 非法: {d.get('cost')}")
    s = d.get("seasons")
    if not isinstance(s, list) or not s or any(x not in SEASONS for x in s): errors.append(f"{tag} seasons 非法: {s}")
    dy = d.get("days")
    if not isinstance(dy, list) or not dy or any(x not in DAYS for x in dy): errors.append(f"{tag} days 非法: {dy}")
    t = d.get("tags")
    if not isinstance(t, list) or any(x not in TAGS for x in t): errors.append(f"{tag} tags 非法: {t}")
    ef = d.get("effort")
    if not isinstance(ef, list) or any(x not in EFFORTS for x in ef) or len(set(ef)) != len(ef): errors.append(f"{tag} effort 非法: {ef}")
    if not isinstance(d.get("alt"), bool): errors.append(f"{tag} alt 非法: {d.get('alt')}")
    for k in ["food", "museums", "architecture", "highlights"]:
        if not isinstance(d.get(k), list): errors.append(f"{tag} {k} 不是数组")
    pl = d.get("plans")
    if not isinstance(pl, list) or not pl:
        errors.append(f"{tag} plans 为空")
    else:
        for p2 in pl:
            if not isinstance(p2, dict) or not isinstance(p2.get("days"), int) or not p2.get("title") or not p2.get("route"):
                errors.append(f"{tag} plan 结构非法")
    c = d.get("coords")
    if (not isinstance(c, list) or len(c) != 2
            or not all(isinstance(x, (int, float)) for x in c)
            or not (18 <= c[0] <= 54 and 73 <= c[1] <= 135)):
        errors.append(f"{tag} coords 非法: {c}")

if errors:
    print("== 校验错误 ==\n" + "\n".join(errors), file=sys.stderr)
    sys.exit(1)
if warnings:
    print("== 警告(不阻塞) ==\n" + "\n".join(warnings), file=sys.stderr)

ORDER = ["江浙沪", "华东", "华北", "东北", "华中", "华南", "西南", "西北", "港澳"]
merged = sorted((d for _, d in all_rows), key=lambda d: ORDER.index(d["region"]))

data_json = json.dumps(merged, ensure_ascii=False, separators=(",", ":"))
if "</script" in data_json:
    print("数据中含 </script，需转义", file=sys.stderr); sys.exit(1)

html = open(HTML, encoding="utf-8").read()
new_line = f"const DATA = {data_json};"
if "/*__DATA__*/[]" in html:
    html = html.replace("const DATA = /*__DATA__*/[];", new_line, 1)
else:
    html, n = re.subn(r"const DATA = \[.*?\];", lambda m: new_line, html, count=1, flags=re.S)
    if n != 1:
        print("index.html 中找不到 DATA 注入点", file=sys.stderr); sys.exit(1)
open(HTML, "w", encoding="utf-8").write(html)

by_region = {}
for d in merged:
    by_region[d["region"]] = by_region.get(d["region"], 0) + 1
print(f"OK: 共 {len(merged)} 个目的地，已注入 index.html ({len(html.encode('utf-8'))//1024}KB)")
print("  ".join(f"{k}:{v}" for k, v in by_region.items()))
