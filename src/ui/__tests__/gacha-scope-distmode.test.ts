// @vitest-environment happy-dom
// F72：扭蛋池说明条（renderScope）此前不提 distMode——只开「短途」时仍显示「全国不限」，暗中限了
// 500km 却看不出来。对比池覆盖模式下 basePool 直接用覆盖池（不经 matchOne），distMode 天然不生效，
// 说明条也不该声称受限。
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

describe("F72 扭蛋池说明纳入 distMode", () => {
  beforeEach(() => {
    document.body.innerHTML = GACHA_DOM;
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  it("distMode=short 时扭蛋池说明含「短途」，不再显示「全国不限」", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" })]);
    resetState({ distMode: "short" });
    openGacha();
    const html = document.getElementById("gachaScope")!.innerHTML;
    expect(html).toContain("短途");
    expect(html).not.toContain("全国不限");
  });

  it("对比池覆盖模式下 distMode 不参与过滤（basePool 直用覆盖池），说明条不应声称受限", () => {
    setData([mkCity({ id: "a" }), mkCity({ id: "b" })]);
    resetState({ distMode: "short" });
    openGacha([mkCity({ id: "a" })]);
    const html = document.getElementById("gachaScope")!.innerHTML;
    expect(html).toContain("对比池");
    expect(html).not.toContain("短途");
  });
});
