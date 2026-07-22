/* 扭蛋主舞台（M63 重做：舞台—揭晓—蛋堆）。
   一套 DOM、双（多）皮肤 token 表达：机器 hero + 咔啦操作员气泡（舞台）→ 轻量开壳卡（揭晓，
   大票券退役）→ 半开蛋壳小卡攒成蛋堆（连扭备选）。spec 见 design M63。 */
import { CMP_MAX, DAY_BUCKETS } from "../logic/constants";
import { filtered } from "../logic/filter";
import { gachaPick } from "../logic/gacha";
import { getOrigin } from "../logic/origin";
import type { Destination } from "../logic/types";
import { cardPhotosEnabled, destPhotoSrc, regionHeaderSrc } from "../skins/illustrations";
import { CUR_SEASON, DATA, saveLS, state } from "../store";
import { openCompare } from "./compare";
import { $ } from "./dom";
import { confetti } from "./effects";
import { computeRelax, render } from "./render";
import { toast } from "./toast";

let rolling = false;
// F70 修复：roll() 揭晓在 ~2s 动画后才落堆，这段时间内 openGacha(newPool) 可切换/覆盖池——
// 世代计数器 + 定时器句柄双保险：openGacha 时作废旧世代并砍掉飞行中的动画，settle 前再核对
// 世代，防止旧池抽中的结果落进切换后的新池（尤其对比池覆盖场景）。
let gachaGen = 0;
let rollTimer: ReturnType<typeof setTimeout> | null = null;

// F70 openGacha 的「作废在途 roll」三连抽成公共 helper：任何「这次操作后，旧结果不该再落地」的
// 入口都得走它——世代号 + 定时器句柄必须一起清，只清动画态（rolling/DOM class）而不碰世代号，
// settle() 的 myGen !== gachaGen 早退就形同虚设。F79 复核（codex）踩中的正是这个坑：
// purgePileForOrigin 一开始只滤了已落袋的 pile，没做这三步——上海视角对着「仅含北京卡」的池
// 起手一次非 reduced-motion 抽取（2s 老虎机动画），动画结算前切到北京并触发 purge，
// pile 当时还是空的（没东西可滤），旧世代号原封不动，~2s 后 settle() 照常把北京卡判定为
// "同世代"结果落堆——本城卡对偶隐藏被绕过。返回值＝是否真的腰斩了一个飞行中的 roll，
// 供调用方决定要不要为此多触发一次 renderAll（世代号本身每次调用都递增，无条件，递增本身
// 无副作用，只有和某次 roll() 捕获的 myGen 比较时才有意义）。
function invalidateInFlightRoll(): boolean {
  gachaGen++;                                  // 作废任何飞行中的旧世代 roll（无条件，纯计数器自增无害）
  if (rollTimer !== null) { clearTimeout(rollTimer); rollTimer = null; }
  if (!rolling) return false;                  // 没有在飞行中的动画，下面的 DOM 清理不必做
  rolling = false;                              // 旧 roll 被腰斩：清掉它留下的动画态，交由调用方按需 renderAll 重算
  $("gCity").classList.remove("spin");
  $<HTMLButtonElement>("gKnob").classList.remove("turn");
  return true;
}

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
// F79：本城卡对偶隐藏三处一体（filter.ts matchOne / itinerary.ts onwaySuggestions / 这里）的
// 第三处——filtered() 分支早已在 matchOne 里排除过当前出发地的本城卡，但 cmpPoolOverride
// （M53 对比池定向抽）整池来自 state.cmp，而 state.cmp 持久化在 localStorage、跨出发地切换存活，
// 完全绕开 matchOne：不补排除的话「上海视角把北京卡加入对比 → 切到北京出发 → 从对比池抽」能把
// 北京卡重新抽回蛋池。选在 basePool() 而不是 events.ts 传参前（不改调用方）：这里是 gacha 模块内
// 所有读池路径的唯一咽喉——drawablePool()/renderScope 计数/renderStage 池说明/roll() 全部经它，
// 改一处即可全链路一致；filtered() 分支再滤一次是幂等空操作，无需按 override 与否分叉判断。
function basePool(): Destination[] {
  const pool = cmpPoolOverride ?? filtered(DATA, state, CUR_SEASON);
  return pool.filter(d => d.id !== getOrigin().cardId);
}
// 可抽池：基础池扣掉已落堆的 id（design：已落地蛋按 id 排除、连扭不重复；排除叠加于一次性池覆盖之上）
function drawablePool(): Destination[] {
  const landed = pileIds();
  return basePool().filter(d => !landed.has(d.id));
}

// 测试辅助：暴露当前可抽池（F79 断言本城卡对偶排除时用，避免「多摇几次没摇到」这种概率性断言；
// 下划线前缀＝非生产入口，同 _resetGachaSession 惯例）
export function _drawablePool(): Destination[] { return drawablePool(); }

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
  if (state.distMode) parts.push(state.distMode === "short" ? "短途" : "长途"); // F72：池说明补上 distMode，否则暗中限距离却显「全国不限」
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
  invalidateInFlightRoll();       // 旧 roll 被腰斩：动画态已在 helper 里清掉，交由下面 renderAll 按新池重算
  cmpPoolOverride = cmpPool ?? null;
  renderAll();                    // 蛋堆跨 open/close 存续；仅池覆盖随本次入口更新（无条件渲染，与腰斩与否无关）
  $("gachaOverlay").classList.add("show");
}

export function roll() {
  if (rolling) return;
  if (pile.length >= CMP_MAX) return;          // 满堆：停用
  const pool = drawablePool();
  if (!pool.length) return;                    // 空池/抽干：停用
  rolling = true;
  const myGen = gachaGen;
  const knob = $<HTMLButtonElement>("gKnob");
  knob.disabled = true; knob.classList.add("turn");
  const revealEl = $("gReveal");
  revealEl.className = "g-reveal"; revealEl.innerHTML = ""; // 清上一张大卡（它已在蛋堆里以小图呈现）

  const pick = gachaPick(pool)!;
  const settle = () => {
    rollTimer = null;
    if (myGen !== gachaGen) { rolling = false; return; } // 池已在飞行中被切换/重开，旧结果作废、不落堆
    pile.push(pick);
    knob.classList.remove("turn");
    rolling = false;
    renderAll();
    // 还能继续扭时用揭晓庆祝语盖掉常规语；抽干/满堆则保留 renderStage 给的状态语
    if (pile.length < CMP_MAX && drawablePool().length) $("gBubble").textContent = "又抽到一个好地方！";
    confetti();
  };

  // prefers-reduced-motion：跳过老虎机滚动，直接揭晓（不塌）——同步执行，openGacha 不可能插入其间
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { settle(); return; }

  const cityEl = $("gCity");
  cityEl.classList.add("spin"); cityEl.classList.remove("dim");
  let t = 0;
  const totalMs = 2000;
  const step = (delay: number) => {
    const r = gachaPick(pool)!;
    cityEl.textContent = r.emoji + " " + r.name;
    t += delay;
    if (t < totalMs) rollTimer = setTimeout(() => step(Math.min(delay * 1.2, 300)), delay);
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

// F79：本城卡对偶隐藏的第三处收尾——蛋堆（pile）是不经 basePool()/matchOne 的独立会话态，
// 切出发地前用旧出发地视角抽到的蛋，可能恰好等于切换后的新本城卡（例如上海视角抽到北京卡
// 落堆，再切到北京出发）。basePool() 的排除只挡「以后再抽」，堆里已落地的旧蛋得单独清一次。
// 调用方：main.ts wireOriginSwitch 回调，每次出发地切换都跑。
//
// F79 复核（codex）补丁：先 invalidateInFlightRoll() 再滤 pile——只滤 pile 不够，飞行中的 roll
// （非 reduced-motion，~2s 老虎机动画尚未 settle）此刻还没把结果推进 pile，滤了个寂寞；旧世代号
// 原封不动，动画走完后 settle() 的 myGen !== gachaGen 早退失效，把即将成为本城卡的旧结果照常
// 落堆。两处扫尾（腰斩飞行中的 roll / 滤掉已落堆的本城卡）合起来才是完整的第三处收尾，
// renderAll 也相应改成「腰斩了 roll 或 pile 真的变了」才触发，避免每次切出发地都白渲染一次。
export function purgePileForOrigin() {
  const cancelled = invalidateInFlightRoll();
  const before = pile.length;
  pile = pile.filter(d => d.id !== getOrigin().cardId);
  if (cancelled || pile.length !== before) renderAll();
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
