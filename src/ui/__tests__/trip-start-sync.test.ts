// @vitest-environment happy-dom
// F93：搬家链接 `#m=` 整份认领后，出发日期必须 state / localStorage / 日期输入框三者一致。
// 早前 boot() 在 checkMigrateHash() **之前**把 state.tripStart 写进输入框，认领换掉状态后没人
// 再同步这个独立表单控件——日期实际已迁入，界面却显示迁移前的值，下一次改日期还会把已迁的
// 值无声覆盖。修法是把「状态→表单」收进 renderTrip()（行程单唯一入口），本套钉住落地效果。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { encodeMigration, MIGRATE_HASH_PREFIX } from "../../logic/migrate";
import type { PersistedState } from "../../logic/persist";
import { setData, state } from "../../store";

// openSharedRoadbook（share.ts 唯一用到的 roadbook 出口）依赖大量 DOM/天气，整模块替身
// ——本套走的是 `#m=` 分支，压根不碰它（同 share-origin.test.ts 习语）。
vi.mock("../roadbook", () => ({ openSharedRoadbook: vi.fn() }));
import { checkMigrateHash } from "../share";
import { openTrip } from "../trip";

const LS_KEY = "nextstop_v2";

// happy-dom 不带 localStorage；本套要断言「已落盘的那份」，给一个 Map 版 stub（同 origin-switch.test.ts）。
function stubLocalStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
  });
}

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [], tripStart: "",
  });
}

function arriveWithMigration(p: Partial<PersistedState>) {
  const payload = { favs: [], cmp: [], trip: [], visited: [], tripStart: "", ...p };
  window.history.replaceState({}, "", `/${MIGRATE_HASH_PREFIX}${encodeMigration(payload)}`);
  checkMigrateHash();
}

const dateInput = () => document.getElementById("tripStartInput") as HTMLInputElement;

describe("F93：搬家认领后出发日期的状态→表单同步", () => {
  beforeEach(() => {
    stubLocalStorage();
    document.body.innerHTML = `
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
      <div id="importBar" style="display:none"><span id="importBarText"></span>
        <button id="importYes"></button><button id="importNo"></button></div>
      <div class="overlay" id="tripOverlay">
        <input type="date" id="tripStartInput">
        <div id="stopList"></div>
        <div id="tripStats"></div>
        <div id="tripSugg"></div>
      </div>`;
    setData([mkCity({ id: "hangzhou", name: "杭州" }), mkCity({ id: "suzhou", name: "苏州" })]);
    resetState();
  });

  it("本机为空 → 整份认领：state、localStorage、日期输入框三者一致", () => {
    arriveWithMigration({ favs: ["hangzhou"], trip: [{ id: "suzhou", days: 2 }], tripStart: "2026-08-01" });
    expect(state.tripStart).toBe("2026-08-01");
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).tripStart).toBe("2026-08-01");
    expect(location.hash).toBe(""); // 存档不留在地址栏里
    openTrip();
    expect(dateInput().value).toBe("2026-08-01");
  });

  it("认领的存档只有日期没有站点（空行程早退分支）也要同步", () => {
    arriveWithMigration({ favs: ["hangzhou"], tripStart: "2026-09-15" });
    openTrip();
    expect(state.trip).toHaveLength(0);
    expect(dateInput().value).toBe("2026-09-15");
  });

  it("本机已有内容 → 退回分享语义（弹确认条），日期不被旧链接改动", () => {
    state.favs = ["suzhou"];
    dateInput().value = "2026-10-01";
    state.tripStart = "2026-10-01";
    arriveWithMigration({ favs: ["hangzhou"], tripStart: "2026-08-01" });
    expect(state.tripStart).toBe("2026-10-01");
    openTrip();
    expect(dateInput().value).toBe("2026-10-01");
  });
});
