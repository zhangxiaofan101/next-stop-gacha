// @vitest-environment happy-dom
// M78：容忍型三组（花费/抵达/天数）行首显性「不限」chip——组空集时点亮、非空时点击清空该组、
// 已不限时点击 no-op；同批验证顶档裁撤后渲染不再含 ¥¥¥/折腾/2周+，天花板文案改「以内/最多」。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { buildConsole } from "../console";

function resetState() {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [],
  });
}

describe("M78：「不限」chip 三态行为", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section class="console" id="console"></section>
      <div class="grid" id="grid"></div>
      <div id="empty" style="display:none"><div id="relaxBox"></div></div>
      <div id="intentBox"></div>
      <div id="hitCount"></div>
      <div class="dock" id="dock">
        <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
        <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
      </div>
      <button id="footPill"></button>`;
    buildConsole();
    setData([mkCity({ id: "a" })]);
    resetState();
  });

  const unlimited = (key: string) => document.querySelector<HTMLElement>(`.chips[data-key="${key}"] .chip[data-v=""]`)!;
  const chip = (key: string, v: string) => document.querySelector<HTMLElement>(`.chips[data-key="${key}"] .chip[data-v="${v}"]`)!;

  it("组为空集时「不限」chip 呈点亮态（on + aria-pressed=true）", () => {
    for (const key of ["cost", "difficulty", "days"]) {
      const u = unlimited(key);
      expect(u.classList.contains("on")).toBe(true);
      expect(u.getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("点某档位后「不限」不再点亮；再点「不限」= 清空该组、自身重新点亮", () => {
    chip("cost", "¥¥").click();
    expect([...state.cost].sort()).toEqual(["¥", "¥¥"]);
    expect(unlimited("cost").classList.contains("on")).toBe(false);
    expect(unlimited("cost").getAttribute("aria-pressed")).toBe("false");

    unlimited("cost").click();
    expect(state.cost.size).toBe(0);
    expect(unlimited("cost").classList.contains("on")).toBe(true);
    expect(unlimited("cost").getAttribute("aria-pressed")).toBe("true");
    expect(chip("cost", "¥¥").classList.contains("on")).toBe(false);
  });

  it("已是不限时点击「不限」为 no-op", () => {
    expect(state.difficulty.size).toBe(0);
    unlimited("difficulty").click();
    expect(state.difficulty.size).toBe(0);
    expect(unlimited("difficulty").classList.contains("on")).toBe(true);
  });

  it("天数「不限」同一套语义：点档位后不再点亮、点不限清空", () => {
    chip("days", "5").click();
    expect([...state.days].sort()).toEqual(["2", "3", "5"]);
    expect(unlimited("days").classList.contains("on")).toBe(false);
    unlimited("days").click();
    expect(state.days.size).toBe(0);
    expect(unlimited("days").classList.contains("on")).toBe(true);
  });

  it("顶档裁撤：花费/抵达/天数行不再渲染 ¥¥¥/折腾/2周+", () => {
    expect(document.querySelector('.chips[data-key="cost"] .chip[data-v="¥¥¥"]')).toBeNull();
    expect(document.querySelector('.chips[data-key="difficulty"] .chip[data-v="折腾"]')).toBeNull();
    expect(document.querySelector('.chips[data-key="days"] .chip[data-v="14"]')).toBeNull();
    expect(document.querySelector('.chips[data-key="days"] .chip[data-v="45"]')).toBeNull();
  });

  it("天花板文案改「以内/最多」measure，花费日均价从 PER_DAY_COST 拼出", () => {
    expect(chip("cost", "¥").textContent).toBe("¥ ≈380/天内");
    expect(chip("cost", "¥¥").textContent).toBe("¥¥ ≈680/天内");
    expect(chip("difficulty", "一次中转").textContent).toBe("一次中转内");
    expect(chip("days", "5").textContent).toBe("最多5天");
    expect(chip("days", "7").textContent).toBe("最多1周");
  });

  it("偏好型组（地区/季节/人气/体力/同行/玩法）不加「不限」chip", () => {
    for (const key of ["region", "season", "crowd", "effort", "companions", "tags"]) {
      expect(document.querySelector(`.chips[data-key="${key}"] .chip[data-v=""]`)).toBeNull();
    }
  });
});
