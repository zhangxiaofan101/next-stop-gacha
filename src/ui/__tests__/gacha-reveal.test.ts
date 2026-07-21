// @vitest-environment happy-dom
// M63 揭晓＝轻量开壳卡（大票券退役）：roll() 结束把结果渲染进 #gReveal（紧凑：小图+emoji+名+省·大区
// +一句钩子），不再是整张卡片票券。保留 [interrupt] eager 断言——揭晓卡小图注入进「由隐藏切入可见」的
// 容器，lazy 的可视观察在切入瞬间已错过，故强制 loading=eager（同旧票券 eager 修法，随新结构迁移）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { _resetGachaSession, roll } from "../gacha";

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
  </div>`;

describe("M63 揭晓开壳卡", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "ink"; // ink cardPhotos:true，小图真的渲染出来才有 .illust 可断言
    document.body.innerHTML = GACHA_DOM;
    setData([mkCity({ id: "hangzhou", tagline: "上有天堂下有苏杭", province: "浙江", region: "华东" })]);
    Object.assign(state, {
      region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
      cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
      tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
      favs: [], cmp: [], trip: [], visited: [],
    });
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: true })); // reduced-motion：roll 同步揭晓
  });

  afterEach(() => { delete document.documentElement.dataset.theme; });

  it("roll() 把紧凑信息渲染进开壳卡（名/省·大区/钩子），并显态 .show", () => {
    roll();
    const rv = document.getElementById("gReveal")!;
    expect(rv.classList.contains("show")).toBe(true);
    expect(rv.textContent).toContain("hangzhou");
    expect(rv.textContent).toContain("浙江");
    expect(rv.textContent).toContain("华东");
    expect(rv.textContent).toContain("上有天堂下有苏杭");
    // 继续扭/看看这里/加入行程 三动作在卡内
    expect(rv.querySelector('[data-gact="roll"]')).not.toBeNull();
    expect(rv.querySelector('[data-gact="detail"]')).not.toBeNull();
    expect(rv.querySelector('[data-gact="trip"]')).not.toBeNull();
  });

  it("开壳卡小图 loading=eager（不是共享模板默认的 lazy）", () => {
    roll();
    const img = document.querySelector<HTMLImageElement>("#gReveal .illust");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("loading")).toBe("eager");
  });

  it("大票券已退役：不再产出 #gachaTicket 结构", () => {
    roll();
    expect(document.getElementById("gachaTicket")).toBeNull();
    expect(document.querySelector(".ticket-ambience")).toBeNull();
  });
});
