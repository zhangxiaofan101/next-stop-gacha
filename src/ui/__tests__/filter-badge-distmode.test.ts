// @vitest-environment happy-dom
// F72：手机收纳态徽章此前不计 distMode——只开「短途/长途」时徽章显示为空，看起来像「无筛选生效」，
// 和扭蛋池说明条一样是不可见的幽灵筛选。回归钉住徽章计数与共存场景下的累加。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { buildConsole, updateChipCounts } from "../console";

function resetState(over: Record<string, unknown> = {}) {
  Object.assign(state, {
    region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
    cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
    tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
    favs: [], cmp: [], trip: [], visited: [], ...over,
  });
}

describe("F72 手机筛选徽章计入 distMode", () => {
  beforeEach(() => {
    document.body.innerHTML = '<section class="console" id="console"></section>';
    buildConsole();
    setData([mkCity({ id: "a" })]);
    resetState();
  });

  it("distMode=null 时徽章为空；设为 short 后徽章计 1", () => {
    updateChipCounts();
    expect(document.getElementById("filterBadge")!.textContent).toBe("");
    state.distMode = "short";
    updateChipCounts();
    expect(document.getElementById("filterBadge")!.textContent).toBe("1");
  });

  it("distMode 与其余筛选组共存时徽章累加，不互相覆盖", () => {
    state.region = new Set(["江浙沪"]);
    state.distMode = "long";
    updateChipCounts();
    expect(document.getElementById("filterBadge")!.textContent).toBe("2");
  });
});
