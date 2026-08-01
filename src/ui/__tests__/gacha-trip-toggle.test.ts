// @vitest-environment happy-dom
// M86：揭晓卡「加入行程」按钮升格为诚实 toggle——城市卡「＋加入行程」↔「已在行程 ✓」（点击=移除），
// 线路卡同详情/卡片面统一文案与 ghost 已装入态。gachaToggleTrip 承接退役的 events.ts gachaAddTrip
// （旧版遇到「已在行程」只会 toast 提示，不会真的移除）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { byId, setData, state } from "../../store";
import { _resetGachaSession, gachaToggleTrip, openGacha, roll } from "../gacha";

const GACHA_DOM = `
  <div class="overlay" id="gachaOverlay">
    <div class="gacha-box">
      <div class="g-scope" id="gachaScope"></div>
      <div class="machine" id="gStage">
        <div class="g-bubble" id="gBubble"></div>
        <div class="g-scene">
          <div class="g-illust" data-illust-frame><img class="illust g-machine" data-illust="gacha" data-fallback="🎰"></div>
          <span class="g-kara" data-illust-frame><img class="illust" data-illust="mascot" data-fallback="hide"></span>
        </div>
        <div class="g-window"><div class="g-city dim" id="gCity"></div></div>
        <button class="g-knob" id="gKnob"></button>
        <button class="btn" id="gRelaxBtn" style="display:none"></button>
        <div class="g-reveal" id="gReveal"></div>
      </div>
      <div class="g-pile" id="gPile" style="display:none">
        <div class="g-pile-head"><span class="g-pile-title"></span><span class="g-pile-count" id="gPileCount"></span></div>
        <div class="g-pile-strip" id="gPileStrip"></div>
        <div class="g-pile-actions"><button class="btn" id="gPileCmp"></button><button class="btn" id="gPileClear"></button></div>
      </div>
    </div>
    <canvas id="confettiCanvas"></canvas>
  </div>
  <div class="grid" id="grid"></div>
  <div id="intentBox"></div>
  <div id="empty" style="display:none"><div id="relaxBox"></div></div>
  <div id="hitCount"></div>
  <div class="dock" id="dock">
    <div class="dock-box" id="cmpBox"><div id="cmpItems"></div><b id="cmpCount"></b></div>
    <div class="dock-box" id="tripBox"><div id="tripItems"></div><b id="tripCount"></b></div>
  </div>
  <button id="footPill"></button>
  <div id="toast" style="display:none"><span id="toastMsg"></span><button id="toastAction" hidden></button></div>`;

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [],
  });
}

describe("M86 揭晓卡「加入行程」诚实 toggle", () => {
  beforeEach(() => {
    document.body.innerHTML = GACHA_DOM;
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: true })); // reduced-motion：roll 同步揭晓
  });

  it("城市卡：未在行程显示「＋加入行程」，点击后变「已在行程 ✓」且真的写进 state.trip", () => {
    setData([mkCity({ id: "hangzhou", name: "杭州" })]);
    roll();
    let btn = document.querySelector<HTMLButtonElement>('#gReveal [data-gact="trip"]')!;
    expect(btn.textContent).toBe("＋加入行程");
    expect(btn.classList.contains("ghost")).toBe(false);

    gachaToggleTrip();
    expect(state.trip.map(t => t.id)).toEqual(["hangzhou"]);
    btn = document.querySelector<HTMLButtonElement>('#gReveal [data-gact="trip"]')!;
    expect(btn.textContent).toBe("已在行程 ✓");
    expect(btn.classList.contains("ghost")).toBe(true);
  });

  it("城市卡：已在行程时再次触发＝移除（旧版这里只会 toast「已经在行程里啦」，不会真的移除）", () => {
    setData([mkCity({ id: "hangzhou", name: "杭州" })]);
    roll();
    gachaToggleTrip(); // 加入
    gachaToggleTrip(); // 再次＝移除
    expect(state.trip).toHaveLength(0);
    const btn = document.querySelector<HTMLButtonElement>('#gReveal [data-gact="trip"]')!;
    expect(btn.textContent).toBe("＋加入行程");
  });

  it("线路卡：未装入显示统一文案「🎫 整条装入行程（N 站）」，装入后变「已装入 ✓」ghost 态", () => {
    setData([
      mkCity({ id: "route1", name: "江南环线", stops: [{ id: "hz", days: 2 }, { id: "sz", days: 2 }] }),
      mkCity({ id: "hz" }), mkCity({ id: "sz" }),
    ]);
    openGacha([byId("route1")!]); // M53 对比池抽签同款覆盖机制：把可抽池锁定成只有这一张线路卡，避免随机抽到别的
    roll();
    let btn = document.querySelector<HTMLButtonElement>('#gReveal [data-gact="trip"]')!;
    expect(btn.textContent).toBe("🎫 整条装入行程（2 站）");

    gachaToggleTrip();
    expect(state.trip.every(t => t.r === "route1")).toBe(true);
    btn = document.querySelector<HTMLButtonElement>('#gReveal [data-gact="trip"]')!;
    expect(btn.textContent).toBe("已装入 ✓（点击整条移除）");
    expect(btn.classList.contains("ghost")).toBe(true);

    gachaToggleTrip(); // 再点＝整条移除
    expect(state.trip).toHaveLength(0);
  });
});
