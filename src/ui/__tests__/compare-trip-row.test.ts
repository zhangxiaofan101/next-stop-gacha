// @vitest-environment happy-dom
// M86：对比页补链——对比表末行新增「装进行程」toggle 动作行，接通「扭蛋→蛋堆→对比→选定」决策链
// 最后一步的断链（design M86 规整对象④）。城市卡走 data-trip，线路卡走 data-addroute，两者判定与
// 文案同全站其余入口统一。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { openCompare } from "../compare";

const DOM = `
  <div class="overlay" id="cmpOverlay"><div id="cmpTableWrap"></div></div>
  <div id="toast"><span id="toastMsg"></span><button id="toastAction" hidden></button></div>`;

describe("M86 对比表「装进行程」动作行", () => {
  beforeEach(() => {
    document.body.innerHTML = DOM;
    setData([
      mkCity({ id: "a", name: "杭州" }),
      mkCity({ id: "route1", name: "江南环线", stops: [{ id: "a", days: 2 }, { id: "b", days: 2 }] }),
      mkCity({ id: "b", name: "苏州" }),
    ]);
    state.cmp = ["a", "route1"];
    state.trip = [];
  });

  function tripRowCells(): HTMLTableCellElement[] {
    const rows = [...document.querySelectorAll("#cmpTableWrap table.cmp tr")];
    const row = rows.find(r => r.querySelector(".rowh")?.textContent === "装进行程")!;
    return [...row.querySelectorAll("td")] as HTMLTableCellElement[];
  }

  it("末行存在，且每城一个 toggle 按钮", () => {
    openCompare();
    const cells = tripRowCells();
    expect(cells).toHaveLength(2);
    expect(cells[0].querySelector("button")).not.toBeNull();
    expect(cells[1].querySelector("button")).not.toBeNull();
  });

  it("城市卡未在行程：走 data-trip，文案「加入行程」，非 ghost", () => {
    openCompare();
    const btn = tripRowCells()[0].querySelector<HTMLButtonElement>("button")!;
    expect(btn.dataset.trip).toBe("a");
    expect(btn.dataset.addroute).toBeUndefined();
    expect(btn.textContent).toContain("加入行程");
    expect(btn.classList.contains("ghost")).toBe(false);
  });

  it("城市卡已在行程：文案「✓ 已在行程」，ghost 样式", () => {
    state.trip = [{ id: "a", days: 2 }];
    openCompare();
    const btn = tripRowCells()[0].querySelector<HTMLButtonElement>("button")!;
    expect(btn.textContent).toBe("✓ 已在行程");
    expect(btn.classList.contains("ghost")).toBe(true);
  });

  it("线路卡未装入：走 data-addroute，文案含站数", () => {
    openCompare();
    const btn = tripRowCells()[1].querySelector<HTMLButtonElement>("button")!;
    expect(btn.dataset.addroute).toBe("route1");
    expect(btn.dataset.trip).toBeUndefined();
    expect(btn.textContent).toBe("🎫 整条装入行程（2 站）");
    expect(btn.classList.contains("ghost")).toBe(false);
  });

  it("线路卡已装入（存在 r 标记条目）：文案「已装入」，ghost 样式", () => {
    state.trip = [{ id: "a", days: 2, r: "route1" }, { id: "b", days: 2, r: "route1" }];
    openCompare();
    const btn = tripRowCells()[1].querySelector<HTMLButtonElement>("button")!;
    expect(btn.textContent).toBe("已装入 ✓（点击整条移除）");
    expect(btn.classList.contains("ghost")).toBe(true);
  });
});
