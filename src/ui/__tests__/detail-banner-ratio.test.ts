// @vitest-environment happy-dom
// M58：详情页头图容器帧比随图源双态切换——城市卡先用目的地个图（原生 3:2 完整展示不裁，
// .dt-banner 加 .photo 修饰类）；线路卡直接用大区题头（2:1 原生，不加 .photo）。
// 换源时的帧比联动（个图 404 退题头图 → 摘掉 .photo）在 skins/__tests__/illustrations.test.ts
// 单测 wireIllustFallbacks 本身；这里只钉「渲染时该不该打上 .photo」。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { setData } from "../../store";
import { openDetail } from "../detail";

describe("M58 详情头图 .dt-banner 帧比双态", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="overlay" id="detailOverlay">
        <div id="detailBody"></div>
      </div>
      <div id="wxSec"></div>`;
    // openDetail 顺带触发后台天气拉取（fetchWeather，异步不 await）；stub 掉 fetch 避免测试
    // 结束时遗留一个真实网络请求，被 happy-dom 拆卸阶段强制 abort 出无关的控制台噪音
    vi.stubGlobal("fetch", () => Promise.reject(new Error("no network in test")));
  });

  it("城市卡：.dt-banner 带 .photo（个图原生 3:2）", () => {
    setData([mkCity({ id: "hangzhou" })]);
    openDetail("hangzhou");
    const banner = document.querySelector(".dt-banner")!;
    expect(banner.classList.contains("photo")).toBe(true);
  });

  it("线路卡：.dt-banner 不带 .photo（大区题头 2:1 原生）", () => {
    setData([mkCity({
      id: "route1", name: "route1",
      stops: [{ id: "hangzhou", days: 2 }, { id: "suzhou", days: 2 }],
    }), mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" })]);
    openDetail("route1");
    const banner = document.querySelector(".dt-banner")!;
    expect(banner.classList.contains("photo")).toBe(false);
  });

  // [interrupt]（M58 实现期真机复验抓到）：headerBannerHTML 的图片曾是 loading="lazy"，插进
  // innerHTML 时 #detailOverlay 还是 display:none，紧接着同步加 .show——同批 [interrupt] 修过的
  // 票券卡图是一模一样的坑。未被浏览器缓存过的目的地个图/题头图在详情页里因此恒不加载
  // （complete:false，连请求都不发）。城市卡（含 fallback-src 重试链）与线路卡（无 fallback-src）
  // 两条渲染路径都要钉，回归覆盖两处 img 标签而非只覆盖其中一个。
  it("城市卡头图 loading=eager（不是 lazy）", () => {
    setData([mkCity({ id: "hangzhou" })]);
    openDetail("hangzhou");
    const img = document.querySelector(".dt-banner img")!;
    expect(img.getAttribute("loading")).toBe("eager");
  });

  it("线路卡头图 loading=eager（不是 lazy）", () => {
    setData([mkCity({
      id: "route1", name: "route1",
      stops: [{ id: "hangzhou", days: 2 }, { id: "suzhou", days: 2 }],
    }), mkCity({ id: "hangzhou" }), mkCity({ id: "suzhou" })]);
    openDetail("route1");
    const img = document.querySelector(".dt-banner img")!;
    expect(img.getAttribute("loading")).toBe("eager");
  });
});
