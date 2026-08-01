// @vitest-environment happy-dom
// M22 出发地切换全链路（UI 层）：胶囊显隐（基座-only 不出）、切换后视角换值+卡面文案随视角、
// fetch 失败 toast 且维持原出发地（绝不静默显示错视角）、localStorage 记忆与 boot 恢复、
// 并发切换 latest-request-wins（F80：悬起的旧请求晚到不覆盖更晚一次点击已落地的状态）。
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

// 竞态测试专用：手动控制 resolve 时机的 fetch stub。每次调用 fetch 都悬起一个 resolver 压进队列，
// 测试自己决定「谁先 resolve、谁后 resolve」，从而钉住 latest-request-wins 而非依赖真实网络时序。
function stubDeferredFetch() {
  const resolvers: Array<(r: Response) => void> = [];
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { resolvers.push(resolve); })));
  return resolvers;
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
      <div id="toast" style="display:none"><span id="toastMsg"></span><button id="toastAction" hidden></button></div>`;
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

  // F92 回归：页面开着期间发过新版本——手里的索引指着旧 hash 视角文件，线上已不存在（新 SW
  // 激活时还会把旧版本缓存一并清掉）。重取 origins.json 拿新文件名再试一次，切换照样成功。
  it("F92：旧 hash 视角文件已下线 → 重取索引自修复，切换仍成功", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("data/origins.json")) return new Response(JSON.stringify({ beijing: "origin-beijing-f92-v2.json" }), { status: 200 });
      if (u.endsWith("data/origin-beijing-f92-v2.json")) return new Response(JSON.stringify(VIEW), { status: 200 });
      return new Response("", { status: 404 }); // v1：线上已没有这个文件了
    }));
    await restoreOrigin({ beijing: "origin-beijing-f92-v1.json" }); // 无记忆、当前即上海，不触发 fetch
    expect(await switchOrigin("beijing")).toBe(true);
    expect(getOrigin().id).toBe("beijing");
    expect(byId("hangzhou")!.transit).toBe("高铁约5h"); // 视角值来自新文件
    expect(calls).toEqual([ // 旧名 → 索引 → 新名，不多试
      expect.stringContaining("origin-beijing-f92-v1.json"),
      expect.stringContaining("origins.json"),
      expect.stringContaining("origin-beijing-f92-v2.json"),
    ]);
  });

  // 同上的另一半：索引重取回来文件名没变（=不是版本漂移，是这个文件真取不到），不该无限重试，
  // 老老实实走原来的降级路径（维持原出发地 + toast）。
  it("F92：索引重取后文件名未变 → 不再重试，按原降级路径维持出发地", async () => {
    const fetchSpy = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.endsWith("data/origins.json")) return new Response(JSON.stringify({ beijing: "origin-beijing-f92-same.json" }), { status: 200 });
      return new Response("", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    await restoreOrigin({ beijing: "origin-beijing-f92-same.json" });
    expect(await switchOrigin("beijing")).toBe(false);
    expect(getOrigin().id).toBe("shanghai");
    expect(byId("hangzhou")!.transit).toBe("高铁约1h"); // 数据没被动过
    expect(fetchSpy).toHaveBeenCalledTimes(2); // 视角文件 + 索引，到此为止
  });

  // F80 回归：北京悬起 → 立刻点回上海（同城早退，同步成功）→ 北京响应姗姗来迟，
  // 必须被作废——不 setOrigin、不 applyView、不写 LS，界面停在用户最后一次点击（上海）。
  it("竞态 a：北京悬起时点回上海（同城早退）→ 北京稍后 resolve 不覆盖", async () => {
    const calls = stubDeferredFetch();
    // 只用于注入 published 索引：此刻 LS 无记忆、当前就是上海，want===cur，不会触发 fetch
    await restoreOrigin({ beijing: "origin-beijing-race-a.json" });

    const beijingSwitch = switchOrigin("beijing"); // fetch 悬起（calls[0]）
    expect(await switchOrigin("shanghai")).toBe(true); // 同城早退：同步成功，不吃这次 fetch

    calls[0](new Response(JSON.stringify(VIEW), { status: 200 })); // 北京响应姗姗来迟
    expect(await beijingSwitch).toBe(false); // 已作废，静默放弃

    expect(getOrigin().id).toBe("shanghai"); // 停在用户最后一次点击
    expect(byId("hangzhou")!.transit).toBe("高铁约1h"); // 视角未被北京覆盖（仍是上海基座值）
    expect(localStorage.getItem("nextstop_origin_v1")).not.toBe("beijing"); // 未写坏 LS
  });

  // F80 回归：连点两次北京（第二次视为「模拟重新发布后再点」，用不同发布文件名制造两个独立的悬起
  // fetch）——后一次的响应先到就该生效，前一次姗姗来迟的响应不得覆盖已经落地的状态。
  it("竞态 b：连点两次北京（后者先 resolve 生效，前者稍后 resolve 不覆盖）", async () => {
    const calls = stubDeferredFetch();
    const VIEW_OLD = { ...VIEW, hangzhou: { transit: "旧响应·不应生效", difficulty: "直达" } };
    const VIEW_NEW = { ...VIEW, hangzhou: { transit: "新响应·应当生效", difficulty: "直达" } };

    await restoreOrigin({ beijing: "origin-beijing-race-b1.json" }); // 第一版索引，未触发 fetch（同上）
    const first = switchOrigin("beijing"); // fetch 悬起（calls[0]，文件 b1）

    await restoreOrigin({ beijing: "origin-beijing-race-b2.json" }); // 模拟重新发布：换了文件名；
    // 此刻出发地仍是上海（first 还悬着），want===cur，这次调用本身不触发 fetch
    const second = switchOrigin("beijing"); // fetch 悬起（calls[1]，文件 b2，非同城早退）

    calls[1](new Response(JSON.stringify(VIEW_NEW), { status: 200 })); // 后者先到
    expect(await second).toBe(true);
    expect(getOrigin().id).toBe("beijing");
    expect(byId("hangzhou")!.transit).toBe("新响应·应当生效");

    calls[0](new Response(JSON.stringify(VIEW_OLD), { status: 200 })); // 前者姗姗来迟
    expect(await first).toBe(false); // 已作废
    expect(getOrigin().id).toBe("beijing"); // 仍是后者落地的状态，没被搅乱
    expect(byId("hangzhou")!.transit).toBe("新响应·应当生效"); // 视角值没被旧响应覆盖回去
  });
});
