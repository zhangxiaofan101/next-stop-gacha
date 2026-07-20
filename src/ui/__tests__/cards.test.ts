// @vitest-environment happy-dom
// M59 ④⑤⑨⑩⑫：卡片交通图标解析、收藏钮线形化、卡位共享集展示皮肤声明开关（含线路卡题头、
// 无个图城市退题头兜底）。
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData } from "../../store";
import { cardHTML } from "../cards";

function parseCard(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstElementChild as HTMLElement;
}

describe("cardHTML 卡位共享集展示（M59 ⑨⑩⑫，皮肤声明 cardPhotosEnabled 开关）", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
  });

  it("奶油（cardPhotos:false）：城市卡与线路卡均不生成 .c-photo 槽位", () => {
    document.documentElement.dataset.theme = "cream"; // 默认皮肤已改 ink（用户拍板），显式指定测奶油分支
    const city = parseCard(cardHTML(mkCity({ id: "hangzhou" }), 0));
    expect(city.querySelector(".c-photo")).toBeNull();
    const route = parseCard(cardHTML(mkCity({ id: "r1", stops: [{ id: "hangzhou", days: 2 }, { id: "suzhou", days: 2 }] }), 0));
    expect(route.querySelector(".c-photo")).toBeNull();
  });

  it("山水（cardPhotos:true）：城市卡生成 .c-photo，主源=目的地个图，回退源=所属大区题头（M59 ⑫ 沿用 M60 helper）", () => {
    document.documentElement.dataset.theme = "ink";
    const city = parseCard(cardHTML(mkCity({ id: "hangzhou", region: "江浙沪" }), 0));
    const img = city.querySelector<HTMLImageElement>(".c-photo .illust")!;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toMatch(/illustrations\/dest\/hangzhou\.webp$/);
    expect(img.dataset.fallbackSrc).toMatch(/illustrations\/dest\/region-jzh\.webp$/);
  });

  it("山水：线路卡 .c-photo 主源直接是所属大区题头（M59 ⑩，2:1 原生不经个图/回退链）", () => {
    document.documentElement.dataset.theme = "ink";
    const route = parseCard(cardHTML(mkCity({
      id: "r1", region: "西南", stops: [{ id: "hangzhou", days: 2 }, { id: "suzhou", days: 2 }],
    }), 0));
    const img = route.querySelector<HTMLImageElement>(".c-photo .illust")!;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toMatch(/illustrations\/dest\/region-xinan\.webp$/);
    expect(img.dataset.fallbackSrc).toBeUndefined(); // 线路卡题头本身就是共享层图源，不需要二次回退链
  });
});

describe("cardHTML 交通图标（M59 ④ 条带解析；用户反馈收窄：图标只留条带一处）", () => {
  it("城市卡：条带含 transit 首个方式词图标，名下行只是纯文字（不重复图标，用户反馈——非必要的图标削弱风格一致性）", () => {
    const card = parseCard(cardHTML(mkCity({ id: "hz", transit: "上海高铁2h直达；自驾约3h" }), 0));
    const stripText = card.querySelector(".c-route")!.textContent!;
    const subText = card.querySelector(".c-prov")!.textContent!;
    expect(stripText).toContain("🚄");
    expect(subText).not.toContain("🚄");
    expect(subText).toContain("上海高铁2h直达；自驾约3h");
  });

  it("飞机主导的目的地条带显示 ✈️，名下行同样不带图标", () => {
    const card = parseCard(cardHTML(mkCity({ id: "sanya", transit: "上海直飞约3h" }), 0));
    expect(card.querySelector(".c-route")!.textContent).toContain("✈️");
    expect(card.querySelector(".c-prov")!.textContent).not.toContain("✈️");
  });

  it("线路卡条带不含交通图标（沿用「🎫 联程线路」，与城市卡语义不同）", () => {
    setData([mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" })]);
    const route = parseCard(cardHTML(mkCity({
      id: "r1", stops: [{ id: "hangzhou", days: 2 }, { id: "suzhou", days: 2 }],
    }), 0));
    expect(route.querySelector(".c-route")!.textContent).toContain("🎫");
  });
});

describe("cardHTML 收藏钮（M59 ⑤：线形 heart 替换 ♥ 字符）", () => {
  it("收藏按钮内嵌 icons.ts 的线形 SVG，不再是 ♥ 字符", () => {
    const card = parseCard(cardHTML(mkCity({ id: "hz" }), 0));
    const favBtn = card.querySelector(".act.fav")!;
    expect(favBtn.querySelector("svg.ic")).not.toBeNull();
    expect(favBtn.textContent).not.toContain("♥");
  });
});
