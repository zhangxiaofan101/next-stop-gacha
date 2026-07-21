// @vitest-environment happy-dom
// M63 蛋堆（连扭备选）：已落地蛋按 id 排除（连扭不重复）、上限 CMP_MAX、满堆停用旋钮、× 扔回池、
// 整堆拿去对比、清空蛋堆，以及「筛选空池给放宽 vs 池抽干诚实空态不给放宽」的三态区分。
// matchMedia 恒 reduced-motion=true → roll() 同步揭晓，无需假时钟。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CMP_MAX } from "../../logic/constants";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { _resetGachaSession, clearPile, openGacha, pileToCompare, roll, tossEgg } from "../gacha";

const DOM = `
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
  <div class="overlay" id="cmpOverlay"><div class="cmp-scroll" id="cmpTableWrap"></div></div>
  <div class="grid" id="grid"></div>
  <div id="empty" style="display:none"><div id="relaxBox"></div></div>
  <div id="hitCount"></div>
  <div class="dock" id="dock">
    <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
    <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
  </div>
  <button id="footPill"></button>
  <div id="toast" style="display:none"><span id="toastMsg"></span></div>`;

const eggIds = () => [...document.querySelectorAll<HTMLElement>("#gPileStrip [data-gegg]")].map(e => e.dataset.gegg!);
const knob = () => document.querySelector<HTMLButtonElement>("#gKnob")!;

function resetState(over: Record<string, unknown> = {}) {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
    favs: [], cmp: [], trip: [], visited: [], ...over,
  });
}

describe("M63 蛋堆", () => {
  beforeEach(() => {
    document.body.innerHTML = DOM;
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  it("连扭落堆：计数递增、已落地 id 从可抽池排除（不重复），抽干后旋钮停用", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" }), mkCity({ id: "c" })]);
    openGacha();
    roll(); roll(); roll();
    const ids = eggIds();
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);                       // 连扭不重复
    expect(document.getElementById("gPileCount")!.textContent).toBe(`3 / ${CMP_MAX}`);
    expect(document.getElementById("gPile")!.style.display).not.toBe("none");
    expect(knob().disabled).toBe(true);                       // 池抽干
  });

  it("满堆（CMP_MAX）停用旋钮、计数标红；扔一颗即恢复", () => {
    setData(Array.from({ length: 8 }, (_, i) => mkCity({ id: `c${i}` })));
    openGacha();
    for (let i = 0; i < CMP_MAX; i++) roll();
    expect(eggIds()).toHaveLength(CMP_MAX);
    expect(knob().disabled).toBe(true);
    expect(document.getElementById("gPileCount")!.classList.contains("full")).toBe(true);
    tossEgg(eggIds()[0]);                                     // 扔回池
    expect(eggIds()).toHaveLength(CMP_MAX - 1);
    expect(knob().disabled).toBe(false);                     // 有空位又能扭
  });

  it("拿去对比：整堆写入 state.cmp、开对比表、关扭蛋弹层", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" }), mkCity({ id: "c" })]);
    openGacha();
    roll(); roll();
    const before = eggIds();
    pileToCompare();
    expect(state.cmp).toEqual(before);
    expect(document.getElementById("cmpOverlay")!.classList.contains("show")).toBe(true);
    expect(document.getElementById("gachaOverlay")!.classList.contains("show")).toBe(false);
  });

  it("M69：拿去对比直接覆盖非空旧池，不弹确认（confirm 不被调用）", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" }), mkCity({ id: "c" }), mkCity({ id: "d" })]);
    state.cmp = ["d"];                                        // 预置一个不同的旧池
    const spy = vi.fn(() => false);                           // 若仍有 confirm 残留，false 会挡住覆盖 → 下方断言连带失败
    (window as unknown as { confirm: () => boolean }).confirm = spy;
    openGacha();
    roll(); roll();
    pileToCompare();
    expect(spy).not.toHaveBeenCalled();
    expect(state.cmp).toEqual(eggIds());                      // 旧池被整堆直接替换
  });

  it("清空蛋堆：堆空、蛋堆隐藏、旋钮恢复", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" }), mkCity({ id: "c" })]);
    openGacha();
    roll(); roll();
    clearPile();
    expect(eggIds()).toHaveLength(0);
    expect(document.getElementById("gPile")!.style.display).toBe("none");
    expect(knob().disabled).toBe(false);
  });

  it("三态区分：筛选空池给放宽按钮；池抽干是诚实空态、不给放宽", () => {
    // 池抽干：1 城扭掉后 drawable=0，但基础池非空 → 不给放宽
    setData([mkCity({ id: "solo" })]);
    openGacha();
    roll();
    expect(knob().disabled).toBe(true);
    expect(document.getElementById("gRelaxBtn")!.style.display).toBe("none");
    expect(document.getElementById("gBubble")!.textContent).toContain("扭光");

    // 筛选空池：basePool 为空（region 过滤打空）→ 给放宽
    _resetGachaSession();
    setData([mkCity({ id: "solo", region: "华东" })]);
    resetState({ region: new Set(["西南"]) });
    openGacha();
    expect(knob().disabled).toBe(true);
    expect(document.getElementById("gRelaxBtn")!.style.display).not.toBe("none");
  });

  it("蛋堆跨 open/close 存续（关弹层再开仍在）", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" }), mkCity({ id: "c" })]);
    openGacha();
    roll();
    document.getElementById("gachaOverlay")!.classList.remove("show"); // 关弹层
    openGacha();                                                       // 再开
    expect(eggIds()).toHaveLength(1);
    expect(document.getElementById("gPile")!.style.display).not.toBe("none");
  });
});
