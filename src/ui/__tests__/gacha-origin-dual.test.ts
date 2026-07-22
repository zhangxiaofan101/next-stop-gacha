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
import { _drawablePool, _resetGachaSession, getLastPick, openGacha, purgePileForOrigin, roll } from "../gacha";

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

// F79 复核（codex）：只滤 pile 不够——非 reduced-motion 的 ~2s 老虎机动画结算前，pile 还没拿到
// 这次的结果，purgePileForOrigin 若不顺带作废在途 roll（gachaGen++ + clearTimeout(rollTimer)），
// settle() 的 myGen !== gachaGen 早退形同虚设，动画走完后旧本城卡照样落堆。用假时钟真实驱动
// setTimeout 动画链复现这个窗口（reduced-motion 同步结算天然绕开它，同 gacha-race.test.ts 的
// F70 回归惯例）。matchMedia stub 与 Math.random mock 均沿用该文件已验证过的做法。
describe("F79 复核：非 reduced-motion 飞行中的 roll 撞上出发地切换", () => {
  beforeEach(() => {
    document.body.innerHTML = GACHA_DOM;
    resetState();
    _resetGachaSession();
    vi.stubGlobal("matchMedia", () => ({ matches: false })); // 非 reduced-motion：走真动画路径
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // gachaPick 恒选池第 0 个，结果可预期
    // settle() 会触发彩带（非 reduced-motion 时不早退）；happy-dom 无 canvas 2d 上下文实现，
    // 垫一个 no-op 上下文（同 gacha-race.test.ts），测试只关心作废语义，不是在验证彩带本身
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: () => {}, save: () => {}, translate: () => {}, rotate: () => {}, fillRect: () => {}, restore: () => {},
    } as unknown as CanvasRenderingContext2D);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setOrigin(BASE_ORIGIN);
    vi.unstubAllGlobals();
  });

  it("上海→北京：settle 前切到北京并 purge，旧本城卡（北京）不落堆，rolling 正常复位", () => {
    setOrigin(BASE_ORIGIN); // 上海出发起手：北京只是普通城市
    setData([mkCity({ id: "beijing" }), mkCity({ id: "hangzhou" })]); // random 恒 0 → 池第 0 个 beijing 被抽中
    openGacha();
    roll();
    vi.advanceTimersByTime(500); // 动画进行中（totalMs=2000），远未到结算
    setOrigin(ORIGINS.find(o => o.id === "beijing")!); // 切到北京：北京卡此刻变成本城卡
    purgePileForOrigin();                              // F79 修复点：须作废这次飞行中的 roll，不只是滤 pile
    vi.advanceTimersByTime(3000); // 走满旧动画本该耗时——若未被真正取消，settle() 会在此把北京卡判定为同世代落堆
    expect(getLastPick()).toBeNull();  // 旧结果没有落地
    expect(eggIds()).toHaveLength(0);  // pile 不含本城卡
    // rolling 已正确复位：紧接着的新一轮 roll() 不会被残留的 rolling=true 拦住，能对新池正常抽取
    roll();
    vi.advanceTimersByTime(3000);
    expect(eggIds()).toEqual(["hangzhou"]); // 北京已被 basePool 排除，新抽中的是池里唯一剩下的候选
  });

  it("北京→上海（对偶方向）：settle 前切到上海并 purge，旧本城卡（上海）不落堆，rolling 正常复位", () => {
    setOrigin(ORIGINS.find(o => o.id === "beijing")!); // 北京出发起手：上海只是普通城市
    setData([mkCity({ id: "shanghai" }), mkCity({ id: "hangzhou" })]); // random 恒 0 → 池第 0 个 shanghai 被抽中
    openGacha();
    roll();
    vi.advanceTimersByTime(500);
    setOrigin(BASE_ORIGIN); // 切回上海：上海卡此刻变成本城卡
    purgePileForOrigin();
    vi.advanceTimersByTime(3000);
    expect(getLastPick()).toBeNull();
    expect(eggIds()).toHaveLength(0);
    roll();
    vi.advanceTimersByTime(3000);
    expect(eggIds()).toEqual(["hangzhou"]);
  });
});
