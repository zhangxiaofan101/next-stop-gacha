// @vitest-environment happy-dom
// M54：行程站数上限 6→10（TRIP_MAX 单点常量 + 三处「行程已满」toast 文案）。三条装入路径
// （toggleTrip/addRouteToTrip/insertOnWay）各自维护自己的 cap 检查，文案曾各自硬编码「6 站」——
// 回归钉住新上限与文案联动，防止未来再改 TRIP_MAX 时又漏改某一处文案。
import { beforeEach, describe, expect, it } from "vitest";
import { TRIP_MAX } from "../../logic/constants";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { addRouteToTrip, toggleTrip } from "../actions";
import { insertOnWay } from "../trip";

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
    favs: [], cmp: [], trip: [], visited: [],
  });
}

describe("M54 行程站数上限 TRIP_MAX", () => {
  beforeEach(() => {
    expect(TRIP_MAX).toBe(10); // 锁住本模块的目标值，防止常量被误改回 6 或改成别的数
    document.body.innerHTML = `
      <div class="grid" id="grid"></div>
      <div id="empty" style="display:none"><div id="relaxBox"></div></div>
      <div id="hitCount"></div>
      <div class="dock" id="dock">
        <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
        <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
      </div>
      <button id="footPill"></button>
      <div id="toast" style="display:none"></div>
      <div id="stopList"></div>
      <div id="tripStats"></div>
      <div id="tripSugg"></div>`;
    setData(Array.from({ length: 15 }, (_, i) => mkCity({ id: `c${i}` })));
    resetState();
  });

  it("toggleTrip 装到 TRIP_MAX 后，第 11 次被拒绝且 toast 文案含新上限", () => {
    for (let i = 0; i < TRIP_MAX; i++) toggleTrip(`c${i}`);
    expect(state.trip).toHaveLength(TRIP_MAX);
    toggleTrip(`c${TRIP_MAX}`);
    expect(state.trip).toHaveLength(TRIP_MAX); // 未被加入
    expect(document.getElementById("toast")!.textContent).toBe(`一次行程最多 ${TRIP_MAX} 站，贪多嚼不烂～`);
    expect(document.getElementById("toast")!.textContent).not.toContain("6 站");
  });

  it("addRouteToTrip 装满 TRIP_MAX 后停止，toast 文案含新上限", () => {
    for (let i = 0; i < TRIP_MAX - 1; i++) toggleTrip(`c${i}`); // 先装 9 站，剩 1 个空位
    setData([
      ...Array.from({ length: 15 }, (_, i) => mkCity({ id: `c${i}` })),
      mkCity({ id: "route1", stops: [{ id: "r1", days: 2 }, { id: "r2", days: 2 }, { id: "r3", days: 2 }], name: "route1" }),
      mkCity({ id: "r1" }), mkCity({ id: "r2" }), mkCity({ id: "r3" }),
    ]);
    addRouteToTrip("route1"); // 3 站线路，只剩 1 个空位——装 1 站后触发 skippedFull
    expect(state.trip).toHaveLength(TRIP_MAX);
    expect(document.getElementById("toast")!.textContent).toBe(`行程已满 ${TRIP_MAX} 站，只装入了前 1 站`);
    expect(document.getElementById("toast")!.textContent).not.toContain("6 站");
  });

  it("insertOnWay 行程已满 TRIP_MAX 时直接拒绝（早退在 cap 检查，不进入顺路计算），toast 文案含新上限", () => {
    for (let i = 0; i < TRIP_MAX; i++) toggleTrip(`c${i}`);
    expect(state.trip).toHaveLength(TRIP_MAX);
    insertOnWay(`c${TRIP_MAX}`); // 第 11 个候选，行程已满
    expect(state.trip).toHaveLength(TRIP_MAX); // 未被插入
    expect(document.getElementById("toast")!.textContent).toBe(`一次行程最多 ${TRIP_MAX} 站，贪多嚼不烂～`);
  });
});
