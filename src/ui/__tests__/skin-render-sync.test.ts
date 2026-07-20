// @vitest-environment happy-dom
// F63（review 发现）：cardPhotosEnabled() 只在 cardHTML() 拼串时读一次当前皮肤，但此前
// selectSkin() 只调用 applySkinChoice()/renderSkin()，没有让已经渲染在网格里的卡片重新拼串——
// 真实浏览器复现：山水→奶油后卡片仍各自带着旧皮肤那份 .c-photo，要等下一次搜索触发的 render()
// 才会消失；弹层文案「点一下立即切换，不用刷新」因此对已渲染网格是假的。修法：selectSkin() 里
// applySkinChoice 之后立即调用 render()，让网格随皮肤切换同步刷新。
import { beforeEach, describe, expect, it } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { render } from "../render";
import { selectSkin } from "../skin";
import { setData, state } from "../../store";

describe("F63 皮肤切换同步刷新网格 cardPhotos", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="grid" id="grid"></div>
      <div id="empty" style="display:none"><div id="relaxBox"></div></div>
      <div id="hitCount"></div>
      <div class="dock" id="dock">
        <div class="dock-box" id="cmpBox"><div id="cmpItems"></div></div>
        <div class="dock-box" id="tripBox"><div id="tripItems"></div></div>
      </div>
      <button id="footPill"></button>
      <div id="toast" style="display:none"></div>
      <div class="overlay" id="skinOverlay">
        <div class="paper" id="skinBody"></div>
      </div>`;
    setData([mkCity({ id: "hangzhou" })]);
    Object.assign(state, {
      region: new Set(), season: new Set(), days: new Set(), crowd: new Set(),
      cost: new Set(), difficulty: new Set(), effort: new Set(), companions: new Set(),
      tags: new Set(), q: "", onlyFav: false, noAlt: false, hideVisited: false,
      favs: [], cmp: [], trip: [], visited: [],
    });
  });

  it("山水（cardPhotos:true）先渲染出 .c-photo，切到奶油后网格原地刷新为零 .c-photo（不必再搜索一次）", () => {
    document.documentElement.dataset.theme = "ink";
    render();
    expect(document.querySelectorAll("#grid .c-photo").length).toBeGreaterThan(0);

    selectSkin("cream");
    expect(document.documentElement.dataset.theme).toBe("cream");
    expect(document.querySelectorAll("#grid .c-photo").length).toBe(0);
  });

  it("反向：奶油先渲染零 .c-photo，切到山水后原地刷新为非零", () => {
    document.documentElement.dataset.theme = "cream";
    render();
    expect(document.querySelectorAll("#grid .c-photo").length).toBe(0);

    selectSkin("ink");
    expect(document.documentElement.dataset.theme).toBe("ink");
    expect(document.querySelectorAll("#grid .c-photo").length).toBeGreaterThan(0);
  });
});
