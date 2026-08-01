/* 收藏 / 对比 / 行程 篮子 */
import { CMP_MAX, TRIP_MAX } from "../logic/constants";
import type { TripItem } from "../logic/types";
import { byId, saveLS, state } from "../store";
import { $ } from "./dom";
import { renderMap } from "./mapview";
import { render } from "./render";
import { toast } from "./toast";
import { openTrip } from "./trip";

// M86「查看」toast action 的公共实现：关掉当前打开的弹层（详情/扭蛋/对比随便哪个）再开行程单，
// 与 dock「排行程」按钮走的是同一个 openTrip()——不额外发明第二套「打开行程单」逻辑。
function viewTrip() {
  document.querySelectorAll(".overlay.show").forEach(ov => ov.classList.remove("show"));
  openTrip();
}

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
// M86：dock 清空——点即清空、零确认弹窗（用户拍板「全站零确认弹窗先例」），代价由事后可撤销
// toast 兜底；快照式单级撤销：清空前把整份数组浅拷贝下来，撤销就是原样放回去。空篮子不弹 toast
// （没什么可清的，静默返回）。
export function clearCmp() {
  if (!state.cmp.length) return;
  const snapshot = state.cmp.slice(), n = snapshot.length;
  state.cmp = []; saveLS(); render();
  toast(`对比已清空（${n} 个）`, { action: { label: "撤销", fn: () => { state.cmp = snapshot; saveLS(); render(); } } });
}
export function clearTrip() {
  if (!state.trip.length) return;
  const snapshot = state.trip.slice(), n = snapshot.length;
  state.trip = []; saveLS(); render();
  toast(`行程已清空（${n} 站）`, { action: { label: "撤销", fn: () => { state.trip = snapshot; saveLS(); render(); } } });
}
// M86：诚实 toggle + 单级撤销。移除分支撤销要恢复被删条目的原 index/days/r——先取出条目和它的
// 下标，撤销时原样 splice 回同一位置，而不是 push 到末尾（顺序也是「原样」的一部分）。
export function toggleTrip(id: string) {
  const i = state.trip.findIndex(t => t.id === id);
  if (i >= 0) {
    const removed = state.trip[i];
    const name = byId(id)?.name ?? id;
    state.trip.splice(i, 1);
    saveLS(); render();
    // 撤销先查重：撤销窗口内该站可能已被别的路径加回（trip 全链路依赖「每站唯一」，重复条目会
    // 直接污染路书/顺路排序），已在则撤销视为无事可做。toast 单例会被后续动作顶掉只是现状巧合，
    // 不能当保护依赖。
    toast(`已移出行程：${name}（剩 ${state.trip.length} 站）`, {
      action: { label: "撤销", fn: () => { if (!state.trip.some(t => t.id === removed.id)) state.trip.splice(i, 0, removed); saveLS(); render(); } },
    });
  } else {
    if (state.trip.length >= TRIP_MAX) { toast(`一次行程最多 ${TRIP_MAX} 站，贪多嚼不烂～`); return; }
    const d = byId(id)!;
    state.trip.push({ id, days: Math.min(...d.days) });
    saveLS(); render();
    toast(`已加入行程（第 ${state.trip.length} 站）：${d.name}`, { action: { label: "查看", fn: viewTrip } });
  }
}
// M18 线路卡：把 stops 逐条展开装入行程单（复用既有路书管线，不改行程/路书任何逻辑）
// M86：升格为诚实 toggle——已装入（判定＝存在 r 标记条目）再点即整条移除，走 removeRouteFromTrip。
export function addRouteToTrip(routeId: string) {
  if (state.trip.some(t => t.r === routeId)) { removeRouteFromTrip(routeId); return; }
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
  else if (skippedFull) toast(`行程已满 ${TRIP_MAX} 站，只装入了前 ${added} 站`, { action: { label: "查看", fn: viewTrip } });
  else toast(`已把「${route.name}」整条装入行程（${added} 站）`, { action: { label: "查看", fn: viewTrip } });
}
// M86：整条移出——只删 r 标记条目，用户另外单独加的同名城市站（无 r 或 r 不同）不受牵连。
// 撤销恢复全部被删条目及其原下标：removed 按原数组顺序（下标升序）收集，撤销时也按这个顺序
// 依次 splice 回去——先插低下标的，后插的高下标在此之前的插入操作里还没被占用，天然落回原位。
export function removeRouteFromTrip(routeId: string) {
  const removed: { item: TripItem; index: number }[] = [];
  state.trip.forEach((t, i) => { if (t.r === routeId) removed.push({ item: t, index: i }); });
  if (!removed.length) return;
  const name = byId(routeId)?.name ?? routeId;
  state.trip = state.trip.filter(t => t.r !== routeId);
  saveLS(); render();
  toast(`已整条移出：《${name}》（${removed.length} 站）`, {
    action: {
      label: "撤销",
      fn: () => {
        // 同 toggleTrip 撤销的查重守卫：逐条恢复时跳过已被加回的站，防重复条目
        removed.forEach(({ item, index }) => { if (!state.trip.some(t => t.id === item.id)) state.trip.splice(index, 0, item); });
        saveLS(); render();
      },
    },
  });
}
