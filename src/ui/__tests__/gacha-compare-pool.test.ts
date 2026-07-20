// @vitest-environment happy-dom
// M53：定向扭蛋——对比池抽签。openGacha(pool) 一次性覆盖扭蛋池（不影响 🎰 FAB 入口的全量池），
// roll() 只在覆盖池内抽；再次 openGacha()（不传参）应回落到全量筛选结果，不留残留状态。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CMP_MAX } from "../../logic/constants";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { toggleCmp } from "../actions";
import { openGacha, roll } from "../gacha";

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
    document.body.innerHTML = `
      <div class="overlay" id="gachaOverlay">
        <div class="g-scope" id="gachaScope"></div>
        <div class="g-city" id="gCity"></div>
        <div class="g-sub" id="gSub"></div>
        <button id="gKnob"></button>
        <button id="gRelaxBtn" style="display:none"></button>
        <button id="gDetailBtn" style="display:none"></button>
        <button id="gTripBtn" style="display:none"></button>
        <div id="gachaTicket"></div>
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
    setData([mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" }), mkCity({ id: "nanjing" })]);
    resetState();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  it("openGacha(pool) 覆盖池只含传入的目的地，roll() 只从覆盖池抽", () => {
    vi.useFakeTimers();
    openGacha([{ ...mkCity({ id: "hangzhou" }) }]);
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("对比池");
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("共 <b>1</b> 颗");
    roll();
    vi.runAllTimers();
    vi.useRealTimers();
    expect(document.getElementById("gCity")!.textContent).toContain("hangzhou");
  });

  it("openGacha() 不传参回落全量池，不残留上次的对比池覆盖", () => {
    vi.useFakeTimers();
    openGacha([mkCity({ id: "hangzhou" })]);
    roll();
    vi.runAllTimers();
    openGacha(); // 重新走 FAB 全量入口
    expect(document.getElementById("gachaScope")!.innerHTML).not.toContain("对比池");
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("共 <b>3</b> 颗蛋"); // 3 城全量，未被上次的 1 城覆盖池污染
    vi.useRealTimers();
  });

  it("toggleCmp 上限为 CMP_MAX（6），第 7 个被拒绝", () => {
    setData(Array.from({ length: 8 }, (_, i) => mkCity({ id: `c${i}` })));
    for (let i = 0; i < CMP_MAX; i++) toggleCmp(`c${i}`);
    expect(state.cmp).toHaveLength(CMP_MAX);
    toggleCmp(`c${CMP_MAX}`); // 第 7 个
    expect(state.cmp).toHaveLength(CMP_MAX); // 未被加入
  });
});
