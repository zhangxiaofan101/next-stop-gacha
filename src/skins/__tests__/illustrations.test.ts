// @vitest-environment happy-dom
// M46：插画接入契约验真——assetDir/decorations 真实驱动渲染，字体子集产物有可执行证据，
// 三级缺图回退（fallback-src → emoji → 移除容器）真的按顺序退化，而不是摆设声明。
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applySkinVisuals, assetDirFor, currentSkinId, destPhotoSrc, illustSrc, regionHeaderSrc, regionSlot,
  wireIllustFallbacks,
} from "../illustrations";
import { SKINS } from "../registry";

const ROOT = process.cwd();

describe("illustSrc / destPhotoSrc / regionSlot", () => {
  it("按 assetDir + 槽位名拼路径，assetDir 真的进了 URL", () => {
    expect(illustSrc("ink", "mascot")).toMatch(/illustrations\/ink\/mascot\.webp$/);
    expect(illustSrc("cream", "mascot")).toMatch(/illustrations\/cream\/mascot\.webp$/);
  });
  it("destPhotoSrc 走皮肤无关的 dest 共享目录", () => {
    expect(destPhotoSrc("hangzhou")).toMatch(/illustrations\/dest\/hangzhou\.webp$/);
  });
  it("regionSlot 从 REGION_SLUG 拼 region-<slug>，未知大区兜底江浙沪", () => {
    expect(regionSlot("江浙沪")).toBe("region-jzh");
    expect(regionSlot("港澳")).toBe("region-gangao");
    expect(regionSlot("不存在的大区")).toBe("region-jzh");
  });
});

// M60：九区题头晋升共享题头层——URL 恒走 illustrations/dest/region-<slug>.webp，不设皮肤覆盖。
describe("regionHeaderSrc（M60：九区题头恒走共享层，不设皮肤覆盖）", () => {
  it("拼出 illustrations/dest/region-<slug>.webp，不经 assetDir", () => {
    expect(regionHeaderSrc("江浙沪")).toMatch(/illustrations\/dest\/region-jzh\.webp$/);
    expect(regionHeaderSrc("港澳")).toMatch(/illustrations\/dest\/region-gangao\.webp$/);
  });
  it("与当前皮肤无关——切换 data-theme 不改变解析出的 URL", () => {
    document.documentElement.dataset.theme = "ink";
    const inkResolved = regionHeaderSrc("华东");
    document.documentElement.dataset.theme = "cream";
    const creamResolved = regionHeaderSrc("华东");
    expect(inkResolved).toBe(creamResolved);
    expect(inkResolved).toMatch(/illustrations\/dest\/region-huadong\.webp$/);
  });
  it("等价于 destPhotoSrc(regionSlot(region))——复用既有 dest 共享层拼接，不是另起一套路径", () => {
    expect(regionHeaderSrc("西北")).toBe(destPhotoSrc(regionSlot("西北")));
  });
});

describe("assetDirFor（F58 探针：id!==assetDir 时声明真驱动 URL，不是 id===assetDir 巧合自证）", () => {
  it("真实 SKINS 里 ink/cream 当前 id===assetDir，仍按 assetDir 字段取值（非硬编码 id）", () => {
    expect(assetDirFor("ink")).toBe("ink");
    expect(assetDirFor("cream")).toBe("cream");
  });
  it("id!==assetDir 的自定义声明数组：解析结果跟着 assetDir 走，不是原样返回 skinId", () => {
    const probeSkins = [
      { id: "probe", label: "探针", fonts: null, assetDir: "totally-different-dir", decorations: {} },
    ];
    expect(assetDirFor("probe", probeSkins)).toBe("totally-different-dir");
    expect(illustSrc(assetDirFor("probe", probeSkins), "mascot"))
      .toMatch(/illustrations\/totally-different-dir\/mascot\.webp$/);
  });
  it("未注册的 skinId 兜底返回 skinId 本身", () => {
    expect(assetDirFor("no-such-skin", [])).toBe("no-such-skin");
  });
});

describe("字体子集产物（M46「字体管线有可执行证据」）", () => {
  const dir = join(ROOT, "src", "skins", "fonts", "ink");
  it.each(["title.woff2", "body.woff2"])("%s 存在且 ≤1MB", name => {
    const p = join(dir, name);
    expect(existsSync(p), `缺 ${name}，先跑 python3 tools/build_fonts.py`).toBe(true);
    expect(statSync(p).size).toBeLessThanOrEqual(1024 * 1024);
  });
});

describe("registry fonts 字段与 ink.css @font-face 的 drift-pin", () => {
  it("SKINS 里 ink.fonts 声明的 family 名与 ink.css 实际 @font-face 一致", () => {
    const css = readFileSync(join(ROOT, "src", "skins", "ink.css"), "utf8");
    const ink = SKINS.find(s => s.id === "ink")!;
    expect(ink.fonts).not.toBeNull();
    expect(css).toMatch(new RegExp(`font-family:\\s*"${ink.fonts!.title}"`));
    expect(css).toMatch(new RegExp(`font-family:\\s*"${ink.fonts!.body}"`));
    // --round/--sans 必须真的解析到这两个 family（否则声明的 fonts 字段只是摆设、没人读）
    expect(css).toMatch(new RegExp(`--round:\\s*"${ink.fonts!.title}"`));
    expect(css).toMatch(new RegExp(`--sans:\\s*"${ink.fonts!.body}"`));
  });
});

describe("applySkinVisuals（assetDir + decorations 真实消费）", () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = "";
    document.body.innerHTML = `
      <img class="illust" data-illust="mascot">
      <img class="illust" data-illust="decor-willow" data-deco="willow">
    `;
  });

  it("静态槽位（无 data-deco）：src 按当前皮肤 assetDir 写入，不受 decorations 影响", () => {
    applySkinVisuals("ink");
    const mascot = document.querySelector<HTMLImageElement>('[data-illust="mascot"]')!;
    expect(mascot.src).toMatch(/illustrations\/ink\/mascot\.webp$/);
    expect(mascot.hidden).toBe(false);
  });

  it("带 data-deco 的槽位：decorations[key]!==true 时整个隐藏且不写 src（不发请求）", () => {
    applySkinVisuals("cream"); // cream.decorations = {}，willow 不在其中
    const willow = document.querySelector<HTMLImageElement>('[data-illust="decor-willow"]')!;
    expect(willow.hidden).toBe(true);
    expect(willow.hasAttribute("src")).toBe(false);
  });

  it("同一槽位切换皮肤：decorations[key]===true 时显示且写入该皮肤的 src", () => {
    applySkinVisuals("ink"); // ink.decorations.willow === true
    const willow = document.querySelector<HTMLImageElement>('[data-illust="decor-willow"]')!;
    expect(willow.hidden).toBe(false);
    expect(willow.src).toMatch(/illustrations\/ink\/decor-willow\.webp$/);
  });
});

describe("currentSkinId", () => {
  it("读 <html data-theme>，缺失时回退 DEFAULT_SKIN", () => {
    document.documentElement.dataset.theme = "ink";
    expect(currentSkinId()).toBe("ink");
    delete document.documentElement.dataset.theme;
    expect(currentSkinId()).toBe("cream");
  });
});

describe("wireIllustFallbacks（三级缺图回退，F 类回归钉子）", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    wireIllustFallbacks();
  });

  it("data-fallback-src 存在 → 第一次 error 只换 src，不做别的", () => {
    document.body.innerHTML = `<div data-illust-frame><img class="illust" data-fallback-src="/b.webp" data-fallback="hide" src="/a.webp"></div>`;
    const img = document.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    expect(img.src).toMatch(/\/b\.webp$/);
    expect(document.querySelector("[data-illust-frame]")).not.toBeNull();
  });

  it("M58：data-fallback-frame-toggle 存在时，换 src 的同时摘掉 frame 上的该 class（详情头图个图→题头图换源须同步换帧比）", () => {
    document.body.innerHTML = `<div class="dt-banner photo" data-illust-frame><img class="illust" data-fallback-src="/region.webp" data-fallback="hide" data-fallback-frame-toggle="photo" src="/dest.webp"></div>`;
    const img = document.querySelector("img")!;
    const frame = document.querySelector<HTMLElement>("[data-illust-frame]")!;
    expect(frame.classList.contains("photo")).toBe(true);
    img.dispatchEvent(new Event("error"));
    expect(img.src).toMatch(/\/region\.webp$/);
    expect(frame.classList.contains("photo")).toBe(false); // 换源成功，帧比同步摘掉 3:2 修饰类回落 2:1
  });

  it("M58：没有 data-fallback-frame-toggle 时换 src 不动 frame 的 class（不误伤没声明这个约定的其他调用点）", () => {
    document.body.innerHTML = `<div class="dt-banner photo" data-illust-frame><img class="illust" data-fallback-src="/b.webp" data-fallback="hide" src="/a.webp"></div>`;
    const img = document.querySelector("img")!;
    const frame = document.querySelector<HTMLElement>("[data-illust-frame]")!;
    img.dispatchEvent(new Event("error"));
    expect(frame.classList.contains("photo")).toBe(true); // 未声明 toggle，class 原样保留
  });

  it("fallback-src 也失败（第二次 error）→ 落到 data-fallback：hide 最近的 frame 容器（F59：隐藏不删除，节点与 data-illust 元数据留在 DOM 里，供皮肤切回来时恢复）", () => {
    document.body.innerHTML = `<div data-illust-frame><img class="illust" data-fallback-src="/b.webp" data-fallback="hide" src="/a.webp"></div>`;
    const img = document.querySelector("img")!;
    img.dispatchEvent(new Event("error")); // 第一次：换到 /b.webp
    img.dispatchEvent(new Event("error")); // 第二次：fallback-src 已试过，落到 hide
    const frame = document.querySelector<HTMLElement>("[data-illust-frame]");
    expect(frame).not.toBeNull(); // 容器还在，只是隐藏——这是 F59 的核心断言
    expect(frame!.hidden).toBe(true);
    expect(img.hidden).toBe(true);
  });

  it("没有 fallback-src、data-fallback 是 emoji → img 隐藏、同级插入等大 span 顶视觉，原样保留文案（F59：img 不摘除）", () => {
    document.body.innerHTML = `<div class="big"><img class="illust" data-fallback="🏝️"></div>`;
    const img = document.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    expect(document.querySelector("img")).not.toBeNull(); // img 仍在 DOM，只是隐藏
    expect(img.hidden).toBe(true);
    const span = document.querySelector(".illust-fallback")!;
    expect(span.textContent).toBe("🏝️");
    expect(img.nextElementSibling).toBe(span); // 同级插入，不是替换
  });

  it("非 .illust 的 img 不受影响（委托只认 class）", () => {
    document.body.innerHTML = `<div data-illust-frame><img data-fallback="hide" src="/x.webp"></div>`;
    const img = document.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    expect(document.querySelector("[data-illust-frame]")).not.toBeNull();
    expect(document.querySelector("img")).not.toBeNull();
  });
});

describe("双皮肤来回切换不永久丢插画（F59 回归钉子：山水成功 → 奶油缺图回退 → 切回山水必须恢复）", () => {
  // markup 照抄 index.html 里 mascot/gacha/empty 三处真实结构：mascot/gacha 有 [data-illust-frame]
  // 外框，empty 是自框场景（无外框，回退直接隐藏 img 自身）。
  beforeEach(() => {
    document.body.innerHTML = `
      <span data-illust-frame><img class="illust" data-illust="mascot" data-fallback="hide"></span>
      <div data-illust-frame><img class="illust" data-illust="gacha" data-fallback="hide"></div>
      <img class="illust" data-illust="empty" data-fallback="🏝️">
    `;
    wireIllustFallbacks();
  });

  it("mascot/gacha/empty 三槽位：山水加载成功 → 切奶油 404 触发回退 → 切回山水后 src/可见性/回退残留全部恢复", () => {
    // ① 山水下应用一轮：三张图都拿到 ink 的 src 且可见
    applySkinVisuals("ink");
    const mascot = document.querySelector<HTMLImageElement>('[data-illust="mascot"]')!;
    const gacha = document.querySelector<HTMLImageElement>('[data-illust="gacha"]')!;
    const empty = document.querySelector<HTMLImageElement>('[data-illust="empty"]')!;
    expect(mascot.src).toMatch(/illustrations\/ink\/mascot\.webp$/);
    expect(gacha.src).toMatch(/illustrations\/ink\/gacha\.webp$/);
    expect(empty.src).toMatch(/illustrations\/ink\/empty\.webp$/);
    expect(mascot.hidden).toBe(false);
    expect(gacha.hidden).toBe(false);
    expect(empty.hidden).toBe(false);

    // ② 切奶油：assetDir 变成 cream，三张图请求 404（真实生产行为——cream 目前没有这三个槽位的
    // 资产），此处手动 dispatch error 模拟浏览器的加载失败通知
    applySkinVisuals("cream");
    [mascot, gacha, empty].forEach(img => img.dispatchEvent(new Event("error")));
    const mascotFrame = mascot.closest<HTMLElement>("[data-illust-frame]")!;
    const gachaFrame = gacha.closest<HTMLElement>("[data-illust-frame]")!;
    expect(mascotFrame.hidden).toBe(true);
    expect(gachaFrame.hidden).toBe(true);
    expect(mascot.hidden).toBe(true);
    expect(gacha.hidden).toBe(true);
    expect(empty.hidden).toBe(true); // 自框场景：没有外框，img 自己隐藏
    const emptyFallback = document.querySelector(".illust-fallback")!;
    expect(emptyFallback.textContent).toBe("🏝️");
    // 三个节点必须还在 DOM 里、data-illust 元数据没丢——这才是 F59 要钉的东西
    expect(document.querySelectorAll("[data-illust]").length).toBe(3);

    // ③ 切回山水：这次资产真实存在，必须完全恢复——可见、src 对、回退残留清干净
    applySkinVisuals("ink");
    expect(mascot.hidden).toBe(false);
    expect(gacha.hidden).toBe(false);
    expect(empty.hidden).toBe(false);
    expect(mascotFrame.hidden).toBe(false);
    expect(gachaFrame.hidden).toBe(false);
    expect(mascot.src).toMatch(/illustrations\/ink\/mascot\.webp$/);
    expect(gacha.src).toMatch(/illustrations\/ink\/gacha\.webp$/);
    expect(empty.src).toMatch(/illustrations\/ink\/empty\.webp$/);
    expect(mascot.dataset.fallbackTried).toBeUndefined();
    expect(document.querySelector(".illust-fallback")).toBeNull(); // 遗留的 emoji 兜底已清理
  });
});
