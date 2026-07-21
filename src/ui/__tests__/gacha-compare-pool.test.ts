// @vitest-environment happy-dom
// M53：定向扭蛋——对比池抽签。openGacha(pool) 一次性覆盖扭蛋池（不影响 🎰 FAB 入口的全量池），
// roll() 只在覆盖池内抽；再次 openGacha()（不传参）应回落到全量筛选结果，不留残留状态。
// M63 迁移：结果不再落在结果窗，改落轻量开壳卡 #gReveal（大票券退役），断言随之改看 #gReveal。
// matchMedia 恒 reduced-motion=true → roll() 跳过老虎机滚动、同步揭晓，无需假时钟。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CMP_MAX } from "../../logic/constants";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { toggleCmp } from "../actions";
import { _resetGachaSession, openGacha, roll } from "../gacha";

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
  <div id="empty" style="display:none"><div id="relaxBox"></div></div>
  <div id="hitCount"></div>
  <div class="dock" id="dock">
    <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
    <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
  </div>
  <button id="footPill"></button>
  <div id="toast" style="display:none"></div>`;

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
    favs: [], cmp: [], trip: [], visited: [],
  });
}

describe("M53 对比池抽签", () => {
  beforeEach(() => {
    document.body.innerHTML = GACHA_DOM;
    setData([mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" }), mkCity({ id: "nanjing" })]);
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: true })); // reduced-motion：roll 同步揭晓
  });

  it("openGacha(pool) 覆盖池只含传入的目的地，roll() 只从覆盖池抽（结果落开壳卡）", () => {
    openGacha([{ ...mkCity({ id: "hangzhou" }) }]);
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("对比池");
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("共 <b>1</b> 颗");
    roll();
    expect(document.getElementById("gReveal")!.textContent).toContain("hangzhou");
    expect(document.getElementById("gPileCount")!.textContent).toBe(`1 / ${CMP_MAX}`);
  });

  it("openGacha() 不传参回落全量池，不残留上次的对比池覆盖", () => {
    openGacha([mkCity({ id: "hangzhou" })]);
    openGacha(); // 重新走 FAB 全量入口（未 roll，蛋堆空，全量 3 城不被覆盖池污染）
    expect(document.getElementById("gachaScope")!.innerHTML).not.toContain("对比池");
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("共 <b>3</b> 颗蛋");
  });

  it("toggleCmp 上限为 CMP_MAX（6），第 7 个被拒绝", () => {
    setData(Array.from({ length: 8 }, (_, i) => mkCity({ id: `c${i}` })));
    for (let i = 0; i < CMP_MAX; i++) toggleCmp(`c${i}`);
    expect(state.cmp).toHaveLength(CMP_MAX);
    toggleCmp(`c${CMP_MAX}`); // 第 7 个
    expect(state.cmp).toHaveLength(CMP_MAX); // 未被加入
  });
});
