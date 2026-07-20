/* 扭蛋 */
import { DAY_BUCKETS } from "../logic/constants";
import { filtered } from "../logic/filter";
import { gachaPick } from "../logic/gacha";
import type { Destination } from "../logic/types";
import { regionHeaderSrc } from "../skins/illustrations";
import { CUR_SEASON, DATA, state } from "../store";
import { cardHTML } from "./cards";
import { $ } from "./dom";
import { confetti } from "./effects";
import { computeRelax } from "./render";

let rolling = false, lastPick: Destination | null = null;
export const getLastPick = () => lastPick;

// M53：对比池抽签——一次性池覆盖，仅对本次 openGacha 到下次 openGacha 之间的 roll() 生效；
// 🎰 FAB 入口不传参，天然重置回全量筛选结果（不留任何跨会话残留状态）。
let cmpPoolOverride: Destination[] | null = null;
function currentPool(): Destination[] {
  return cmpPoolOverride ?? filtered(DATA, state, CUR_SEASON);
}

export function openGacha(cmpPool?: Destination[]) {
  cmpPoolOverride = cmpPool ?? null;
  const parts: string[] = [];
  if (state.region.size) parts.push([...state.region].join("/"));
  if (state.season.size) parts.push([...state.season].join("/") + "季");
  if (state.days.size) parts.push(DAY_BUCKETS.filter(b => state.days.has(b.key)).map(b => b.label).join("/"));
  if (state.crowd.size) parts.push([...state.crowd].join("/"));
  if (state.cost.size) parts.push([...state.cost].join("/"));
  if (state.difficulty.size) parts.push([...state.difficulty].join("/"));
  if (state.effort.size) parts.push([...state.effort].join("/"));
  if (state.companions.size) parts.push([...state.companions].join("/"));
  if (state.tags.size) parts.push([...state.tags].join("+"));
  if (state.noAlt) parts.push("避开高海拔");
  if (state.hideVisited) parts.push("隐藏去过");
  if (state.q) parts.push(`「${state.q}」`);
  const pool = currentPool();
  $("gachaScope").innerHTML = cmpPoolOverride
    ? `对比池 · 共 <b>${pool.length}</b> 颗`
    : (parts.length ? `扭蛋池：<b>${parts.join(" · ")}</b>` : "扭蛋池：全国不限") + `｜共 <b>${pool.length}</b> 颗蛋`;
  $("gCity").textContent = pool.length ? "？？？" : "空空如也";
  const relaxCands = pool.length || cmpPoolOverride ? [] : computeRelax(); // 对比池不是筛选结果，放宽建议无意义
  $("gSub").textContent = pool.length ? "转一下旋钮，命运发货"
    : (relaxCands.length ? `筛选太严了，${relaxCands[0].label}就有 ${relaxCands[0].n} 颗` : "筛选太严了，回去放宽一点");
  const gr = $("gRelaxBtn");
  gr.style.display = !pool.length && relaxCands.length ? "" : "none";
  if (relaxCands.length) gr.textContent = `${relaxCands[0].label}，再扭`;
  $("gKnob").style.display = pool.length ? "" : "none";
  $("gDetailBtn").style.display = "none";
  $("gTripBtn").style.display = "none";
  const t = $("gachaTicket"); t.className = ""; t.innerHTML = ""; t.style.removeProperty("--ticket-ambience");
  $("gachaOverlay").classList.add("show");
}

export function roll() {
  if (rolling) return;
  const pool = currentPool(); if (!pool.length) return;
  rolling = true;
  const cityEl = $("gCity");
  const subEl = $("gSub");
  const knob = $<HTMLButtonElement>("gKnob");
  const ticketEl = $("gachaTicket");
  ticketEl.className = ""; ticketEl.innerHTML = "";
  $("gDetailBtn").style.display = "none";
  $("gTripBtn").style.display = "none";
  knob.disabled = true; knob.classList.add("turn");
  cityEl.classList.add("spin");

  const pick = gachaPick(pool)!;
  lastPick = pick;
  let t = 0;
  const totalMs = 2300;
  const step = (delay: number) => {
    const r = gachaPick(pool)!;
    cityEl.textContent = r.emoji + " " + r.name;
    subEl.textContent = r.province + " · " + r.region;
    t += delay;
    if (t < totalMs) setTimeout(() => step(Math.min(delay * 1.2, 300)), delay);
    else {
      cityEl.classList.remove("spin");
      cityEl.textContent = pick.emoji + " " + pick.name;
      subEl.textContent = `${pick.province} · ${pick.region} · ${pick.crowd}`;
      // M46：票券氛围带——用该目的地所属大区的题头图垫底（design M46：「扭蛋票券氛围垫底」）；
      // background-image 天生「缺图不硬占」（加载失败不显示任何东西、不报错、不留占位），不需要
      // 额外的 onerror 处理。M60：题头图恒走共享层（regionHeaderSrc），奶油皮肤下这行现在也是
      // 一个真实存在的 URL（此前奶油无题头资产、这行必 404），不产生可见差异只是巧合改变了原因。
      ticketEl.style.setProperty("--ticket-ambience", `url(${regionHeaderSrc(pick.region)})`);
      ticketEl.innerHTML = cardHTML(pick, 0);
      ticketEl.querySelector<HTMLImageElement>(".illust")?.setAttribute("loading", "eager"); // [interrupt] 票券容器自 display:none 切入，lazy 的可视观察永不触发
      ticketEl.className = "show";
      $("gDetailBtn").style.display = "";
      $("gTripBtn").style.display = "";
      knob.disabled = false; knob.classList.remove("turn");
      rolling = false;
      confetti();
    }
  };
  step(60);
}
