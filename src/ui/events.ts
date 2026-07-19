/* 事件（文档级委托 + 静态元素接线；行为与旧版逐条一致） */
import { saveLS, state } from "../store";
import { addRouteToTrip, toggleCmp, toggleFav, toggleTrip, toggleVisited } from "./actions";
import { copyText } from "./clipboard";
import { openCompare } from "./compare";
import { resetFilters } from "./console";
import { openDetail } from "./detail";
import { $ } from "./dom";
import { getLastPick, openGacha, roll } from "./gacha";
import { applyRelax, render } from "./render";
import { currentRoadbookText, openRoadbook, shareCurrentRoadbook } from "./roadbook";
import { forgetSync, generateShareCode, importJSON, renderShareQR, shareJSON, shareLink, syncNow } from "./share";
import { selectSkin } from "./skin";
import { toast } from "./toast";
import { autoOrder, insertOnWay, openTrip, renderTrip } from "./trip";

export function wireEvents() {
  document.addEventListener("click", e => {
    const t = e.target as HTMLElement;
    const fav = t.closest<HTMLElement>("[data-fav]");
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav!); return; }
    const cmp = t.closest<HTMLElement>("[data-cmp]");
    if (cmp) { e.stopPropagation(); toggleCmp(cmp.dataset.cmp!); if (cmp.closest("#detailBody")) openDetail(cmp.dataset.cmp!); return; }
    const trip = t.closest<HTMLElement>("[data-trip]");
    if (trip) { e.stopPropagation(); toggleTrip(trip.dataset.trip!); if (trip.closest("#detailBody")) openDetail(trip.dataset.trip!); return; }
    const onway = t.closest<HTMLElement>("[data-onway]");
    if (onway) { insertOnWay(onway.dataset.onway!); return; }
    const addRoute = t.closest<HTMLElement>("[data-addroute]");
    if (addRoute) { e.stopPropagation(); addRouteToTrip(addRoute.dataset.addroute!); return; }
    const rmCmp = t.closest<HTMLElement>("[data-rmcmp]");
    if (rmCmp) { toggleCmp(rmCmp.dataset.rmcmp!); return; }
    const rmTrip = t.closest<HTMLElement>("[data-rmtrip]");
    if (rmTrip) { toggleTrip(rmTrip.dataset.rmtrip!); return; }
    const up = t.closest<HTMLElement>("[data-up]");
    if (up) { const i = +up.dataset.up!; if (i > 0) { [state.trip[i - 1], state.trip[i]] = [state.trip[i], state.trip[i - 1]]; saveLS(); renderTrip(); } return; }
    const down = t.closest<HTMLElement>("[data-down]");
    if (down) { const i = +down.dataset.down!; if (i < state.trip.length - 1) { [state.trip[i + 1], state.trip[i]] = [state.trip[i], state.trip[i + 1]]; saveLS(); renderTrip(); } return; }
    const del = t.closest<HTMLElement>("[data-del]");
    if (del) { state.trip.splice(+del.dataset.del!, 1); saveLS(); renderTrip(); render(); return; }
    if (t.id === "copyRbBtn") { copyText(currentRoadbookText()); return; }
    if (t.id === "printRbBtn") { window.print(); return; }
    if (t.id === "shareRbBtn") { shareCurrentRoadbook(); return; }
    const vis = t.closest<HTMLElement>("[data-visited]");
    if (vis) { e.stopPropagation(); toggleVisited(vis.dataset.visited!); if (vis.closest("#detailBody")) openDetail(vis.dataset.visited!); return; }
    const mapDot = t.closest<HTMLElement>("[data-mapdot]");
    if (mapDot) { e.stopPropagation(); openDetail(mapDot.dataset.mapdot!); return; }
    const skin = t.closest<HTMLElement>("[data-skin]");
    if (skin) { selectSkin(skin.dataset.skin!); return; }
    const card = t.closest<HTMLElement>(".card");
    if (card && !t.closest(".act")) openDetail(card.dataset.id!);
  });
  document.addEventListener("change", e => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-days]");
    if (sel) { state.trip[+sel.dataset.days!].days = +sel.value; saveLS(); renderTrip(); }
  });

  $("cmpGo").addEventListener("click", openCompare);
  $("tripGo").addEventListener("click", openTrip);
  $("cmpClear").addEventListener("click", () => { state.cmp = []; saveLS(); render(); toast("对比已清空"); });
  $("tripClear").addEventListener("click", () => { state.trip = []; saveLS(); render(); toast("行程已清空"); });
  $("fabGacha").addEventListener("click", openGacha);
  $("gKnob").addEventListener("click", roll);
  $("empty").addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-relax]");
    if (b) applyRelax(+b.dataset.relax!);
  });
  $("emptyResetBtn").addEventListener("click", resetFilters);
  $("gRelaxBtn").addEventListener("click", () => { applyRelax(0); openGacha(); });
  $("gDetailBtn").addEventListener("click", () => { const p = getLastPick(); if (p) openDetail(p.id); });
  $("gTripBtn").addEventListener("click", () => {
    const lastPick = getLastPick();
    if (!lastPick) return;
    if (lastPick.stops) { addRouteToTrip(lastPick.id); return; } // 线路卡：整条展开装入
    if (!state.trip.some(t => t.id === lastPick.id)) toggleTrip(lastPick.id); else toast("已经在行程里啦");
  });
  $("shareLinkBtn").addEventListener("click", () => copyText(shareLink()));
  $("shareQrBtn").addEventListener("click", renderShareQR);
  $("shareJsonBtn").addEventListener("click", () => copyText(shareJSON()));
  $("shareShortBtn").addEventListener("click", generateShareCode);
  $("syncNowBtn").addEventListener("click", syncNow);
  $("syncForgetBtn").addEventListener("click", forgetSync);
  $("importBtn").addEventListener("click", importJSON);
  $("autoOrderBtn").addEventListener("click", autoOrder);
  $<HTMLInputElement>("tripStartInput").addEventListener("change", e => {
    const v = (e.target as HTMLInputElement).value;
    state.tripStart = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
    saveLS();
  });
  $("clearTripBtn").addEventListener("click", () => { state.trip = []; saveLS(); renderTrip(); render(); });
  $("makeRoadbookBtn").addEventListener("click", openRoadbook);
  document.querySelectorAll(".overlay").forEach(ov => {
    ov.addEventListener("click", e => {
      if (e.target === ov || (e.target as HTMLElement).closest("[data-close]")) ov.classList.remove("show");
    });
  });
  addEventListener("keydown", e => {
    if (e.key === "Escape") document.querySelectorAll(".overlay.show").forEach(o => o.classList.remove("show"));
  });
}
