/* 事件（文档级委托 + 静态元素接线；行为与旧版逐条一致） */
import type { Destination } from "../logic/types";
import { byId, saveLS, state } from "../store";
import { addRouteToTrip, toggleCmp, toggleFav, toggleTrip, toggleVisited } from "./actions";
import { copyText } from "./clipboard";
import { openCompare } from "./compare";
import { resetFilters } from "./console";
import { openDetail } from "./detail";
import { $ } from "./dom";
import { clearPile, getLastPick, openGacha, pileToCompare, roll, tossEgg } from "./gacha";
import { openMap } from "./mapview";
import { openOrigin, selectOrigin } from "./origin";
import { applyIntent, applyRelax, clearDistModeFilter, render } from "./render";
import { currentRoadbookText, openRoadbook, shareCurrentRoadbook } from "./roadbook";
import { forgetSync, generateShareCode, importJSON, openShare, renderShareQR, shareJSON, shareLink, syncNow } from "./share";
import { openSkin, selectSkin } from "./skin";
import { toast } from "./toast";
import { autoOrder, insertOnWay, openTrip, renderTrip } from "./trip";

// M63 揭晓卡「加入行程」：线路卡整条展开装入，城市卡去重加入（承接退役的 gTripBtn 逻辑）
function gachaAddTrip() {
  const p = getLastPick();
  if (!p) return;
  if (p.stops) { addRouteToTrip(p.id); return; }
  if (!state.trip.some(t => t.id === p.id)) toggleTrip(p.id); else toast("已经在行程里啦");
}

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
    if (rmCmp) {
      toggleCmp(rmCmp.dataset.rmcmp!);
      // M69：对比表开着时就地刷新——够 2 个继续比，不够就收摊（对比池还剩 1 个，继续抽或从卡片再加）
      if ($("cmpOverlay").classList.contains("show")) {
        if (state.cmp.length >= 2) openCompare();
        else { $("cmpOverlay").classList.remove("show"); toast("对比池只剩 1 个啦，再攒一个继续比"); }
      }
      return;
    }
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
    // M22 出发地选项（#originBody 每次重生成，走委托，同 data-skin 习语）
    const org = t.closest<HTMLElement>("[data-origin]");
    if (org) { selectOrigin(org.dataset.origin!); return; }
    // M63 揭晓卡动作（#gReveal 每次重生成，走委托）：继续扭 / 看详情 / 加入行程
    const gact = t.closest<HTMLElement>("[data-gact]");
    if (gact) {
      const a = gact.dataset.gact;
      if (a === "roll") roll();
      else if (a === "detail") { const p = getLastPick(); if (p) openDetail(p.id); }
      else if (a === "trip") gachaAddTrip();
      return;
    }
    // M63 蛋堆小卡：× 扔回池（先判，避免被壳体的开详情吞掉）；壳体点按 = 开详情
    const gtoss = t.closest<HTMLElement>("[data-gtoss]");
    if (gtoss) { tossEgg(gtoss.dataset.gtoss!); return; }
    const gegg = t.closest<HTMLElement>("[data-gegg]");
    if (gegg) { openDetail(gegg.dataset.gegg!); return; }
    const card = t.closest<HTMLElement>(".card");
    if (card && !t.closest(".act")) openDetail(card.dataset.id!);
  });
  document.addEventListener("change", e => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-days]");
    if (sel) { state.trip[+sel.dataset.days!].days = +sel.value; saveLS(); renderTrip(); }
  });

  $("cmpGo").addEventListener("click", openCompare);
  $("tripGo").addEventListener("click", openTrip);
  $("cmpGachaGo").addEventListener("click", () => openGacha(state.cmp.map(byId).filter((d): d is Destination => !!d))); // M53：对比池抽签
  $("cmpTableGachaGo").addEventListener("click", () => {
    $("cmpOverlay").classList.remove("show"); // 两层 overlay 同 z-index，DOM 序更晚的 cmpOverlay 不关就会盖住新开的 gachaOverlay
    openGacha(state.cmp.map(byId).filter((d): d is Destination => !!d));
  });
  $("cmpClear").addEventListener("click", () => { state.cmp = []; saveLS(); render(); toast("对比已清空"); });
  $("tripClear").addEventListener("click", () => { state.trip = []; saveLS(); render(); toast("行程已清空"); });
  $("footPill").addEventListener("click", openMap); // 足迹统计胶囊本身即地图入口（M50 修订）
  $("originPill").addEventListener("click", openOrigin); // M22 出发地胶囊即选择器入口
  $("shareBtn").addEventListener("click", openShare);
  $("skinBtn").addEventListener("click", openSkin);
  $("fabGacha").addEventListener("click", () => openGacha()); // 全量池入口；直传 openGacha 会把 MouseEvent 当成 cmpPool 参数传入，必须包一层

  $("gKnob").addEventListener("click", roll);
  $("empty").addEventListener("click", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-relax]");
    if (b) applyRelax(+b.dataset.relax!);
  });
  $("emptyResetBtn").addEventListener("click", resetFilters);
  $("intentBox").addEventListener("click", e => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-intent]")) applyIntent();
    else if (t.closest("[data-clear-dist]")) clearDistModeFilter();
  });
  $("gRelaxBtn").addEventListener("click", () => { applyRelax(0); openGacha(); });
  $("gPileCmp").addEventListener("click", pileToCompare);   // 整堆拿去对比
  $("gPileClear").addEventListener("click", clearPile);
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
    if (e.key === "Escape") { document.querySelectorAll(".overlay.show").forEach(o => o.classList.remove("show")); return; }
    // M63 蛋堆小卡 role=button：Enter/空格开详情（键盘可达）
    if (e.key === "Enter" || e.key === " ") {
      const egg = (e.target as HTMLElement).closest<HTMLElement>("[data-gegg]");
      if (egg) { e.preventDefault(); openDetail(egg.dataset.gegg!); }
    }
  });
}
