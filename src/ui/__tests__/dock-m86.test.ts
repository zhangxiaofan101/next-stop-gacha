// @vitest-environment happy-dom
// M86 dock 重构：标签带计数（脉冲仅在真正「变多」时触发一次，首帧不闪）、chip 拆两区（名字区
// 开详情/✕ 区单独移除）、aria-label、清空撤销。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { clearCmp, clearTrip } from "../actions";
import { _resetDockPulse, renderDock } from "../dock";

const DOM = `
  <div class="dock" id="dock">
    <div class="dock-box" id="cmpBox" style="display:none">
      <span class="dock-label">对比<b class="dock-count" id="cmpCount"></b></span>
      <div class="dock-items" id="cmpItems"></div>
    </div>
    <div class="dock-box" id="tripBox" style="display:none">
      <span class="dock-label">行程<b class="dock-count" id="tripCount"></b></span>
      <div class="dock-items" id="tripItems"></div>
    </div>
  </div>
  <div class="grid" id="grid"></div>
  <div id="intentBox"></div>
  <div id="empty" style="display:none"><div id="relaxBox"></div></div>
  <div id="hitCount"></div>
  <button id="footPill"></button>
  <div id="toast" style="display:none"><span id="toastMsg"></span><button id="toastAction" hidden></button></div>`;

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [],
  });
}

beforeEach(() => {
  document.body.innerHTML = DOM;
  setData([mkCity({ id: "a", name: "杭州" }), mkCity({ id: "b", name: "苏州" })]);
  resetState();
  _resetDockPulse(); // 脉冲基线是模块级变量，跨用例存活——每个用例前清零，避免上一条用例的渲染污染本条的「首帧」判定
});

describe("M86 dock 计数文案", () => {
  it("「对比 · N」「行程 · N 站」——数字随 state 实时反映", () => {
    state.cmp = ["a", "b"];
    state.trip = [{ id: "a", days: 2 }];
    renderDock();
    expect(document.getElementById("cmpCount")!.textContent).toBe("· 2");
    expect(document.getElementById("tripCount")!.textContent).toBe("· 1 站");
  });

  it("空篮子时计数归零文案", () => {
    renderDock();
    expect(document.getElementById("cmpCount")!.textContent).toBe("· 0");
    expect(document.getElementById("tripCount")!.textContent).toBe("· 0 站");
  });
});

describe("M86 dock 计数脉冲（增加时触发一次，首帧与不变/减少都不触发）", () => {
  it("开屏首帧即使已有内容（localStorage 恢复），也不脉冲——不是真正的「新增」", () => {
    state.trip = [{ id: "a", days: 2 }];
    renderDock();
    expect(document.getElementById("tripCount")!.classList.contains("pulse")).toBe(false);
  });

  it("站数变多（真正新增）→ 脉冲类出现", () => {
    renderDock(); // 建立基线（0 站）
    state.trip = [{ id: "a", days: 2 }];
    renderDock();
    expect(document.getElementById("tripCount")!.classList.contains("pulse")).toBe(true);
  });

  it("站数不变或变少 → 不脉冲", () => {
    state.trip = [{ id: "a", days: 2 }, { id: "b", days: 3 }];
    renderDock(); // 基线 2 站
    state.trip = [{ id: "a", days: 2 }];
    renderDock(); // 减到 1 站
    expect(document.getElementById("tripCount")!.classList.contains("pulse")).toBe(false);
  });
});

describe("M86 dock chip 拆两区结构 + aria-label", () => {
  it("每个 chip 拆成名字区（data-mapdot 开详情）与 ✕ 区（data-rmtrip 移除），中间无残留整名可点删语义", () => {
    state.trip = [{ id: "a", days: 2 }];
    renderDock();
    const chip = document.querySelector("#tripItems .dock-chip")!;
    const nameBtn = chip.querySelector<HTMLButtonElement>(".dock-chip-name")!;
    const xBtn = chip.querySelector<HTMLButtonElement>(".dock-chip-x")!;
    expect(nameBtn).not.toBeNull();
    expect(xBtn).not.toBeNull();
    expect(nameBtn.dataset.mapdot).toBe("a");
    expect(xBtn.dataset.rmtrip).toBe("a");
    expect(nameBtn.getAttribute("aria-label")).toBe("查看杭州详情");
    expect(xBtn.getAttribute("aria-label")).toBe("从行程中移除杭州");
    // 名字区不带任何「点即删」的委托属性
    expect(nameBtn.dataset.rmtrip).toBeUndefined();
  });

  it("对比 chip 同款结构，✕ 区走 data-rmcmp", () => {
    state.cmp = ["b"];
    renderDock();
    const chip = document.querySelector("#cmpItems .dock-chip")!;
    expect(chip.querySelector<HTMLButtonElement>(".dock-chip-name")!.dataset.mapdot).toBe("b");
    expect(chip.querySelector<HTMLButtonElement>(".dock-chip-x")!.dataset.rmcmp).toBe("b");
    expect(chip.querySelector(".dock-chip-x")!.getAttribute("aria-label")).toBe("从对比中移除苏州");
  });
});

describe("M86 dock 清空撤销（clearCmp/clearTrip，事后可撤销、无确认弹窗）", () => {
  it("clearTrip：清空即生效、toast 报站数、撤销恢复整份原样", () => {
    state.trip = [{ id: "a", days: 2 }, { id: "b", days: 3, r: "somewhere" }];
    clearTrip();
    expect(state.trip).toEqual([]);
    expect(document.getElementById("toastMsg")!.textContent).toBe("行程已清空（2 站）");
    expect(document.getElementById("toastAction")!.textContent).toBe("撤销");
    (document.getElementById("toastAction") as HTMLButtonElement).click();
    expect(state.trip).toEqual([{ id: "a", days: 2 }, { id: "b", days: 3, r: "somewhere" }]);
  });

  it("clearCmp：同款语义，撤销恢复原顺序", () => {
    state.cmp = ["b", "a"];
    clearCmp();
    expect(state.cmp).toEqual([]);
    expect(document.getElementById("toastMsg")!.textContent).toBe("对比已清空（2 个）");
    (document.getElementById("toastAction") as HTMLButtonElement).click();
    expect(state.cmp).toEqual(["b", "a"]);
  });

  it("F95 清空→撤销窗口内新加→撤销：合并恢复，不盖掉新选择（对比）", () => {
    state.cmp = ["a"];
    clearCmp();
    state.cmp.push("b"); // toggleCmp 加入不弹 toast，旧「撤销」仍可点——正是 F95 的复现窗口
    (document.getElementById("toastAction") as HTMLButtonElement).click();
    expect(state.cmp).toEqual(["a", "b"]); // 快照补回缺的在前，窗口内新加的原样保留在后
  });

  it("F95 行程清空撤销同款合并语义（按 id 查重，保留窗口内新加的站）", () => {
    state.trip = [{ id: "a", days: 2 }, { id: "b", days: 3, r: "somewhere" }];
    clearTrip();
    state.trip.push({ id: "a", days: 5 }); // 窗口内 a 被重新加入（天数不同）
    (document.getElementById("toastAction") as HTMLButtonElement).click();
    expect(state.trip).toEqual([{ id: "b", days: 3, r: "somewhere" }, { id: "a", days: 5 }]);
    // 查重方向同 toggleTrip 撤销守卫：已在的以当前为准（保留窗口内重加的 5 天），快照只补回缺的 b
  });

  it("空篮子点清空：静默无 toast（没什么可清的）", () => {
    clearTrip();
    expect(document.getElementById("toast")!.style.display).toBe("none");
  });
});
