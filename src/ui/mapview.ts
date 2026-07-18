/* 足迹地图 */
// 零依赖 SVG 中国地图：CN_MAP（tools/make_footprint_map.py 离线生成）
import { CN_MAP } from "../cn-map";
import { projectPoint } from "../logic/map";
import { byId, DATA, state } from "../store";
import { $ } from "./dom";
import { litVisitedProvinces } from "./render";

export function openMap() {
  renderMap();
  $("mapOverlay").classList.add("show");
}
export function renderMap() {
  const visited = state.visited.map(byId).filter(Boolean); // state.visited 只存城市 id
  const lit = litVisitedProvinces(); // F11：与填色/足迹胶囊同一口径
  const statHTML = visited.length
    ? `<div class="map-stat">👣 去过 ${visited.length} 个目的地 · 点亮 ${lit.length} 个省份 · ♥ 收藏 ${state.favs.length}</div>`
    : `<div class="map-empty">还没打卡过——去任意目的地详情页点『👣 打卡去过』，地图就会亮起来</div>`;
  const litSet = new Set(lit);
  const provPaths = CN_MAP.prov.map(p => {
    const on = litSet.has(p.n);
    return `<path d="${p.d}" fill="${on ? "#dcf3dd" : "#f4f7fb"}" stroke="${on ? "#7fae8e" : "#b9c9dd"}" stroke-width="1"></path>`;
  }).join("");
  const decoPath = `<path d="${CN_MAP.deco}" stroke="#b9c9dd" stroke-dasharray="3 3" fill="none"></path>`;
  const visitedIds = new Set(state.visited);
  const favIds = new Set(state.favs);
  const grayDots: string[] = [], hotDots: string[] = []; // 已打卡/收藏点后画，压在灰点上层
  DATA.forEach(d => {
    const coords = (d.stops && d.stops.length ? byId(d.stops[0].id)?.coords : d.coords) || null; // 线路卡取首站坐标
    if (!coords) return;
    const { x, y } = projectPoint(coords, CN_MAP.prj);
    const isVisited = !d.stops && visitedIds.has(d.id);
    const isFav = favIds.has(d.id);
    const hit = `<circle class="map-dot" cx="${x}" cy="${y}" r="7" fill="transparent" data-mapdot="${d.id}"></circle>`;
    let mark;
    if (isFav) {
      mark = `<text x="${x}" y="${y}" font-size="13" text-anchor="middle" dominant-baseline="central" fill="#ff6b81" stroke="#fff" stroke-width="0.5" paint-order="stroke" pointer-events="none">♥</text>`;
    } else if (isVisited) {
      mark = `<circle cx="${x}" cy="${y}" r="3.5" fill="#2e7d43" stroke="#fff" stroke-width="1" pointer-events="none"></circle>`;
    } else {
      mark = `<circle cx="${x}" cy="${y}" r="2.2" fill="#b9c6d6" pointer-events="none"></circle>`;
    }
    (isFav || isVisited ? hotDots : grayDots).push(`<g>${hit}${mark}</g>`);
  });
  $("mapBody").innerHTML = `
    <h2 style="font-family:var(--round); margin:0 0 4px">🗺 我的足迹地图</h2>
    ${statHTML}
    <div class="map-legend">
      <span><span class="lg-dot" style="background:#b9c6d6"></span>灰点 = 没去过</span>
      <span><span class="lg-dot" style="background:#2e7d43"></span>绿点 = 去过</span>
      <span>♥ = 收藏</span>
    </div>
    <div class="map-scroll">
      <svg viewBox="${CN_MAP.vb}" xmlns="http://www.w3.org/2000/svg">
        ${provPaths}
        ${decoPath}
        ${grayDots.join("")}
        ${hotDots.join("")}
      </svg>
    </div>
    <p class="map-foot">点地图上的点可看详情 · 省界为简化示意</p>`;
}
