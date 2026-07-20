/* 收藏 / 对比 / 行程 篮子 */
import { CMP_MAX, TRIP_MAX } from "../logic/constants";
import { byId, saveLS, state } from "../store";
import { $ } from "./dom";
import { renderMap } from "./mapview";
import { render } from "./render";
import { toast } from "./toast";

export function toggleFav(id: string) {
  const i = state.favs.indexOf(id);
  i >= 0 ? state.favs.splice(i, 1) : state.favs.push(id);
  saveLS(); render();
  if ($("mapOverlay").classList.contains("show")) renderMap();
}
export function toggleVisited(id: string) {
  const i = state.visited.indexOf(id);
  if (i >= 0) { state.visited.splice(i, 1); toast("已取消打卡"); }
  else { state.visited.push(id); toast(`👣 已打卡：${byId(id)!.name}`); }
  saveLS(); render();
  if ($("mapOverlay").classList.contains("show")) renderMap();
}
export function toggleCmp(id: string) {
  const i = state.cmp.indexOf(id);
  if (i >= 0) state.cmp.splice(i, 1);
  else {
    if (state.cmp.length >= CMP_MAX) { toast(`最多对比 ${CMP_MAX} 个哦`); return; }
    state.cmp.push(id);
  }
  saveLS(); render();
}
export function toggleTrip(id: string) {
  const i = state.trip.findIndex(t => t.id === id);
  if (i >= 0) state.trip.splice(i, 1);
  else {
    if (state.trip.length >= TRIP_MAX) { toast(`一次行程最多 ${TRIP_MAX} 站，贪多嚼不烂～`); return; }
    const d = byId(id)!;
    state.trip.push({ id, days: Math.min(...d.days) });
    toast(`已加入行程：${d.name}`);
  }
  saveLS(); render();
}
// M18 线路卡：把 stops 逐条展开装入行程单（复用既有路书管线，不改行程/路书任何逻辑）
export function addRouteToTrip(routeId: string) {
  const route = byId(routeId); if (!route || !route.stops) return;
  let added = 0, skippedFull = false;
  for (const s of route.stops) {
    if (state.trip.some(t => t.id === s.id)) continue;
    if (state.trip.length >= TRIP_MAX) { skippedFull = true; break; }
    state.trip.push({ id: s.id, days: s.days, r: routeId }); // r=线路 id：既是装入标记（下拉放开 1~城市上限），也让路书回查该线路 stop 的专属逐日文案（F18）
    added++;
  }
  saveLS(); render();
  if (added === 0) toast(skippedFull ? "行程已满，一站都没装进去" : "这条线路的站点都已在行程里啦");
  else if (skippedFull) toast(`行程已满 ${TRIP_MAX} 站，只装入了前 ${added} 站`);
  else toast(`已把「${route.name}」整条装入行程（${added} 站）`);
}
