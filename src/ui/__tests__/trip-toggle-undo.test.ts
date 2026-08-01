// @vitest-environment happy-dom
// M86：行程动作体系规整——诚实 toggle + 单级撤销的核心状态钉子。toggleTrip 的移除分支必须把
// 被删条目连同原下标一起记住，撤销要把它原样 splice 回同一位置（而不是随便 push 到末尾）；
// removeRouteFromTrip 只认 r 标记，用户另外单独加的同名城市站不能被这次「整条移除」连坐。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { addRouteToTrip, clearTrip, removeRouteFromTrip, toggleTrip } from "../actions";
import { renderTrip } from "../trip";

const DOM = `
  <div class="grid" id="grid"></div>
  <div id="intentBox"></div>
  <div id="empty" style="display:none"><div id="relaxBox"></div></div>
  <div id="hitCount"></div>
  <div class="dock" id="dock">
    <div class="dock-box" id="cmpBox"><div id="cmpItems"></div><b id="cmpCount"></b></div>
    <div class="dock-box" id="tripBox"><div id="tripItems"></div><b id="tripCount"></b></div>
  </div>
  <button id="footPill"></button>
  <div id="toast" style="display:none"><span id="toastMsg"></span><button id="toastAction" hidden></button></div>
  <div class="overlay" id="tripOverlay">
    <input type="date" id="tripStartInput">
    <div id="stopList"></div>
    <div id="tripStats"></div>
    <div id="tripSugg"></div>
  </div>`;

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [],
  });
}

const toastMsg = () => document.getElementById("toastMsg")!.textContent || "";
const toastActionLabel = () => document.getElementById("toastAction")!.textContent || "";
const clickToastAction = () => (document.getElementById("toastAction") as HTMLButtonElement).click();

describe("M86 toggleTrip 移除 + 撤销", () => {
  beforeEach(() => {
    document.body.innerHTML = DOM;
    setData([mkCity({ id: "a", name: "杭州" }), mkCity({ id: "b", name: "苏州" }), mkCity({ id: "c", name: "南京" })]);
    resetState();
    state.trip = [{ id: "a", days: 2 }, { id: "b", days: 3 }, { id: "c", days: 1 }];
  });

  it("移除中间一站：数组少一条，toast 报站名与剩余站数，带撤销 action", () => {
    toggleTrip("b");
    expect(state.trip.map(t => t.id)).toEqual(["a", "c"]);
    expect(toastMsg()).toBe("已移出行程：苏州（剩 2 站）");
    expect(toastActionLabel()).toBe("撤销");
  });

  it("撤销恢复原 index/days/r（原样插回同一位置，不是补在末尾）", () => {
    toggleTrip("b"); // 移除中间那站
    clickToastAction();
    expect(state.trip).toEqual([{ id: "a", days: 2 }, { id: "b", days: 3 }, { id: "c", days: 1 }]);
  });

  it("移除并撤销后再次移除同一站，新的移除仍是独立事件（不会被上一次撤销污染）", () => {
    toggleTrip("a");
    clickToastAction();
    toggleTrip("c");
    expect(state.trip.map(t => t.id)).toEqual(["a", "b"]);
    expect(toastMsg()).toBe("已移出行程：南京（剩 2 站）");
  });

  it("撤销窗口内该站已被别的路径加回：撤销查重跳过，不产生重复条目", () => {
    toggleTrip("b"); // 移除，撤销动作仍持有 {id:"b"}
    state.trip.push({ id: "b", days: 4 }); // 撤销窗口内被别的路径加回（模拟不弹 toast 的未来路径）
    clickToastAction();
    expect(state.trip.filter(t => t.id === "b")).toHaveLength(1); // 不重复
    expect(state.trip.find(t => t.id === "b")!.days).toBe(4); // 保留后加的那条，撤销视为无事可做
  });

  it("加入城市站：toast 报第几站，带「查看」action，点击后关掉当前弹层并打开行程单", () => {
    state.trip = [];
    document.getElementById("tripOverlay")!.classList.remove("show");
    document.body.insertAdjacentHTML("beforeend", `<div class="overlay show" id="fakeDetailOverlay"></div>`);
    toggleTrip("a");
    expect(toastMsg()).toBe("已加入行程（第 1 站）：杭州");
    expect(toastActionLabel()).toBe("查看");
    clickToastAction();
    expect(document.getElementById("fakeDetailOverlay")!.classList.contains("show")).toBe(false); // 别的弹层被关掉
    expect(document.getElementById("tripOverlay")!.classList.contains("show")).toBe(true); // 行程单被打开
  });
});

describe("M86 removeRouteFromTrip：只删 r 标记条目，撤销恢复整条", () => {
  beforeEach(() => {
    document.body.innerHTML = DOM;
    setData([
      mkCity({ id: "route1", name: "江南环线", stops: [{ id: "hz", days: 2 }, { id: "sz", days: 2 }, { id: "nj", days: 1 }] }),
      mkCity({ id: "hz", name: "杭州" }), mkCity({ id: "sz", name: "苏州" }), mkCity({ id: "nj", name: "南京" }),
      mkCity({ id: "extra", name: "无锡" }),
    ]);
    resetState();
  });

  it("整条装入后移除：只删 r===routeId 的条目，行程里其余无关站点不受牵连", () => {
    addRouteToTrip("route1"); // hz/sz/nj 三站均带 r=route1
    state.trip.push({ id: "extra", days: 2 }); // 用户另外单独加的一站，与本线路无关

    expect(state.trip).toHaveLength(4);

    removeRouteFromTrip("route1");
    expect(state.trip).toEqual([{ id: "extra", days: 2 }]);
    expect(toastMsg()).toBe("已整条移出：《江南环线》（3 站）");
    expect(toastActionLabel()).toBe("撤销");
  });

  it("用户单独加入的同名城市站（无 r）在整条移除时保留在原位", () => {
    state.trip = [{ id: "hz", days: 5 }]; // 用户先手动把杭州单独加进来，天数自定（无 r）
    addRouteToTrip("route1"); // 线路展开时 hz 已存在（同 id），会被跳过，不重复装入、也不会盖掉手动条目
    expect(state.trip).toEqual([
      { id: "hz", days: 5 },
      { id: "sz", days: 2, r: "route1" },
      { id: "nj", days: 1, r: "route1" },
    ]);
    removeRouteFromTrip("route1");
    // 手动加入的杭州（无 r）必须原样留着，只删掉 sz/nj 两条 r 标记条目
    expect(state.trip).toEqual([{ id: "hz", days: 5 }]);
  });

  it("撤销恢复全部被删条目及其原下标（含中间还有非 r 条目的乱序场景）", () => {
    state.trip = [
      { id: "hz", days: 2, r: "route1" },
      { id: "extra", days: 1 },
      { id: "sz", days: 2, r: "route1" },
      { id: "nj", days: 1, r: "route1" },
    ];
    removeRouteFromTrip("route1");
    expect(state.trip).toEqual([{ id: "extra", days: 1 }]);
    clickToastAction();
    expect(state.trip).toEqual([
      { id: "hz", days: 2, r: "route1" },
      { id: "extra", days: 1 },
      { id: "sz", days: 2, r: "route1" },
      { id: "nj", days: 1, r: "route1" },
    ]);
  });

  it("整条移除的撤销同样查重：已被加回的站跳过，其余照常恢复", () => {
    addRouteToTrip("route1"); // hz/sz/nj
    removeRouteFromTrip("route1");
    state.trip.push({ id: "sz", days: 6 }); // 撤销窗口内 sz 被单独加回
    clickToastAction();
    expect(state.trip.filter(t => t.id === "sz")).toHaveLength(1);
    expect(state.trip.find(t => t.id === "sz")!.days).toBe(6);
    expect(state.trip.map(t => t.id).sort()).toEqual(["hz", "nj", "sz"]); // hz/nj 照常恢复
  });

  it("addRouteToTrip 在已装入时是 toggle：再点即整条移除（走 removeRouteFromTrip 同一路径）", () => {
    addRouteToTrip("route1");
    expect(state.trip.every(t => t.r === "route1")).toBe(true);
    addRouteToTrip("route1"); // 第二次点击＝已装入判定为真，触发整条移除
    expect(state.trip).toHaveLength(0);
    expect(toastMsg()).toBe("已整条移出：《江南环线》（3 站）");
  });
});

describe("F94 行程单开着时：行程变更与撤销都同步刷新行程单列表", () => {
  beforeEach(() => {
    document.body.innerHTML = DOM;
    setData([mkCity({ id: "a", name: "杭州" }), mkCity({ id: "b", name: "苏州" }), mkCity({ id: "c", name: "南京" })]);
    resetState();
    state.trip = [{ id: "a", days: 2 }, { id: "b", days: 3 }, { id: "c", days: 1 }];
    document.getElementById("tripOverlay")!.classList.add("show");
    renderTrip();
  });

  it("移除一站：行程单列表即时少掉该站；点撤销：列表恢复", () => {
    expect(document.getElementById("stopList")!.textContent).toContain("苏州");
    toggleTrip("b");
    expect(document.getElementById("stopList")!.textContent).not.toContain("苏州");
    clickToastAction();
    expect(document.getElementById("stopList")!.textContent).toContain("苏州");
    expect(state.trip.map(t => t.id)).toEqual(["a", "b", "c"]);
  });

  it("清空：行程单转空态文案；点撤销：列表回来", () => {
    clearTrip();
    expect(document.getElementById("stopList")!.textContent).toContain("行程还是空的");
    clickToastAction();
    expect(document.getElementById("stopList")!.textContent).toContain("杭州");
    expect(state.trip).toHaveLength(3);
  });

  it("行程单没开（无 .show）：不渲染行程单，也不因缺行程单 DOM 报错", () => {
    document.getElementById("tripOverlay")!.classList.remove("show");
    const before = document.getElementById("stopList")!.innerHTML;
    toggleTrip("b");
    expect(document.getElementById("stopList")!.innerHTML).toBe(before); // 列表原样（未刷新）
    expect(state.trip.map(t => t.id)).toEqual(["a", "c"]); // 状态照常变
  });
});
