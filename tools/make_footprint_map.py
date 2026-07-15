#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_footprint_map.py — 一次性生成脚本（M24 足迹地图）

把中国省级行政区划 GeoJSON 简化为体积小、零依赖的 SVG path 数据（CN_MAP），
离线内嵌进 index.html，供「足迹地图」在运行时用同一套等距圆柱投影公式撒点。
本脚本运行一次生成 cn_map.js 存档，不在 build 流程里重复跑。

数据来源
--------
    https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json
    （阿里云 DataV 行政区划边界数据。下载时是 FeatureCollection，35 个
    feature：34 个省级行政区（properties.name 为全称，如「浙江省」
    「内蒙古自治区」「香港特别行政区」）+ 1 个 adcode="100000_JD"、
    properties.name 为空的 MultiPolygon —— 南海诸段线装饰要素。）

投影公式（运行时 JS 撒点必须用同一公式，见 index.html renderMap 里的用法）
--------
    x = (lng - CN_MAP.prj.lng0) * CN_MAP.prj.kx
    y = (CN_MAP.prj.lat1 - lat) * CN_MAP.prj.ky

用法
----
    python3 tools/make_footprint_map.py /path/to/100000_full.json [输出目录]

    不传输出目录时，cn_map.js 写在输入文件同目录下。stdout 打印每省简化前后
    点数、最终字节数、使用的容差等报告。
"""

import json
import math
import os
import sys

# ---- 省名全称 → 短名 ----
NAME_MAP = {
    "内蒙古自治区": "内蒙古",
    "广西壮族自治区": "广西",
    "西藏自治区": "西藏",
    "宁夏回族自治区": "宁夏",
    "新疆维吾尔自治区": "新疆",
    "香港特别行政区": "香港",
    "澳门特别行政区": "澳门",
}


def short_name(full):
    if full in NAME_MAP:
        return NAME_MAP[full]
    if full.endswith("省") or full.endswith("市"):
        return full[:-1]
    return full


# ---- 投影常量（固定，运行时 JS 必须一致）----
LNG0 = 73.0
LAT1 = 53.9
LAT_COS = math.cos(math.radians(36.5))  # KX = K * cos(36.5°)，KY = K


def project(lng, lat, k):
    kx = k * LAT_COS
    ky = k
    x = (lng - LNG0) * kx
    y = (LAT1 - lat) * ky
    return x, y


# ---- 自写 Douglas-Peucker（迭代版，避免深递归）----
def dp_simplify(points, eps):
    n = len(points)
    if n < 3:
        return points[:]
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i0, i1 = stack.pop()
        if i1 <= i0 + 1:
            continue
        x1, y1 = points[i0]
        x2, y2 = points[i1]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy)
        max_d = -1.0
        idx = -1
        for i in range(i0 + 1, i1):
            px, py = points[i]
            if norm == 0:
                d = math.hypot(px - x1, py - y1)
            else:
                d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / norm
            if d > max_d:
                max_d = d
                idx = i
        if max_d > eps:
            keep[idx] = True
            stack.append((i0, idx))
            stack.append((idx, i1))
    return [points[i] for i in range(n) if keep[i]]


def shoelace_area(pts):
    area = 0.0
    n = len(pts)
    for i in range(n - 1):
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def bbox_diag(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    if not xs:
        return 0.0
    return math.hypot(max(xs) - min(xs), max(ys) - min(ys))


def fmt_num(v):
    v = round(v, 1)
    iv = int(v)
    return str(iv) if v == iv else str(v)


def ring_path(proj_pts):
    parts = []
    for j, (x, y) in enumerate(proj_pts):
        cmd = "M" if j == 0 else "L"
        parts.append(f"{cmd}{fmt_num(x)},{fmt_num(y)}")
    parts.append("Z")
    return "".join(parts)


def load_data(path):
    with open(path, encoding="utf-8") as f:
        gj = json.load(f)
    provinces = []  # [(short_name, [ring, ring, ...])]  ring = [[lng,lat],...]
    deco_rings = []
    for feat in gj["features"]:
        props = feat.get("properties", {})
        name = props.get("name") or ""
        adcode = str(props.get("adcode") or "")
        geom = feat["geometry"]
        polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        rings = [poly[0] for poly in polys if poly]  # 只取外环，本数据集无内环
        if adcode == "100000_JD" or not name:
            deco_rings.extend(rings)
            continue
        provinces.append((short_name(name), rings))
    return provinces, deco_rings


def compute_k(provinces, deco_rings):
    max_lng = -1e9
    min_lat = 1e9
    for _, rings in provinces:
        for ring in rings:
            for lng, lat in ring:
                if lng > max_lng:
                    max_lng = lng
                if lat < min_lat:
                    min_lat = lat
    for ring in deco_rings:
        for lng, lat in ring:
            if lng > max_lng:
                max_lng = lng
            if lat < min_lat:
                min_lat = lat
    k = 1000.0 / (LAT_COS * (max_lng - LNG0))
    h = (LAT1 - min_lat) * k
    return k, h, max_lng, min_lat


def build_provinces(provinces, eps, small_diag_px, k):
    out = []
    report = []
    for name, rings in provinces:
        proj_rings_raw = [[project(lng, lat, k) for lng, lat in ring] for ring in rings]
        areas = [shoelace_area(pr) for pr in proj_rings_raw]
        largest_idx = max(range(len(areas)), key=lambda i: areas[i]) if areas else -1
        pre_pts = sum(len(r) for r in rings)
        post_pts = 0
        frags = []
        for i, ring in enumerate(rings):
            simp = dp_simplify(ring, eps)
            proj_simp = [project(lng, lat, k) for lng, lat in simp]
            is_largest = i == largest_idx
            if not is_largest:
                if len(simp) < 4 or bbox_diag(proj_simp) < small_diag_px:
                    continue
            post_pts += len(proj_simp)
            frags.append(ring_path(proj_simp))
        d = "".join(frags)
        out.append({"n": name, "d": d})
        report.append((name, pre_pts, post_pts, len(rings), len(frags)))
    return out, report


def build_deco(deco_rings, eps, k):
    frags = []
    pre = sum(len(r) for r in deco_rings)
    post = 0
    for ring in deco_rings:
        simp = dp_simplify(ring, eps)
        if len(simp) < 3:
            simp = ring  # 太短就别简化了，装饰线保留原样
        proj_simp = [project(lng, lat, k) for lng, lat in simp]
        post += len(proj_simp)
        frags.append(ring_path(proj_simp))
    return "".join(frags), pre, post


def to_json_line(vb_w, vb_h, k, prov, deco):
    kx = k * LAT_COS
    ky = k
    obj = {
        "vb": f"0 0 {vb_w} {vb_h}",
        "prj": {"lng0": LNG0, "lat1": LAT1, "kx": round(kx, 4), "ky": round(ky, 4)},
        "prov": prov,
        "deco": deco,
    }
    # 严格 JSON：双引号 key，无 NaN；json.dumps 默认满足要求
    line = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return line


def main():
    if len(sys.argv) < 2:
        print("用法: python3 tools/make_footprint_map.py /path/to/100000_full.json [输出目录]", file=sys.stderr)
        sys.exit(1)
    src = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(src))
    out_path = os.path.join(out_dir, "cn_map.js")

    provinces, deco_rings = load_data(src)
    assert len(provinces) == 34, f"期望 34 个省级 feature，实际 {len(provinces)}"

    k, h_raw, max_lng, min_lat = compute_k(provinces, deco_rings)
    vb_w = 1000
    vb_h = int(math.ceil(h_raw)) + 2  # 留 2px 余量

    budget = 160 * 1024
    eps = 0.01
    small_diag_px = 3.0
    attempt = 0
    while True:
        attempt += 1
        prov_out, report = build_provinces(provinces, eps, small_diag_px, k)
        deco_d, deco_pre, deco_post = build_deco(deco_rings, eps, k)
        line = to_json_line(vb_w, vb_h, k, prov_out, deco_d)
        nbytes = len(line.encode("utf-8"))
        print(f"[尝试 {attempt}] eps={eps:.4f}°  总字节={nbytes}  预算={budget}")
        if nbytes <= budget or eps > 0.5:
            break
        eps += 0.01 if eps < 0.05 else eps * 1.4

    assert "</script" not in line, "CN_MAP 输出中出现 </script 子串"

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("const CN_MAP = " + line + ";\n")

    print("\n==== 每省简化前后点数 ====")
    total_pre = 0
    total_post = 0
    for name, pre_pts, post_pts, n_rings, kept_rings in report:
        total_pre += pre_pts
        total_post += post_pts
        print(f"  {name}: {pre_pts} → {post_pts} 点  ({n_rings} 环 → 保留 {kept_rings} 环)")
    print(f"  [南海诸段线 deco]: {deco_pre} → {deco_post} 点")
    total_pre += deco_pre
    total_post += deco_post

    print("\n==== 汇总 ====")
    print(f"省份数: {len(prov_out)}")
    print(f"总点数: {total_pre} → {total_post}")
    print(f"最终容差 eps = {eps:.4f}°  (bbox 对角线阈值 {small_diag_px}px)")
    print(f"viewBox: 0 0 {vb_w} {vb_h}  (K={k:.4f}, KX={k*LAT_COS:.4f}, KY={k:.4f})")
    print(f"最终字节数: {nbytes} bytes ({nbytes/1024:.1f} KB)，上限 200KB，目标 160KB")
    print(f"输出文件: {out_path}")


if __name__ == "__main__":
    main()
