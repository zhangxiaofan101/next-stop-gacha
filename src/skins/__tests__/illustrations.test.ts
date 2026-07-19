// @vitest-environment happy-dom
// M46：插画接入契约验真——assetDir/decorations 真实驱动渲染，字体子集产物有可执行证据，
// 三级缺图回退（fallback-src → emoji → 移除容器）真的按顺序退化，而不是摆设声明。
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  applySkinVisuals, currentSkinId, destPhotoSrc, illustSrc, regionSlot, wireIllustFallbacks,
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

  it("fallback-src 也失败（第二次 error）→ 落到 data-fallback：hide 移除最近的 frame 容器", () => {
    document.body.innerHTML = `<div data-illust-frame><img class="illust" data-fallback-src="/b.webp" data-fallback="hide" src="/a.webp"></div>`;
    const img = document.querySelector("img")!;
    img.dispatchEvent(new Event("error")); // 第一次：换到 /b.webp
    img.dispatchEvent(new Event("error")); // 第二次：fallback-src 已试过，落到 hide
    expect(document.querySelector("[data-illust-frame]")).toBeNull();
  });

  it("没有 fallback-src、data-fallback 是 emoji → 就地换成等大 span，原样保留文案", () => {
    document.body.innerHTML = `<div class="big"><img class="illust" data-fallback="🏝️"></div>`;
    const img = document.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    expect(document.querySelector("img")).toBeNull();
    const span = document.querySelector(".illust-fallback")!;
    expect(span.textContent).toBe("🏝️");
  });

  it("非 .illust 的 img 不受影响（委托只认 class）", () => {
    document.body.innerHTML = `<div data-illust-frame><img data-fallback="hide" src="/x.webp"></div>`;
    const img = document.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    expect(document.querySelector("[data-illust-frame]")).not.toBeNull();
    expect(document.querySelector("img")).not.toBeNull();
  });
});
