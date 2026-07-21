// @vitest-environment happy-dom
// M68：搜索命中概念词时结果区顶部给「按筛选看：××」一键 chip；点击应用对应筛选并清搜索词。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { applyIntent, render } from "../render";

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

  it("点击 chip 应用对应筛选（distMode）并清掉搜索词，intentBox 随之清空", () => {
    state.q = "短途";
    render();
    applyIntent();
    expect(state.distMode).toBe("short");
    expect(state.q).toBe("");
    expect((document.getElementById("searchBox") as HTMLInputElement).value).toBe("");
    expect(document.getElementById("intentBox")!.innerHTML).toBe("");
  });

  it("搜「海岛」的 chip 应用 tags=海岛海滨（既有筛选组，合并进现有选中不清空其余）", () => {
    state.tags = new Set(["美食"]);
    state.q = "海岛";
    render();
    applyIntent();
    expect([...state.tags].sort()).toEqual(["海岛海滨", "美食"].sort());
  });

  it("aka 命中的搜索不触发概念词 chip（普通关键词搜索，不是概念词）", () => {
    state.q = "川西";
    render();
    expect(document.getElementById("intentBox")!.innerHTML).toBe("");
    expect(document.querySelectorAll("#grid .card")).toHaveLength(1); // 只有稻城亚丁命中 aka
  });
});
