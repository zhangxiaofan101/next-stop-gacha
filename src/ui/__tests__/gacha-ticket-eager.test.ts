// @vitest-environment happy-dom
// [interrupt]（2026-07-20 用户报「扭出来的图显示不全」）：票券卡图复用 cards.ts 的 <img loading="lazy">，
// 但票券容器从 display:none 切到可见（gachaTicket.className = "show"）时，浏览器懒加载的可视性观察
// 在切入瞬间已经错过——Chrome 生产实测该 img 恒 complete:false，同一 URL 在网格里秒载。修法：票券渲染
// 路径把图片强制 eager，只影响票券这条路径，不动 cards.ts 共享模板（网格 300+ 张卡仍要 lazy）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { roll } from "../gacha";

describe("扭蛋票券卡图 eager 加载（[interrupt]）", () => {
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
    setData([mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" })]);
    Object.assign(state, {
      region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
      cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
      tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
      favs: [], cmp: [], trip: [], visited: [],
    });
    // 减少动效路径干扰（跳过 canvas 彩带——happy-dom 无 2d context 实现，非本测试关心的行为）
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });

  it("roll() 结束后票券内 .illust 图片 loading=eager（不是共享模板默认的 lazy）", () => {
    vi.useFakeTimers();
    roll();
    vi.runAllTimers();
    vi.useRealTimers();
    const img = document.querySelector<HTMLImageElement>("#gachaTicket .illust");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("loading")).toBe("eager");
  });
});
