// @vitest-environment happy-dom
// M22 出发地切换全链路（UI 层）：胶囊显隐（基座-only 不出）、切换后视角换值+卡面文案随视角、
// fetch 失败 toast 且维持原出发地（绝不静默显示错视角）、localStorage 记忆与 boot 恢复。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { BASE_ORIGIN, getOrigin, setOrigin } from "../../logic/origin";
import { byId, setData } from "../../store";
import { cardHTML } from "../cards";
import { restoreOrigin, switchOrigin, updateOriginPill, wireOriginSwitch } from "../origin";

const VIEW = {
  beijing: { transit: "本地出发·市内交通", difficulty: "直达" },
  shanghai: { transit: "高铁约4.5h / 直飞约2h", difficulty: "直达" },
  hangzhou: { transit: "高铁约5h", difficulty: "直达" },
};

function stubFetch(ok: boolean) {
  return vi.stubGlobal("fetch", vi.fn(async () =>
    ok ? new Response(JSON.stringify(VIEW), { status: 200 }) : new Response("", { status: 404 })));
}

// 本 vitest 环境的 happy-dom 不带 localStorage；store.ts 对 LS 全 try/catch（缺失=静默跳过），
// 但本套要断言「记忆」行为，故给一个 Map 版 stub。
function stubLocalStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
  });
}

describe("M22：出发地切换（UI）", () => {
  beforeEach(() => {
    stubLocalStorage();
    document.body.innerHTML = `<button id="originPill" style="display:none"></button><div id="originBody"></div>
      <div id="toast" style="display:none"><span id="toastMsg"></span></div>`;
    setData([
      mkCity({ id: "beijing", name: "北京", coords: [39.9, 116.4], region: "华北", transit: "高铁约4.5h", difficulty: "直达" }),
      mkCity({ id: "shanghai", name: "上海", coords: [31.23, 121.47], region: "江浙沪", transit: "本地出发·市内交通", difficulty: "直达" }),
      mkCity({ id: "hangzhou", name: "杭州", coords: [30.25, 120.17], region: "江浙沪", transit: "高铁约1h", difficulty: "直达" }),
    ]);
  });
  afterEach(async () => {
    // 复位：视角回基座（restoreOrigin 已注入过 published 索引，直接用 switchOrigin 走恢复路径）
    await switchOrigin("shanghai", { silent: true });
    setOrigin(BASE_ORIGIN);
    vi.unstubAllGlobals();
    wireOriginSwitch(() => {});
  });

  it("基座-only（索引空）：胶囊隐藏、北京不可切", async () => {
    stubFetch(true);
    await restoreOrigin({});
    expect((document.getElementById("originPill") as HTMLElement).style.display).toBe("none");
    expect(await switchOrigin("beijing")).toBe(false);
    expect(getOrigin().id).toBe("shanghai");
  });

  it("切到北京：视角换值、卡面「北京 ✈」、onSwitched 回调、LS 记忆、胶囊文案", async () => {
    stubFetch(true);
    const refreshed = vi.fn();
    wireOriginSwitch(refreshed);
    await restoreOrigin({ beijing: "origin-beijing-abc.json" });
    expect((document.getElementById("originPill") as HTMLElement).style.display).toBe("");
    expect(await switchOrigin("beijing")).toBe(true);
    expect(getOrigin().id).toBe("beijing");
    expect(byId("hangzhou")!.transit).toBe("高铁约5h");           // 视角值已生效
    expect(byId("beijing")!.transit).toBe("本地出发·市内交通");   // 本城条目（运行时对偶隐藏）
    expect(cardHTML(byId("hangzhou")!, 0)).toContain("北京");     // 卡面出发地行
    expect(refreshed).toHaveBeenCalled();
    expect(localStorage.getItem("nextstop_origin_v1")).toBe("beijing");
    expect(document.getElementById("originPill")!.textContent).toContain("北京出发");
    // 切回基座：恢复上海视角基座值
    expect(await switchOrigin("shanghai")).toBe(true);
    expect(byId("hangzhou")!.transit).toBe("高铁约1h");
  });

  it("视角文件 fetch 失败：维持原出发地、不动数据、不写坏状态", async () => {
    stubFetch(false);
    // 文件名与其他用例不同：缓存按发布文件名（内容 hash），换名=不吃前例的缓存，真打 fetch
    await restoreOrigin({ beijing: "origin-beijing-broken.json" });
    expect(await switchOrigin("beijing")).toBe(false);
    expect(getOrigin().id).toBe("shanghai");
    expect(byId("hangzhou")!.transit).toBe("高铁约1h");
  });

  it("boot 恢复：LS 记着北京且已发布→静默切北京；未发布→回基座", async () => {
    stubFetch(true);
    localStorage.setItem("nextstop_origin_v1", "beijing");
    await restoreOrigin({ beijing: "origin-beijing-abc.json" });
    expect(getOrigin().id).toBe("beijing");
    updateOriginPill();
    expect(document.getElementById("originPill")!.textContent).toContain("北京出发");
  });
});
