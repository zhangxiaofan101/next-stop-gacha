/* 扭蛋主舞台（M63 重做：舞台—揭晓—蛋堆）。
   一套 DOM、双（多）皮肤 token 表达：机器 hero + 咔啦操作员气泡（舞台）→ 轻量开壳卡（揭晓，
   大票券退役）→ 半开蛋壳小卡攒成蛋堆（连扭备选）。spec 见 design M63。 */
import { CMP_MAX, DAY_BUCKETS } from "../logic/constants";
import { filtered } from "../logic/filter";
import { gachaPick } from "../logic/gacha";
import type { Destination } from "../logic/types";
import { cardPhotosEnabled, destPhotoSrc, regionHeaderSrc } from "../skins/illustrations";
import { CUR_SEASON, DATA, saveLS, state } from "../store";
import { openCompare } from "./compare";
import { $ } from "./dom";
import { confetti } from "./effects";
import { computeRelax, render } from "./render";
import { toast } from "./toast";

let rolling = false;

// 蛋堆＝页内会话态（design M63「存续」）：不进 localStorage，刷新即散；关弹层再开仍在＝模块级
// 变量天然满足；改筛选不清堆（蛋已出机）。揭晓卡＝蛋堆最新一颗的放大展示（同一颗，不另存「游离
// 蛋」状态，避免落堆前后两套真相），故 lastPick 就是堆尾。
let pile: Destination[] = [];
const pileIds = () => new Set(pile.map(d => d.id));
const currentPick = (): Destination | null => (pile.length ? pile[pile.length - 1] : null);
export const getLastPick = () => currentPick();

// 测试辅助：重置会话态（happy-dom 里模块状态跨用例存活，beforeEach 用；下划线前缀＝非生产入口）
export function _resetGachaSession() { pile = []; cmpPoolOverride = null; rolling = false; }

// M53：对比池抽签一次性覆盖——仅本次 openGacha 到下次 openGacha 之间生效；🎰 FAB 入口不传参＝
// 天然回落全量筛选结果，不留跨会话残留。
let cmpPoolOverride: Destination[] | null = null;

// 基础池（未扣蛋堆）：对比池覆盖优先，否则当前筛选结果
function basePool(): Destination[] {
  return cmpPoolOverride ?? filtered(DATA, state, CUR_SEASON);
}
// 可抽池：基础池扣掉已落堆的 id（design：已落地蛋按 id 排除、连扭不重复；排除叠加于一次性池覆盖之上）
function drawablePool(): Destination[] {
  const landed = pileIds();
  return basePool().filter(d => !landed.has(d.id));
}

// —— 蛋壳图形件：SVG + 皮肤 token 上色（皮肤无关形状、随肤取色，design M63）。质感不足再按成套清单立插画小批。
const bowlSVG = () =>
  `<svg class="ge-bowl" viewBox="0 0 78 60" aria-hidden="true">` +
  `<path d="M8 20 Q8 57 39 57 Q70 57 70 20" fill="var(--cap-bot)" stroke="var(--cap-line)" stroke-width="2" stroke-linejoin="round"/>` +
  `<path d="M8 20 Q39 29 70 20" fill="none" stroke="var(--cap-line)" stroke-width="1.6" opacity=".5"/></svg>`;
const shellBadgeSVG = () =>
  `<svg class="gr-badge" viewBox="0 0 40 40" aria-hidden="true">` +
  `<path d="M8 23 Q8 37 20 37 Q32 37 32 23 Z" fill="var(--cap-bot)" stroke="var(--cap-line)" stroke-width="2.6" stroke-linejoin="round"/>` +
  `<path d="M9 17 Q9 6 20 6 Q31 6 31 17 Z" fill="var(--cap-top)" stroke="var(--cap-line)" stroke-width="2.6" stroke-linejoin="round" transform="rotate(-13 20 12)"/>` +
  `<path d="M20 19 l1.3 2.9 2.9 1.3 -2.9 1.3 -1.3 2.9 -1.3 -2.9 -2.9 -1.3 2.9 -1.3 z" fill="var(--red)"/></svg>`;

// 小图消费＝卡位语义（cardPhotos 开关：开图皮肤主源个图、兜底大区题头；关图皮肤 emoji，不留空槽），
// 与「目的地图展示语义」同口径。动态注入进「刚由隐藏切入可见」的容器，故一律 eager（同票券 eager
// [interrupt]：lazy 的可视观察在 display 切换瞬间已错过）。
function photoHTML(d: Destination, cls: string): string {
  if (!cardPhotosEnabled()) return `<div class="${cls} ${cls}-emoji">${d.emoji}</div>`;
  const isRoute = !!d.stops;
  const src = isRoute ? regionHeaderSrc(d.region) : destPhotoSrc(d.id);
  const fb = isRoute ? "" : ` data-fallback-src="${regionHeaderSrc(d.region)}"`;
  return `<img class="${cls} illust" src="${src}"${fb} alt="" loading="eager" data-fallback="hide">`;
}

// —— 池说明条
function renderScope() {
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
  const n = drawablePool().length;
  $("gachaScope").innerHTML = cmpPoolOverride
    ? `对比池 · 共 <b>${n}</b> 颗`
    : (parts.length ? `扭蛋池：<b>${parts.join(" · ")}</b>` : "扭蛋池：全国不限") + `｜共 <b>${n}</b> 颗蛋`;
}

// —— 舞台态：气泡 / 结果窗 / 旋钮 / 放宽按钮 / 机器收窄，四态一处判定（满堆 > 筛选空池 > 池抽干 > 正常）
function renderStage() {
  const base = basePool();
  const drawable = drawablePool();
  const relax = $("gRelaxBtn");
  const knob = $<HTMLButtonElement>("gKnob");
  const cityWin = $("gCity");
  let bubble: string, winText = "？ ？ ？", knobOn = false, showRelax = false;

  if (pile.length >= CMP_MAX) {                              // 满堆
    bubble = "蛋堆满啦，扔几颗，或者拿去对比";
  } else if (!base.length) {                                 // 筛选空池 / 对比池空
    winText = "空空如也";
    if (cmpPoolOverride) {
      bubble = "对比池还空着，先去卡片上点几个「对比」";
    } else {
      const cands = computeRelax();                          // 诚实：筛太严才给定向放宽（沿用现有机制）
      showRelax = cands.length > 0;
      bubble = cands.length ? `筛得太狠了——${cands[0].label}就有 ${cands[0].n} 颗` : "筛得太狠了，回去放宽一点";
      relax.textContent = cands.length ? `${cands[0].label}，再扭` : "松一个条件，再扭";
    }
  } else if (!drawable.length) {                             // 池抽干（诚实空态，区别于筛选空池，不给放宽）
    winText = "都扭光啦";
    bubble = pile.length ? "这个池子扭光啦，都在下面这堆里咯" : "这个池子扭光啦";
  } else {                                                   // 正常可扭
    knobOn = true;
    bubble = pile.length ? `攒了 ${pile.length} 颗啦，够了就拿去对比` : "转一下旋钮，命运发货～";
  }

  $("gBubble").textContent = bubble;
  cityWin.textContent = winText;
  cityWin.classList.add("dim");
  knob.disabled = !knobOn;
  knob.classList.toggle("off", !knobOn);
  relax.style.display = showRelax ? "" : "none";
  $("gStage").classList.toggle("has-pile", pile.length > 0);
}

// —— 揭晓：轻量开壳卡（大票券退役，完整信息进详情）
function renderReveal() {
  const el = $("gReveal");
  const d = currentPick();
  if (!d) { el.className = "g-reveal"; el.innerHTML = ""; return; }
  const canRoll = pile.length < CMP_MAX && drawablePool().length > 0;
  const tripBtn = d.stops
    ? `<button class="btn" data-gact="trip">整条装入</button>`
    : `<button class="btn" data-gact="trip">＋加入行程</button>`;
  el.className = "g-reveal show";
  el.innerHTML =
    `<div class="gr-shell">${shellBadgeSVG()}${photoHTML(d, "gr-photo")}</div>` +
    `<div class="gr-body">` +
      `<div class="gr-name"><span class="gr-em">${d.emoji}</span>${d.name}</div>` +
      `<div class="gr-meta">${d.province} · ${d.region}</div>` +
      `<div class="gr-hook">${d.tagline}</div>` +
      `<div class="gr-actions">` +
        `<button class="btn pri" data-gact="roll"${canRoll ? "" : " disabled"}>继续扭</button>` +
        `<button class="btn" data-gact="detail">看看这里 →</button>` +
        tripBtn +
      `</div>` +
    `</div>`;
}

// —— 蛋堆条：半开蛋壳小卡，轻微倾角错落（0 颗不显——扭出第一颗才冒出来，design M63 拍板）
const TILTS = [-6, 5, -3, 6, -4, 4];
function renderPile() {
  const el = $("gPile");
  if (!pile.length) { el.style.display = "none"; $("gPileStrip").innerHTML = ""; return; }
  el.style.display = "";
  const cnt = $("gPileCount");
  cnt.textContent = `${pile.length} / ${CMP_MAX}`;
  cnt.classList.toggle("full", pile.length >= CMP_MAX);
  $("gPileStrip").innerHTML = pile.map((d, i) =>
    `<div class="ge" style="--rot:${TILTS[i % TILTS.length]}deg">` +
      `<div class="ge-shell" data-gegg="${d.id}" role="button" tabindex="0" title="${d.name}">` +
        `${bowlSVG()}${photoHTML(d, "ge-photo")}</div>` +
      `<button class="ge-x" data-gtoss="${d.id}" title="扔回池子" aria-label="扔掉${d.name}">✕</button>` +
      `<div class="ge-name">${d.name}</div>` +
    `</div>`).join("");
  $("gPileCmp").innerHTML = `<span class="deco-emoji">🆚 </span>拿去对比（${pile.length}）`;
}

function renderAll() { renderScope(); renderStage(); renderReveal(); renderPile(); }

export function openGacha(cmpPool?: Destination[]) {
  cmpPoolOverride = cmpPool ?? null;
  renderAll();                    // 蛋堆跨 open/close 存续；仅池覆盖随本次入口更新
  $("gachaOverlay").classList.add("show");
}

export function roll() {
  if (rolling) return;
  if (pile.length >= CMP_MAX) return;          // 满堆：停用
  const pool = drawablePool();
  if (!pool.length) return;                    // 空池/抽干：停用
  rolling = true;
  const knob = $<HTMLButtonElement>("gKnob");
  knob.disabled = true; knob.classList.add("turn");
  const revealEl = $("gReveal");
  revealEl.className = "g-reveal"; revealEl.innerHTML = ""; // 清上一张大卡（它已在蛋堆里以小图呈现）

  const pick = gachaPick(pool)!;
  const settle = () => {
    pile.push(pick);
    knob.classList.remove("turn");
    rolling = false;
    renderAll();
    // 还能继续扭时用揭晓庆祝语盖掉常规语；抽干/满堆则保留 renderStage 给的状态语
    if (pile.length < CMP_MAX && drawablePool().length) $("gBubble").textContent = "又抽到一个好地方！";
    confetti();
  };

  // prefers-reduced-motion：跳过老虎机滚动，直接揭晓（不塌）
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { settle(); return; }

  const cityEl = $("gCity");
  cityEl.classList.add("spin"); cityEl.classList.remove("dim");
  let t = 0;
  const totalMs = 2000;
  const step = (delay: number) => {
    const r = gachaPick(pool)!;
    cityEl.textContent = r.emoji + " " + r.name;
    t += delay;
    if (t < totalMs) setTimeout(() => step(Math.min(delay * 1.2, 300)), delay);
    else { cityEl.classList.remove("spin"); settle(); }
  };
  step(60);
}

// 蛋堆小卡 × ＝扔掉：该蛋回池可再抽（排除＝堆内 id，移除即自动回到可抽池）
export function tossEgg(id: string) {
  const i = pile.findIndex(d => d.id === id);
  if (i < 0) return;
  pile.splice(i, 1);
  renderAll();
}

export function clearPile() {
  if (!pile.length) return;
  pile = [];
  renderAll();
  toast("蛋堆已清空");
}

// 整堆写入对比池并开对比表（M69：直接覆盖旧池不弹确认——对比池可随手重建，confirm 打断心流不值）
export function pileToCompare() {
  if (!pile.length) return;
  state.cmp = pile.map(d => d.id).slice(0, CMP_MAX); // 蛋堆上限＝CMP_MAX，天然不溢出
  saveLS();
  $("gachaOverlay").classList.remove("show");
  if (state.cmp.length >= 2) openCompare();
  else { render(); toast("已放进对比篮，再攒一个就能比"); }
}
