#!/usr/bin/env python3
"""合并 data/ 下六区数据与补丁 → 校验 → 发布为 public/data/ 下的静态 JSON chunk。

用法：python3 tools/build.py
改了 data/*.json 之后跑一次即可，幂等。Cloudflare 部署构建也会先跑本脚本（F41 数据闸门，
见 wrangler.jsonc build.command）——远端总是从 data/ 重新生成，本地提交的 public/data/
chunk 仅作本地预览与可审计产物，不是部署真相源。
"""
import glob, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
PUBLIC_DATA_DIR = os.path.join(ROOT, "public", "data")
CHUNK_SIZE = 40  # M37：纯粹为 HTTP 并行/分块缓存服务的批大小，无语义含义——顺序才是唯一不变式

REGIONS = {"江浙沪", "华东", "华北", "东北", "华中", "华南", "西南", "西北", "港澳"}
SEASONS = {"春", "夏", "秋", "冬"}
DAYS = {2, 3, 4, 5, 7, 10, 14}
CROWDS = {"热门", "适中", "小众"}
COSTS = {"¥", "¥¥", "¥¥¥"}
TAGS = {"美食", "博物馆", "古建筑", "古镇古村", "自然风光", "海岛海滨", "徒步", "民俗非遗", "citywalk", "夜生活", "温泉", "滑雪", "沙漠", "草原", "摄影出片", "世界遗产", "边境风情", "亲子", "实景演艺", "观星", "工业遗产"}  # M49：实景演艺/观星/工业遗产三 tag（2026-07-20 拍板）
EFFORTS = {"躺平", "正常", "费腿", "硬核"}  # effort 可为空数组=通配
DIFFICULTIES = {"直达", "一次中转", "折腾"}
COMPANIONS = {"带娃", "带爸妈", "独行", "情侣周末"}  # companions 可为空数组=通配；四档全打应写成空
TRANSPORTS = {"游轮", "轮渡", "火车"}  # F30：leg.transport 显式交通语义枚举（默认陆路/飞机由距离启发式判，无需标注）
# F24 人工海拔断言清单：标准行程方案实际到达 2500m+ 的记录（马牙山/北台/金顶/神农顶/长白山天池），
# alt 必须为 true。文本审计只能提示，这份清单是硬回归钉子——新增此类记录时人工补录。
ALT_TRUE_PIN = {"tianshan-tianchi", "wutaishan", "leshan-emeishan", "shennongjia", "changbaishan",
                "ruoergai", "shigatse", "pulan", "zanda"}
REQ = ["id", "name", "emoji", "province", "region", "crowd", "cost", "seasons", "seasonNote", "days", "transit", "tagline", "tags", "food", "museums", "architecture", "highlights", "plans", "coords", "hotel", "local", "effort", "alt", "difficulty", "companions"]

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

city_ids = {d.get("id") for _, d in all_rows}
city_by_id = {d.get("id"): d for _, d in all_rows}

# M18 线路卡：独立文件，记录自带全部字段（无需补丁），以 stops 字段区分于城市记录
routes_path = os.path.join(DATA_DIR, "routes.json")
if os.path.exists(routes_path):
    try:
        routes = json.load(open(routes_path))
    except Exception as e:
        errors.append(f"routes.json JSON 解析失败: {e}"); routes = []
    if not isinstance(routes, list):
        errors.append("routes.json 顶层不是数组"); routes = []
    all_rows += [("routes.json", d) for d in routes]

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
    if d.get("id") in ALT_TRUE_PIN and d.get("alt") is not True:
        errors.append(f"{tag} 在人工海拔断言清单（标准方案到 2500m+），alt 必须为 true（F24）")
    if d.get("difficulty") not in DIFFICULTIES: errors.append(f"{tag} difficulty 非法: {d.get('difficulty')}")
    # M56：城市卡可选布尔字段 noair/norail（无民航客运/无轨道客运，挡编造档的守卫输入）。
    # 判定口径=本体粒度三档（见 design M56）；仅城市卡可标，线路卡通达性由停留站传导，不自带。
    for gk in ("noair", "norail"):
        if gk in d:
            if not isinstance(d[gk], bool): errors.append(f"{tag} {gk} 非法(需布尔): {d[gk]}")
            if "stops" in d: errors.append(f"{tag} 线路卡不得标 {gk}（通达性归停留站城市卡）")
    cp = d.get("companions")
    if not isinstance(cp, list) or any(x not in COMPANIONS for x in cp) or len(set(cp)) != len(cp) or len(cp) >= 4: errors.append(f"{tag} companions 非法(四档全打应留空): {cp}")
    for k in ["food", "museums", "architecture", "highlights"]:
        if not isinstance(d.get(k), list): errors.append(f"{tag} {k} 不是数组")
    pl = d.get("plans")
    if not isinstance(pl, list) or not pl:
        errors.append(f"{tag} plans 为空")
    else:
        for p2 in pl:
            if not isinstance(p2, dict) or not isinstance(p2.get("days"), int) or not p2.get("title") or not p2.get("route"):
                errors.append(f"{tag} plan 结构非法")
            # M29 路线型每晚落脚点：可选 stays，与该方案 days 等长，stays[i]=第 i 天晚上睡哪
            elif "stays" in p2:
                stv = p2["stays"]
                if (not isinstance(stv, list) or len(stv) != p2["days"]
                        or any(not isinstance(x, str) or not x.strip() for x in stv)):
                    errors.append(f"{tag} plan {p2.get('days')}天 stays 非法(需与 days 等长的非空字符串数组): {stv}")
    c = d.get("coords")
    if (not isinstance(c, list) or len(c) != 2
            or not all(isinstance(x, (int, float)) for x in c)
            or not (18 <= c[0] <= 54 and 73 <= c[1] <= 135)):
        errors.append(f"{tag} coords 非法: {c}")
    # F22/F24：海拔风险常在路上或山顶（垭口/达坂/北台/金顶），代理字段可能漏判。文本出现明确高海拔
    # 信号却 alt=false 时给非阻塞警告——城市卡与线路卡都查（原只查线路，F24 后泛化）；不从自由文本硬判。
    if not d.get("alt"):
        blob = " ".join([d.get("seasonNote", ""), d.get("tagline", "")] + d.get("highlights", [])
                        + [p.get("route", "") for p in (d.get("plans") or []) if isinstance(p, dict)])
        if re.search(r"达坂|垭口|海拔\s*[3-5]\d{3}|[3-5]\d{3}\s*[m米]", blob):
            warnings.append(f"{tag} 文本含高海拔信号（达坂/垭口/3000m+）但 alt=false，请人工复核是否应示警")
    # M18 线路卡：stops 字段存在即为线路卡，额外校验；regions 供多区域筛选，缺省时前端以 [region] 兜底
    if "stops" in d:
        # F8：线路名不得带日数——事实天数由 stops 分配决定，名称写死日数必然漂移
        if re.search(r"\d\s*[日天]", d.get("name", "")):
            errors.append(f"{tag} 线路名称不得含日数（改由卡面「约N~M天 · 默认Σ天」展示）: {d['name']}")
        st = d.get("stops")
        if not isinstance(st, list) or not (2 <= len(st) <= 4):
            errors.append(f"{tag} stops 长度非法(需 2~4): {st}")
        else:
            for s in st:
                if not isinstance(s, dict) or not isinstance(s.get("id"), str) or not isinstance(s.get("days"), int):
                    errors.append(f"{tag} stop 结构非法: {s}")
                elif s["id"] not in city_ids:
                    errors.append(f"{tag} stop 引用不存在的城市 id: {s['id']}")
                # F18：线路 stop 可选 leg={route, stays}=该段「线路视角」逐日文案，路书优先于城市独立游方案。
                # stays 须与 stop.days 等长（逐日骨架每晚落脚点），route 为非空行程文字。
                elif "leg" in s:
                    lg = s["leg"]
                    if not isinstance(lg, dict) or not isinstance(lg.get("route"), str) or not lg["route"].strip():
                        errors.append(f"{tag} stop {s['id']} leg.route 非法(需非空字符串): {lg}")
                    elif (not isinstance(lg.get("stays"), list) or len(lg["stays"]) != s["days"]
                            or any(not isinstance(x, str) or not x.strip() for x in lg["stays"])):
                        errors.append(f"{tag} stop {s['id']} leg.stays 非法(需与 days={s['days']} 等长的非空字符串数组): {lg.get('stays')}")
                    # F30：leg 可选 transport=显式交通语义（游轮/轮渡/火车），路书据此覆盖距离启发式，避免非公路 leg 被 F29 标成自驾
                    elif "transport" in lg and lg["transport"] not in TRANSPORTS:
                        errors.append(f"{tag} stop {s['id']} leg.transport 非法(需 ∈ {sorted(TRANSPORTS)}): {lg.get('transport')}")
            # F31：线路可选 entry/exit=进出门户城市 id（如三亚进、海口出，与首末停留站不同），须引用存在的城市
            for gk in ("entry", "exit"):
                if gk in d and d[gk] not in city_ids:
                    errors.append(f"{tag} {gk} 门户引用不存在的城市 id: {d[gk]}")
            ok = [s for s in st if isinstance(s, dict) and isinstance(s.get("days"), int) and s.get("id") in city_ids]
            if len(ok) == len(st):
                sids = [s["id"] for s in st]
                if len(set(sids)) != len(sids):
                    errors.append(f"{tag} stops 内有重复站点: {sids}")
                for s in st:
                    cmax = max(city_by_id[s["id"]]["days"])
                    if not (1 <= s["days"] <= cmax):
                        errors.append(f"{tag} stop {s['id']} 建议天数 {s['days']} 越界(1~{cmax})")
                # 单一天数分配是事实真相；days 枚举是筛选档位，须包住合计（min ≤ Σstop.days ≤ max）
                sm = sum(s["days"] for s in st)
                dy = d.get("days")
                if isinstance(dy, list) and dy and not (min(dy) <= sm <= max(dy)):
                    errors.append(f"{tag} 站点天数合计 {sm} 不在 days 档位区间 [{min(dy)},{max(dy)}]")
                # 高海拔保守口径：任一停留站 alt=true，线路必须 alt=true
                if any(city_by_id[s["id"]].get("alt") for s in st) and not d.get("alt"):
                    errors.append(f"{tag} 途经高海拔站点但线路 alt=false（健康警示需保守）")
                # F8：线路装入后各站下拉放开为 1~城市上限，故每个 days 档必须 ∈ [站数, Σ城市上限] 才能在行程单调出
                # （F23：此块必须留在 len(ok)==len(st) 通用校验层，勿被后加的分支缩进吞掉——曾因 F22 审计块漂移而对全部线路失效）
                lo, hi = len(st), sum(max(city_by_id[s["id"]]["days"]) for s in st)
                for dv in dy:
                    if not (lo <= dv <= hi):
                        errors.append(f"{tag} days 档 {dv} 在行程单不可达（可达区间 [{lo},{hi}]）")
                # F26：plan 文本叙事顺序不得与 stops 逆行（曾出现 5 日版整条倒着走）。只查名字段出现的站，
                # 漏站无法从自由文本可靠判定（海拉尔≠呼伦贝尔），覆盖性靠人工评审。非阻塞警告。
                for p2 in (d.get("plans") or []):
                    rt = p2.get("route", "") if isinstance(p2, dict) else ""
                    pos = []
                    for s in st:
                        segs = [x for x in re.split(r"[·\s]+", city_by_id[s["id"]]["name"]) if x]
                        found = [rt.find(x) for x in segs if rt.find(x) >= 0]
                        if found: pos.append(min(found))
                    if pos != sorted(pos):
                        warnings.append(f"{tag} plan {p2.get('days')}天 文本站点顺序与 stops 不一致，请人工复核（F26）")
        rg = d.get("regions")
        if not isinstance(rg, list) or not rg or any(x not in REGIONS for x in rg):
            errors.append(f"{tag} regions 非法: {rg}")

if errors:
    print("== 校验错误 ==\n" + "\n".join(errors), file=sys.stderr)
    sys.exit(1)
if warnings:
    print("== 警告(不阻塞) ==\n" + "\n".join(warnings), file=sys.stderr)

ORDER = ["江浙沪", "华东", "华北", "东北", "华中", "华南", "西南", "西北", "港澳"]
merged = sorted((d for _, d in all_rows), key=lambda d: ORDER.index(d["region"]))

# M37：不再注入 index.html，改发布为 public/data/ 下的静态 chunk（纯按固定批大小切分，
# 无地理语义）。chunk 内部顺序=拼接顺序=merged 的全局顺序——filtered() 在用户未选排序方式时
# 直接用 DATA 的原始顺序展示，故 manifest 的文件顺序是不变式，运行时必须按序拼接、不能按
# fetch 完成顺序拼接。
# F42：文件名带内容 hash（而非固定 chunk-N.json）才能安全 immutable 长缓存——数据一变
# hash 就变，旧客户端手里的旧 manifest 仍指向旧 hash 文件，不会读到半新不旧的内容；
# manifest.json 本身文件名不变，靠 Worker 侧短缓存/must-revalidate 保证客户端能发现新 hash。
os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
for stale in glob.glob(os.path.join(PUBLIC_DATA_DIR, "chunk-*.json")):
    os.remove(stale)

chunk_names = []
for i in range(0, len(merged), CHUNK_SIZE):
    batch = merged[i:i + CHUNK_SIZE]
    chunk_json = json.dumps(batch, ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256(chunk_json.encode("utf-8")).hexdigest()[:10]
    name = f"chunk-{i // CHUNK_SIZE}-{digest}.json"
    open(os.path.join(PUBLIC_DATA_DIR, name), "w", encoding="utf-8").write(chunk_json)
    chunk_names.append(name)
open(os.path.join(PUBLIC_DATA_DIR, "manifest.json"), "w", encoding="utf-8").write(
    json.dumps(chunk_names, ensure_ascii=False))

by_region = {}
for d in merged:
    by_region[d["region"]] = by_region.get(d["region"], 0) + 1
n_routes = sum(1 for d in merged if "stops" in d)
total_bytes = sum(os.path.getsize(os.path.join(PUBLIC_DATA_DIR, n)) for n in chunk_names)
print(f"OK: {len(merged) - n_routes} 个目的地 + {n_routes} 条线路（共 {len(merged)} 条），"
      f"发布 {len(chunk_names)} 个 chunk 到 public/data/ ({total_bytes // 1024}KB)")
print("  ".join(f"{k}:{v}" for k, v in by_region.items()))
