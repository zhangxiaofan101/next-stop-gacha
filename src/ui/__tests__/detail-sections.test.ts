// @vitest-environment happy-dom
// M59 ⑥：详情区段视觉系统——chip 家族三成员（美食/博物馆/古建古迹）同构格式各自一色，此前
// 博物馆与古建古迹无差别沿用同一蓝色（两同一异）；特色体验列表获得自己的项目符号色。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData } from "../../store";
import { openDetail } from "../detail";

describe("详情区段视觉系统（M59 ⑥）", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="overlay" id="detailOverlay"><div id="detailBody"></div></div>
      <div id="wxSec"></div>`;
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in test")));
  });

  it("古建古迹 chip 带 arch 类，与博物馆（无类=默认蓝）区分开——不再两者共用同一视觉", () => {
    setData([mkCity({ id: "hangzhou", museums: ["浙江省博物馆"], architecture: ["灵隐寺"] })]);
    openDetail("hangzhou");
    const chips = [...document.querySelectorAll<HTMLElement>(".dt-chip")];
    const archChip = chips.find(c => c.textContent === "灵隐寺")!;
    const museumChipEl = chips.find(c => c.textContent === "浙江省博物馆")!;
    expect(archChip.classList.contains("arch")).toBe(true);
    expect(museumChipEl.classList.contains("arch")).toBe(false);
    expect(archChip.classList.contains("food")).toBe(false);
  });

  it("美食 chip 仍带 food 类（未受本次调整影响）", () => {
    setData([mkCity({ id: "hangzhou", food: ["西湖醋鱼"] })]);
    openDetail("hangzhou");
    const foodChip = [...document.querySelectorAll<HTMLElement>(".dt-chip")].find(c => c.textContent === "西湖醋鱼")!;
    expect(foodChip.classList.contains("food")).toBe(true);
  });

  it("特色体验列表带 highlight 类（此前是无差别的裸 dt-list，与途经站点列表不可区分）", () => {
    setData([mkCity({ id: "hangzhou", highlights: ["清晨在苏堤看晨雾中的西湖"] })]);
    openDetail("hangzhou");
    const list = document.querySelector(".dt-list.highlight");
    expect(list).not.toBeNull();
    expect(list!.textContent).toContain("清晨在苏堤看晨雾中的西湖");
  });

  it("线路卡途经站点列表不带 highlight 类（与城市卡的特色体验列表是两个不同的家族成员）", () => {
    setData([
      mkCity({ id: "route1", name: "route1", stops: [{ id: "hangzhou", days: 2 }] }),
      mkCity({ id: "hangzhou" }),
    ]);
    openDetail("route1");
    const stopsList = document.querySelector(".dt-list");
    expect(stopsList).not.toBeNull();
    expect(stopsList!.classList.contains("highlight")).toBe(false);
  });
});
