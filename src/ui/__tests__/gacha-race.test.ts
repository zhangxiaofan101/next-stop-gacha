// @vitest-environment happy-dom
// F70 回归：roll() 的老虎机动画（非 reduced-motion）跑完前，openGacha(newPool) 切换/覆盖池——
// 旧世代抽中的结果必须作废、不得落进切换后的新池（此前 generation token 缺失时会误落堆）。
// 用假时钟真实驱动 roll() 的 setTimeout 动画链（不能用 matchMedia reduced-motion，那条路径
// 同步结算、天然绕开这个竞态窗口）。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { _resetGachaSession, openGacha, roll } from "../gacha";

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

const eggIds = () => [...document.querySelectorAll<HTMLElement>("#gPileStrip [data-gegg]")].map(e => e.dataset.gegg!);

function resetState(over: Record<string, unknown> = {}) {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [], ...over,
  });
}

describe("F70 扭蛋动画飞行中切池的竞态", () => {
  beforeEach(() => {
    document.body.innerHTML = DOM;
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: false })); // 非 reduced-motion：走真动画路径
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // gachaPick 恒选池第 0 个，结果可预期
    // settle() 会触发彩带（非 reduced-motion 时不早退）；happy-dom 无 canvas 2d 上下文实现，
    // 测试只关心池切换语义，用最小 no-op 上下文垫上即可，不是在验证彩带本身
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: () => {}, save: () => {}, translate: () => {}, rotate: () => {}, fillRect: () => {}, restore: () => {},
    } as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("全量池动画未落堆时切到对比池覆盖：旧世代结果作废，不污染新池的蛋堆", () => {
    setData([mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" }), mkCity({ id: "nanjing" })]);
    openGacha(); // 全量池：hangzhou 排第 0，roll() 会抽中它
    roll();
    vi.advanceTimersByTime(500); // 动画进行中，未到 ~2000ms 结算
    openGacha([mkCity({ id: "suzhou" }), mkCity({ id: "nanjing" })]); // 立即改开对比池覆盖（仅苏州/南京）
    vi.advanceTimersByTime(3000); // 走满旧动画本该耗时——若未被真正取消，settle() 会在此触发
    expect(eggIds()).toHaveLength(0); // 旧世代 hangzhou 不落堆
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("对比池");
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("共 <b>2</b> 颗");
  });

  it("切池后旋钮/城市窗动画态被清理，可直接对新池发起新的一轮 roll", () => {
    setData([mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" }), mkCity({ id: "nanjing" })]);
    openGacha();
    roll();
    vi.advanceTimersByTime(500);
    openGacha([mkCity({ id: "suzhou" }), mkCity({ id: "nanjing" })]);
    expect(document.getElementById("gCity")!.classList.contains("spin")).toBe(false);
    expect(document.querySelector<HTMLButtonElement>("#gKnob")!.classList.contains("turn")).toBe(false);
    roll(); // 新池上应能正常发起新一轮（不被旧 rolling 标记卡住）
    vi.advanceTimersByTime(3000);
    expect(eggIds()).toEqual(["suzhou"]); // 新世代抽中新池第 0 个（suzhou），正常落堆
  });
});
