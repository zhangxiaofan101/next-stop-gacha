// @vitest-environment happy-dom
// M79 路书路线图与环线最优提示：地图 SVG（序号点+连线+虚线收尾段）、总里程行恒显、
// 非最优时「一键按最优」出现且点击后行程序变为最优、只读分享路书不出该按钮、文本导出含总里程行。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { applyOptimalToRoadbook, currentRoadbookText, openRoadbook, openSharedRoadbook } from "../roadbook";

// 与 logic/__tests__/routeOptimal.test.ts 同一经典构型：给定顺序（成都→杭州→南京）总里程
// 明显差于精确解（成都居中、杭州/南京两端），省距 ~326km 远超 20km 阈值。
const CHENGDU = mkCity({ id: "chengdu", coords: [30.66, 104.06] });
const HANGZHOU = mkCity({ id: "hangzhou", coords: [30.25, 120.16] });
const NANJING = mkCity({ id: "nanjing", coords: [32.06, 118.8] });

function domSkeleton() {
  document.body.innerHTML = `
    <div class="grid" id="grid"></div>
    <div id="intentBox"></div>
    <div id="empty" style="display:none"><div id="relaxBox"></div></div>
    <div id="hitCount"></div>
    <div class="dock" id="dock">
      <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
      <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
    </div>
    <button id="footPill"></button>
    <div id="toast" style="display:none"><span id="toastMsg"></span></div>
    <div id="stopList"></div>
    <div id="tripStats"></div>
    <div id="tripSugg"></div>
    <div class="overlay" id="rbOverlay"><div class="paper" id="rbBody"></div></div>`;
}

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
    favs: [], cmp: [], trip: [], visited: [], tripStart: "",
  });
}

beforeEach(() => {
  domSkeleton();
  resetState();
  // openRoadbook 顺带触发后台天气拉取（fetchWeather，异步不 await）；stub 掉 fetch 避免测试
  // 结束时遗留真实网络请求（同 detail-banner-ratio.test.ts 既有做法）。
  vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in test")));
});

describe("路线图 SVG（地图头部块）", () => {
  it("画出出发地双圈 + n 个序号点 + 行程序连线 + 虚线收尾段", () => {
    setData([CHENGDU, HANGZHOU, NANJING]);
    state.trip = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];
    openRoadbook();
    const dots = document.querySelectorAll(".rb-map-dot");
    expect(dots).toHaveLength(3);
    expect([...dots].map(d => d.nextElementSibling!.textContent)).toEqual(["1", "2", "3"]); // 序号 1..n
    expect(document.querySelectorAll(".rb-map-origin")).toHaveLength(2); // 空心双圈
    const route = document.querySelector(".rb-map-route")!;
    expect(route.getAttribute("d")!.match(/L/g)).toHaveLength(3); // 出发地→3 站，3 段连线
    expect(route.hasAttribute("stroke-dasharray")).toBe(false); // 去程实线
    const back = document.querySelector(".rb-map-return")!;
    expect(back.hasAttribute("stroke-dasharray")).toBe(true); // 回程虚线，区别去回程
  });
});

describe("总里程与最优提示（地图下方一行）", () => {
  it("全程直线里程恒显，且当前非最优、省距≥20km 时给「一键按最优」", () => {
    setData([CHENGDU, HANGZHOU, NANJING]);
    state.trip = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];
    openRoadbook();
    const hint = document.querySelector(".rb-map-hint")!.textContent!;
    expect(hint).toContain("全程直线约");
    expect(hint).toContain("km");
    expect(hint).toContain("估算");
    expect(hint).toContain("比最优顺序多绕约");
    expect(document.getElementById("rbApplyOptimalBtn")).toBeTruthy();
  });

  it("点击「一键按最优」——行程序变为最优，重渲染后不再提示绕路", () => {
    setData([CHENGDU, HANGZHOU, NANJING]);
    state.trip = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];
    openRoadbook();
    applyOptimalToRoadbook();
    const ids = state.trip.map(t => t.id).join(",");
    expect(["hangzhou,chengdu,nanjing", "nanjing,chengdu,hangzhou"]).toContain(ids);
    const hint = document.querySelector(".rb-map-hint")!.textContent!;
    expect(hint).toContain("已是顺路顺序");
    expect(document.getElementById("rbApplyOptimalBtn")).toBeFalsy();
  });

  it("已顺路（省距<20km）：不出按钮，明示已是顺路顺序", () => {
    // P/Q/S 与 logic/__tests__/routeOptimal.test.ts 同一「小幅绕路」构型，省距约 9km<20km
    const P = mkCity({ id: "p", coords: [0, 10] });
    const Q = mkCity({ id: "q", coords: [0, 10.5] });
    const S = mkCity({ id: "s", coords: [0, 20] });
    setData([P, Q, S]);
    state.trip = [{ id: "q", days: 1 }, { id: "p", days: 1 }, { id: "s", days: 1 }];
    openRoadbook();
    const hint = document.querySelector(".rb-map-hint")!.textContent!;
    expect(hint).toContain("已是顺路顺序");
    expect(hint).not.toContain("多绕");
    expect(document.getElementById("rbApplyOptimalBtn")).toBeFalsy();
  });

  it("行程 <2 站没有绕路语义：只显总里程，地图仍照画", () => {
    setData([CHENGDU]);
    state.trip = [{ id: "chengdu", days: 3 }];
    openRoadbook();
    expect(document.querySelectorAll(".rb-map-dot")).toHaveLength(1);
    const hint = document.querySelector(".rb-map-hint")!.textContent!;
    expect(hint).toContain("全程直线约");
    expect(hint).not.toContain("已是顺路顺序");
    expect(hint).not.toContain("多绕");
  });

  it("只读分享路书（openSharedRoadbook）不出「一键按最优」，即便非最优", () => {
    setData([CHENGDU, HANGZHOU, NANJING]);
    const trip = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];
    openSharedRoadbook(trip, "");
    const hint = document.querySelector(".rb-map-hint")!.textContent!;
    expect(hint).toContain("比最优顺序多绕约");
    expect(document.getElementById("rbApplyOptimalBtn")).toBeFalsy();
  });
});

describe("文本导出里程口径", () => {
  it("currentRoadbookText 只有既有「总里程约」一行，不再另加直线口径（两行相近名字不同数字会看混）", () => {
    setData([CHENGDU, HANGZHOU, NANJING]);
    state.trip = [{ id: "chengdu", days: 3 }, { id: "hangzhou", days: 2 }, { id: "nanjing", days: 2 }];
    openRoadbook();
    const text = currentRoadbookText();
    expect(text).toContain("总里程约");
    expect(text).not.toContain("全程直线约");
  });
});
