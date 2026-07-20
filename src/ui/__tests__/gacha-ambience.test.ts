// @vitest-environment happy-dom
// M59 ⑪：票券氛围带重做为独立条带盒。此前整券背景 cover+center + ink 专属 90px 顶部 padding，
// 城市券（带卡顶个图）完全遮住氛围带、线路券勉强可见且位置不可控。现为 roll() 生成的一个独立
// `.ticket-ambience` 元素，随 ⑨ 的 cardPhotosEnabled() 开关生成与否。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { roll } from "../gacha";

describe("票券氛围带（M59 ⑪）", () => {
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
      </div>`;
    setData([mkCity({ id: "hangzhou", region: "江浙沪" })]);
    Object.assign(state, {
      region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
      cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
      tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
      favs: [], cmp: [], trip: [], visited: [],
    });
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("山水（cardPhotos:true）：roll() 后票券里生成 .ticket-ambience，背景图=所属大区题头（共享层，M60 helper）", () => {
    document.documentElement.dataset.theme = "ink";
    vi.useFakeTimers();
    roll();
    vi.runAllTimers();
    vi.useRealTimers();
    const band = document.querySelector<HTMLElement>("#gachaTicket .ticket-ambience");
    expect(band).not.toBeNull();
    expect(band!.style.backgroundImage).toContain("illustrations/dest/region-jzh.webp");
    // 氛围带在卡片之前——是独立条带盒垫在上方，不是靠 padding 从卡片背后露出一角
    expect(document.querySelector("#gachaTicket")!.firstElementChild).toBe(band);
  });

  it("奶油（默认，cardPhotos:false）：roll() 后票券里不生成 .ticket-ambience（不留一个只会 404 的空盒）", () => {
    delete document.documentElement.dataset.theme;
    vi.useFakeTimers();
    roll();
    vi.runAllTimers();
    vi.useRealTimers();
    expect(document.querySelector("#gachaTicket .ticket-ambience")).toBeNull();
  });
});
