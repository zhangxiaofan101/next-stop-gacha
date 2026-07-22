// @vitest-environment happy-dom
// F78：短链分享路书固化「分享者的出发地」。接收端 checkShareCode 的 trip 分支必须**先切到分享者
// 的视角再渲染**，否则默认（上海）视角的访客打开会把首末段/交通/预算按「上海往返」无声重算，违反
// 「分享副本保持原义」。本套钉住三条语义：
//   ①当前=北京 + 无 originId 的旧版 payload → 打开前切回上海（旧版短链=M22 前基座上海），路书仍打开；
//   ②当前=上海 + originId=beijing（已发布）→ 切到北京、**不写 localStorage**（persist:false 不覆盖
//     访客偏好）、出定制 toast 告知视角变了；
//   ③originId 未发布/未知 → 不切换、出诚实降级 toast、路书**仍然打开**（分享失败一律优雅降级）。
// openSharedRoadbook 依赖大量 DOM/天气，vi.mock 整个 roadbook 模块换掉，只断言调用与「调用时视角已切」。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkCity } from "../../logic/__tests__/helpers";
import { BASE_ORIGIN, getOrigin, setOrigin } from "../../logic/origin";
import { setData } from "../../store";
import { restoreOrigin, switchOrigin, wireOriginSwitch } from "../origin";

// roadbook 整模块替身：checkShareCode 只从这里取 openSharedRoadbook，替身实现里顺手记录「调用当刻
// 的出发地」，用来钉「先切视角再渲染」的时序（若被改成先 open 后 switch，这里会记到旧视角）。
vi.mock("../roadbook", () => ({ openSharedRoadbook: vi.fn() }));
import { openSharedRoadbook } from "../roadbook";
import { checkShareCode } from "../share";

const ORIGIN_LS_KEY = "nextstop_origin_v1";

const VIEW = {
  beijing: { transit: "本地出发·市内交通", difficulty: "直达" },
  shanghai: { transit: "高铁约4.5h / 直飞约2h", difficulty: "直达" },
  hangzhou: { transit: "高铁约5h", difficulty: "直达" },
};

// URL 分流：/api/share/:code 回分享 payload；/data/<file> 回视角 ViewMap（viewOk=false 模拟视角文件挂了）。
function stubFetch(sharePayload: unknown, viewOk = true) {
  vi.stubGlobal("fetch", vi.fn(async (url: unknown) => {
    const u = String(url);
    if (u.includes("/api/share/")) return new Response(JSON.stringify(sharePayload), { status: 200 });
    if (u.includes("/data/")) return viewOk
      ? new Response(JSON.stringify(VIEW), { status: 200 })
      : new Response("", { status: 404 });
    return new Response("", { status: 404 });
  }));
}

// happy-dom 不带 localStorage；本套要断言「未写记忆」，给一个 Map 版 stub（同 origin-switch.test.ts）。
function stubLocalStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => m.set(k, String(v)),
    removeItem: (k: string) => m.delete(k),
    clear: () => m.clear(),
  });
}

function setShareCode(code: string) {
  window.history.replaceState({}, "", `/?sc=${code}`);
}

// 替身在被调用当刻记录出发地——测「先切视角再渲染」的时序，而不只是最终态。
let openedWithOriginId = "";

describe("F78：分享路书按分享者出发地展示（接收端 checkShareCode）", () => {
  beforeEach(() => {
    stubLocalStorage();
    document.body.innerHTML = `<button id="originPill" style="display:none"></button>
      <div id="toast" style="display:none"><span id="toastMsg"></span></div>`;
    setData([
      mkCity({ id: "beijing", name: "北京", coords: [39.9, 116.4], region: "华北" }),
      mkCity({ id: "shanghai", name: "上海", coords: [31.23, 121.47], region: "江浙沪" }),
      mkCity({ id: "hangzhou", name: "杭州", coords: [30.25, 120.17], region: "江浙沪" }),
    ]);
    setOrigin(BASE_ORIGIN);
    wireOriginSwitch(() => {});
    openedWithOriginId = "";
    vi.mocked(openSharedRoadbook).mockReset();
    vi.mocked(openSharedRoadbook).mockImplementation(() => { openedWithOriginId = getOrigin().id; });
  });
  afterEach(() => {
    setOrigin(BASE_ORIGIN);
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/");
  });

  const toastMsg = () => document.getElementById("toastMsg")!.textContent || "";

  it("①当前=北京 + 无 originId 的旧版 payload → 渲染前切回上海，路书仍打开", async () => {
    stubFetch({ type: "trip", payload: { trip: [{ id: "hangzhou", days: 3 }] } }); // 无 originId 字段
    await restoreOrigin({ beijing: "origin-beijing-share1.json" });
    expect(await switchOrigin("beijing")).toBe(true); // 访客当前处于北京视角
    expect(getOrigin().id).toBe("beijing");

    setShareCode("HIST01");
    await checkShareCode();

    expect(getOrigin().id).toBe("shanghai");          // 旧版短链按 M22 前基座上海解释，已切回
    expect(openedWithOriginId).toBe("shanghai");       // 关键：openSharedRoadbook 是在切回之后才被调用
    expect(vi.mocked(openSharedRoadbook)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(openSharedRoadbook).mock.calls[0][0]).toEqual([{ id: "hangzhou", days: 3 }]);
    expect(toastMsg()).toContain("上海");              // 告知访客视角变了
  });

  it("②当前=上海 + originId=beijing（已发布）→ 切到北京、不写 localStorage、出定制 toast", async () => {
    stubFetch({ type: "trip", payload: { trip: [{ id: "hangzhou", days: 3 }], originId: "beijing" } });
    await restoreOrigin({ beijing: "origin-beijing-share2.json" }); // 北京已发布；无 LS 记忆→当前仍上海
    expect(getOrigin().id).toBe("shanghai");

    setShareCode("BJSHR2");
    await checkShareCode();

    expect(getOrigin().id).toBe("beijing");            // 切到分享者视角
    expect(openedWithOriginId).toBe("beijing");        // 切后才渲染
    expect(vi.mocked(openSharedRoadbook)).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ORIGIN_LS_KEY)).toBeNull(); // persist:false——绝不覆盖访客的出发地记忆
    expect(toastMsg()).toContain("分享者");
    expect(toastMsg()).toContain("北京");
  });

  it("③originId 未发布 → 不切换、降级 toast、路书仍打开", async () => {
    stubFetch({ type: "trip", payload: { trip: [{ id: "hangzhou", days: 3 }], originId: "beijing" } });
    await restoreOrigin({}); // 空索引：北京未发布，此访客不可切
    expect(getOrigin().id).toBe("shanghai");

    setShareCode("NOPUB3");
    await checkShareCode();

    expect(getOrigin().id).toBe("shanghai");           // 切换失败，维持访客当前出发地
    expect(openedWithOriginId).toBe("shanghai");
    expect(vi.mocked(openSharedRoadbook)).toHaveBeenCalledTimes(1); // 失败仍优雅降级打开路书
    expect(toastMsg()).toContain("失败");               // 诚实告知按当前出发地重算
    expect(toastMsg()).toContain("上海");
  });

  it("④originId 与访客当前出发地一致 → 不切换、不出多余 toast，直接打开", async () => {
    stubFetch({ type: "trip", payload: { trip: [{ id: "hangzhou", days: 3 }], originId: "shanghai" } });
    await restoreOrigin({}); // 当前=上海，payload 也是上海
    expect(getOrigin().id).toBe("shanghai");

    setShareCode("SAME04");
    await checkShareCode();

    expect(getOrigin().id).toBe("shanghai");
    expect(vi.mocked(openSharedRoadbook)).toHaveBeenCalledTimes(1);
    expect(toastMsg()).toBe(""); // 视角没变，不打扰
  });
});
