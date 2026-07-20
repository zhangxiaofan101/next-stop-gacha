// @vitest-environment happy-dom
// M59 ④ 收尾：详情页 dt-meta 交通行图标改为与卡片同源的 parseTransitIcon 解析——此前硬编码
// 恒 🚄，与 M59 修复前的卡片是同一个病（高铁城显✈/飞机城显🚄），只是发生在详情页。
// 线路卡与城市卡不同：cards.ts 对线路不显示 transit（无图标可言），详情页真的展示线路 transit
// （首末大交通文案，方式词齐全），故线路卡同样解析、不豁免。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData } from "../../store";
import { openDetail } from "../detail";

const transitRow = (transit: string): string => {
  const span = [...document.querySelectorAll<HTMLElement>(".dt-meta span")]
    .find(s => s.textContent!.includes(transit));
  expect(span, `dt-meta 里找不到含「${transit}」的行`).toBeDefined();
  return span!.textContent!.trim();
};

describe("详情页交通行图标按 transit 文案解析（M59 ④ 收尾）", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="overlay" id="detailOverlay"><div id="detailBody"></div></div>
      <div id="wxSec"></div>`;
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in test")));
  });

  it("飞机城不再恒显 🚄——直飞文案解析出 ✈️", () => {
    setData([mkCity({ id: "macau", transit: "直飞2.5h / 高铁至珠海后过关约1h" })]);
    openDetail("macau");
    expect(transitRow("直飞2.5h").startsWith("✈️")).toBe(true);
  });

  it("高铁城维持 🚄（解析结果与旧硬编码恰好一致的场景零变化）", () => {
    setData([mkCity({ id: "hangzhou", transit: "上海高铁45min-1h直达；自驾约2.5h" })]);
    openDetail("hangzhou");
    expect(transitRow("上海高铁45min").startsWith("🚄")).toBe(true);
  });

  it("线路卡同样解析——直飞开头的线路 transit 显 ✈️ 而非 🚄", () => {
    setData([
      mkCity({ id: "route-n", name: "北疆线", transit: "上海直飞乌鲁木齐约5.5h", stops: [{ id: "hangzhou", days: 2 }] }),
      mkCity({ id: "hangzhou" }),
    ]);
    openDetail("route-n");
    expect(transitRow("上海直飞乌鲁木齐").startsWith("✈️")).toBe(true);
  });

  it("无方式词的模糊文案落中性兜底 🧭，不猜具体方式", () => {
    setData([mkCity({ id: "vague", transit: "经兰州或西安中转，全程约1天" })]);
    openDetail("vague");
    expect(transitRow("经兰州或西安中转").startsWith("🧭")).toBe(true);
  });
});
