// @vitest-environment happy-dom
// M69 对比列删除：对比表每城列头带 ✕（data-rmcmp 走既有委托），看完详情不想比了就地移出。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { openCompare } from "../compare";

const DOM = `
  <div class="overlay" id="cmpOverlay"><div id="cmpTableWrap"></div></div>
  <div id="toast"></div>`;

describe("对比表列删除钮（M69）", () => {
  beforeEach(() => {
    document.body.innerHTML = DOM;
    setData([mkCity({ id: "a" }), mkCity({ id: "b" }), mkCity({ id: "c" })]);
    state.cmp = ["a", "b", "c"];
  });

  it("每个城市列头渲染一个 data-rmcmp 删除钮", () => {
    openCompare();
    const dels = document.querySelectorAll<HTMLElement>("#cmpTableWrap .cmp-del");
    expect(dels).toHaveLength(3);
    expect([...dels].map(b => b.dataset.rmcmp)).toEqual(["a", "b", "c"]);
    dels.forEach(b => expect(b.getAttribute("aria-label")).toContain("移出对比"));
  });

  it("池缩到 2 个重开对比表仍可比、删除钮跟随", () => {
    state.cmp = ["a", "b"];
    openCompare();
    expect(document.querySelectorAll("#cmpTableWrap .cmp-del")).toHaveLength(2);
    expect(document.getElementById("cmpOverlay")!.classList.contains("show")).toBe(true);
  });
});
