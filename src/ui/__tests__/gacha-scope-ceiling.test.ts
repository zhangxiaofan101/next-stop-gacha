// @vitest-environment happy-dom
// M78：天花板组（花费/抵达/天数）的填充链会同时选中天花板以下所有档，池说明条若逐项 join
// 会打出「最多2天/最多3天/最多5天」式冗长串——只报天花板那一档，文案读作「以内」。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { _resetGachaSession, openGacha } from "../gacha";

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
    <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
    <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
  </div>
  <button id="footPill"></button>
  <div id="toast" style="display:none"><span id="toastMsg"></span></div>`;

function resetState(over: Record<string, unknown> = {}) {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [], ...over,
  });
}

describe("M78 池说明条只报天花板档", () => {
  beforeEach(() => {
    document.body.innerHTML = GACHA_DOM;
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  it("天数填充链 {2,3,5} 只显示「最多5天」", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" })]);
    resetState({ days: new Set(["2", "3", "5"]) });
    openGacha();
    const html = document.getElementById("gachaScope")!.innerHTML;
    expect(html).toContain("最多5天");
    expect(html).not.toContain("最多2天");
    expect(html).not.toContain("最多3天");
  });

  it("花费填充链 {¥,¥¥} 显示「¥¥以内」；抵达填充链显示「一次中转内」", () => {
    setData([mkCity({ id: "a" })]);
    resetState({ cost: new Set(["¥", "¥¥"]), difficulty: new Set(["直达", "一次中转"]) });
    openGacha();
    const html = document.getElementById("gachaScope")!.innerHTML;
    expect(html).toContain("¥¥以内");
    expect(html).not.toContain("¥/¥¥");
    expect(html).toContain("一次中转内");
    expect(html).not.toContain("直达/");
  });

  it("抵达只选「直达」时显示「直达」，不加「内」", () => {
    setData([mkCity({ id: "a" })]);
    resetState({ difficulty: new Set(["直达"]) });
    openGacha();
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("直达");
    expect(document.getElementById("gachaScope")!.innerHTML).not.toContain("直达内");
  });
});
