// @vitest-environment happy-dom
// M86 入口矩阵①：卡片小按钮（cards.ts）与详情大按钮（detail.ts）的诚实 toggle 两态文案。
// 城市卡：cards.ts 沿用既有 .on 点亮类（「🧳 行程」↔「已排 ✓」）；detail.ts 城市卡文案维持
// 现状不动（已是范本）。线路卡：两处统一「🎫 整条装入行程（N 站）」↔「已装入 ✓（点击整条移除）」，
// ghost 样式标记已完成态，已装入判定只认 r 标记（state.trip.some(t => t.r === routeId)）。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData, state } from "../../store";
import { cardHTML } from "../cards";
import { openDetail } from "../detail";

function parseCard(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstElementChild as HTMLElement;
}

describe("cards.ts 行程按钮 toggle（M86 入口①④）", () => {
  beforeEach(() => { state.trip = []; });

  it("城市卡：未在行程「🧳 行程」（无 .on），已在行程「已排 ✓」（.on 点亮类保留）", () => {
    const d = mkCity({ id: "hz", name: "杭州" });
    let card = parseCard(cardHTML(d, 0));
    let btn = card.querySelector<HTMLButtonElement>(".act.trip")!;
    expect(btn.textContent!.trim()).toContain("行程");
    expect(btn.textContent).not.toContain("已排");
    expect(btn.classList.contains("on")).toBe(false);

    state.trip = [{ id: "hz", days: 2 }];
    card = parseCard(cardHTML(d, 0));
    btn = card.querySelector<HTMLButtonElement>(".act.trip")!;
    expect(btn.textContent!.trim()).toBe("已排 ✓");
    expect(btn.classList.contains("on")).toBe(true);
  });

  it("线路卡：未装入「🎫 整条装入行程（N 站）」，已装入（存在 r 标记条目）「已装入 ✓（点击整条移除）」+ ghost", () => {
    const route = mkCity({ id: "r1", name: "江南环线", stops: [{ id: "hz", days: 2 }, { id: "sz", days: 2 }, { id: "nj", days: 1 }] });
    let card = parseCard(cardHTML(route, 0));
    let btn = card.querySelector<HTMLButtonElement>(".act.trip")!;
    expect(btn.textContent).toBe("🎫 整条装入行程（3 站）");
    expect(btn.dataset.addroute).toBe("r1");
    expect(btn.classList.contains("ghost")).toBe(false);

    state.trip = [{ id: "hz", days: 2, r: "r1" }]; // 只要有一条 r 标记条目就判定已装入，不要求三站齐全
    card = parseCard(cardHTML(route, 0));
    btn = card.querySelector<HTMLButtonElement>(".act.trip")!;
    expect(btn.textContent).toBe("已装入 ✓（点击整条移除）");
    expect(btn.classList.contains("ghost")).toBe(true);
  });

  it("线路卡已装入判定不被同名城市站的手动添加（无 r）误判", () => {
    const route = mkCity({ id: "r1", name: "江南环线", stops: [{ id: "hz", days: 2 }] });
    state.trip = [{ id: "hz", days: 5 }]; // 用户手动单独加的杭州，无 r 标记
    const card = parseCard(cardHTML(route, 0));
    const btn = card.querySelector<HTMLButtonElement>(".act.trip")!;
    expect(btn.textContent).toBe("🎫 整条装入行程（1 站）"); // 仍判定为未装入
  });
});

describe("detail.ts 行程按钮 toggle（M86 入口②）", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="overlay" id="detailOverlay"><div id="detailBody"></div><div id="detailActBar"></div></div>
      <div id="wxSec"></div>`;
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in test")));
    state.trip = [];
  });

  it("城市卡：文案维持现状不动（已是范本）——未在行程/已在行程两态", () => {
    setData([mkCity({ id: "hz", name: "杭州" })]);
    openDetail("hz");
    let btn = document.querySelector<HTMLButtonElement>('[data-trip="hz"]')!;
    expect(btn.textContent).toContain("加入行程");
    expect(btn.classList.contains("ghost")).toBe(false);

    state.trip = [{ id: "hz", days: 2 }];
    openDetail("hz");
    btn = document.querySelector<HTMLButtonElement>('[data-trip="hz"]')!;
    expect(btn.textContent).toBe("已在行程 ✓（点击移除）");
    expect(btn.classList.contains("ghost")).toBe(true);
  });

  it("同卡重渲染保住滚动位（详情内 toggle 靠重进 openDetail 刷新文案），换卡回到顶", () => {
    setData([mkCity({ id: "hz", name: "杭州" }), mkCity({ id: "sz", name: "苏州" })]);
    openDetail("hz");
    const body = document.getElementById("detailBody")!;
    body.scrollTop = 260; // 用户滚到下面
    openDetail("hz"); // 同卡重渲染（toggle 后的刷新路径）
    expect(body.scrollTop).toBe(260);
    openDetail("sz"); // 换卡
    expect(body.scrollTop).toBe(0);
  });

  it("线路卡：统一文案「🎫 整条装入行程（N 站）」↔「已装入 ✓（点击整条移除）」，与卡片面/揭晓卡一致", () => {
    setData([
      mkCity({ id: "r1", name: "江南环线", stops: [{ id: "hz", days: 2 }, { id: "sz", days: 2 }] }),
      mkCity({ id: "hz" }), mkCity({ id: "sz" }),
    ]);
    openDetail("r1");
    let btn = document.querySelector<HTMLButtonElement>('[data-addroute="r1"]')!;
    expect(btn.textContent).toBe("🎫 整条装入行程（2 站）");
    expect(btn.classList.contains("ghost")).toBe(false);

    state.trip = [{ id: "hz", days: 2, r: "r1" }, { id: "sz", days: 2, r: "r1" }];
    openDetail("r1");
    btn = document.querySelector<HTMLButtonElement>('[data-addroute="r1"]')!;
    expect(btn.textContent).toBe("已装入 ✓（点击整条移除）");
    expect(btn.classList.contains("ghost")).toBe(true);
  });
});
