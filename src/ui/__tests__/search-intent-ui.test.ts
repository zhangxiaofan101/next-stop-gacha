// @vitest-environment happy-dom
// M68：搜索命中概念词时结果区顶部给「按筛选看：××」一键 chip；点击应用对应筛选并清搜索词。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { applyIntent, clearDistModeFilter, render } from "../render";

describe("M68：概念词一键筛选 chip", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="grid" id="grid"></div>
      <div id="empty" style="display:none"><div id="relaxBox"></div></div>
      <div id="intentBox"></div>
      <div id="hitCount"></div>
      <input id="searchBox">
      <div class="dock" id="dock">
        <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
        <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
      </div>
      <button id="footPill"></button>`;
    setData([
      mkCity({ id: "hangzhou", name: "杭州" }),
      mkCity({ id: "daocheng-yading", name: "稻城亚丁", aka: ["川西"] }),
    ]);
    Object.assign(state, {
      region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
      cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
      tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false, distMode: null,
      favs: [], cmp: [], trip: [], visited: [],
    });
  });

  it("搜索词不命中概念词时 intentBox 为空", () => {
    state.q = "杭州";
    render();
    expect(document.getElementById("intentBox")!.innerHTML).toBe("");
  });

  it("搜「短途」给筛选 chip，字面搜索命中数与 chip 出现与否无关", () => {
    state.q = "短途";
    render();
    const btn = document.querySelector("#intentBox [data-intent]");
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toContain("短途");
  });

  it("点击 chip 应用对应筛选（distMode）并清掉搜索词；F72：intentBox 随即换成可撤销的 active chip（不再清空）", () => {
    state.q = "短途";
    render();
    applyIntent();
    expect(state.distMode).toBe("short");
    expect(state.q).toBe("");
    expect((document.getElementById("searchBox") as HTMLInputElement).value).toBe("");
    const active = document.querySelector("#intentBox [data-clear-dist]");
    expect(active).toBeTruthy();
    expect(active!.textContent).toContain("短途");
  });

  it("F72：单独点掉 distMode active chip 只清该项，intentBox 归空，不影响其余筛选", () => {
    state.region = new Set(["江浙沪"]);
    state.q = "短途";
    render();
    applyIntent();
    expect(state.distMode).toBe("short");
    clearDistModeFilter();
    expect(state.distMode).toBeNull();
    expect(document.getElementById("intentBox")!.innerHTML).toBe("");
    expect([...state.region]).toEqual(["江浙沪"]); // 其余筛选不受影响
  });

  it("F72：distMode active chip 与「按筛选看」建议 chip 可同时出现", () => {
    state.q = "短途";
    render();
    applyIntent(); // distMode=short，q 已清空
    state.q = "亲子"; // 再搜一个新概念词，建议 chip 应与刚生效的 active chip 并存
    render();
    expect(document.querySelector("#intentBox [data-clear-dist]")).toBeTruthy();
    expect(document.querySelector("#intentBox [data-intent]")).toBeTruthy();
  });

  it("搜「海岛」的 chip 应用 tags=海岛海滨（既有筛选组，合并进现有选中不清空其余）", () => {
    state.tags = new Set(["美食"]);
    state.q = "海岛";
    render();
    applyIntent();
    expect([...state.tags].sort()).toEqual(["海岛海滨", "美食"].sort());
  });

  it("F71：已选「冬」时搜「避暑」——OR 偏好组替换为单一新值，不残留旧选中扩大命中范围", () => {
    state.season = new Set(["冬"]);
    state.q = "避暑";
    render();
    applyIntent();
    expect([...state.season]).toEqual(["夏"]); // 不是 {冬,夏}
  });

  it("F71：已选「独行」时搜「亲子」——companions 同为 OR 偏好组，替换而非合并", () => {
    state.companions = new Set(["独行"]);
    state.q = "亲子";
    render();
    applyIntent();
    expect([...state.companions]).toEqual(["带娃"]); // 不是 {独行,带娃}
  });

  it("aka 命中的搜索不触发概念词 chip（普通关键词搜索，不是概念词）", () => {
    state.q = "川西";
    render();
    expect(document.getElementById("intentBox")!.innerHTML).toBe("");
    expect(document.querySelectorAll("#grid .card")).toHaveLength(1); // 只有稻城亚丁命中 aka
  });
});
