// @vitest-environment happy-dom
// F79 修复：M53 对比池定向抽（openGacha(cmpPool)）绕过 filter.ts matchOne 的本城卡对偶隐藏——
// state.cmp 持久化在 localStorage、跨出发地切换存活，把「上海视角选进对比池的北京卡」原样
// 传给 cmpPoolOverride，切到北京出发后仍能被抽中。修复在 gacha.ts basePool()（唯一咽喉，
// drawablePool()/renderScope 计数/renderStage 池说明/roll() 全部经它）补排除 d.id===getOrigin().cardId，
// 并补一个蛋堆（pile，跨 open/close 存续的会话态，独立于 basePool）清理函数 purgePileForOrigin()，
// 挂在 main.ts 的 wireOriginSwitch 回调里。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { BASE_ORIGIN, ORIGINS, setOrigin } from "../../logic/origin";
import { setData, state } from "../../store";
import { _drawablePool, _resetGachaSession, openGacha, purgePileForOrigin, roll } from "../gacha";

const BEIJING = ORIGINS.find(o => o.id === "beijing")!;

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

const eggIds = () => [...document.querySelectorAll<HTMLElement>("#gPileStrip [data-gegg]")].map(e => e.dataset.gegg!);

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
    favs: [], cmp: [], trip: [], visited: [],
  });
}

describe("F79 扭蛋对比池覆盖：本城卡对偶隐藏", () => {
  beforeEach(() => {
    document.body.innerHTML = GACHA_DOM;
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: true })); // reduced-motion：roll 同步揭晓
  });

  afterEach(() => {
    setOrigin(BASE_ORIGIN); // 出发地是跨文件存活的模块态，用完必须复位，避免污染其他测试文件
    vi.unstubAllGlobals();
  });

  it("a. 出发地=北京时，对比池覆盖（含北京卡）应被排除——candidates/蛋池不含北京卡", () => {
    setOrigin(BEIJING);
    const cmpPool = [mkCity({ id: "beijing" }), mkCity({ id: "shanghai" })];
    openGacha(cmpPool);
    const ids = _drawablePool().map(d => d.id);
    expect(ids).not.toContain("beijing");
    expect(ids).toContain("shanghai");
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("共 <b>1</b> 颗");
    roll();
    expect(document.getElementById("gReveal")!.textContent).toContain("shanghai");
    expect(document.getElementById("gReveal")!.textContent).not.toContain("beijing");
  });

  it("a2. 对比池覆盖排除后剩 0 张：走既有空池表现（对比池空气泡），不新造 UI", () => {
    setOrigin(BEIJING);
    openGacha([mkCity({ id: "beijing" })]); // 覆盖池只有本城卡，排除后为空
    expect(_drawablePool()).toHaveLength(0);
    expect(document.getElementById("gBubble")!.textContent).toContain("对比池还空着");
    expect((document.getElementById("gKnob") as HTMLButtonElement).disabled).toBe(true);
  });

  it("b. 切出发地后 pile 清理函数剔除本城卡、其余保留", () => {
    // 上海视角下把北京卡与其余城市逐个摇进蛋堆（每步只给单一候选，规避随机性）
    setData([mkCity({ id: "beijing" })]);
    openGacha();
    roll();
    setData([mkCity({ id: "hangzhou" })]);
    openGacha();
    roll();
    setData([mkCity({ id: "suzhou" })]);
    openGacha();
    roll();
    expect(eggIds().sort()).toEqual(["beijing", "hangzhou", "suzhou"]);

    setOrigin(BEIJING); // 切到北京出发：北京卡现在是本城卡
    purgePileForOrigin();

    expect(eggIds().sort()).toEqual(["hangzhou", "suzhou"]); // 北京卡被剔除，其余保留
    expect(document.getElementById("gPile")!.style.display).not.toBe("none");
  });

  it("b2. 切出发地但堆里没有本城卡：purgePileForOrigin 不误删、不触发多余渲染", () => {
    setData([mkCity({ id: "hangzhou" })]);
    openGacha();
    roll();
    setOrigin(BEIJING);
    purgePileForOrigin();
    expect(eggIds()).toEqual(["hangzhou"]);
  });

  it("c. 出发地=上海（对偶方向）时，同一 cmpPool 里的北京卡正常在池", () => {
    setOrigin(BASE_ORIGIN); // 上海视角
    const cmpPool = [mkCity({ id: "beijing" }), mkCity({ id: "hangzhou" })];
    openGacha(cmpPool);
    const ids = _drawablePool().map(d => d.id);
    expect(ids).toContain("beijing"); // 对偶方向：上海出发时北京卡不是本城卡，正常可抽
    expect(ids).toContain("hangzhou");
    expect(document.getElementById("gachaScope")!.innerHTML).toContain("共 <b>2</b> 颗");
  });
});
