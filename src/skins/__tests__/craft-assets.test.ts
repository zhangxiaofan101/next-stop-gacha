// @vitest-environment happy-dom
// M57：皮肤工艺件接入——加载真实 cream.css + ink.css + style.css（拼接而非 @import，同
// dest-filter.test.ts 先例），验证 applyCraftAssets 设的 CSS 自定义属性被各消费处真实用到，
// 且缺图/未声明时天然回退到 M52 时期的代码版（CSS 原生多层 background-image /
// border-image-source 回退，无需 JS 探测）。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { applyCraftAssets } from "../illustrations";

const ROOT = process.cwd();
function loadFullCss(): string {
  const cream = readFileSync(join(ROOT, "src/skins/cream.css"), "utf8");
  const ink = readFileSync(join(ROOT, "src/skins/ink.css"), "utf8");
  const main = readFileSync(join(ROOT, "src/style.css"), "utf8").replace(/@import[^;]+;\n?/g, "");
  return `${cream}\n${ink}\n${main}`;
}
function injectStyle() {
  const style = document.createElement("style");
  style.textContent = loadFullCss();
  document.head.appendChild(style);
}

describe("M57 applyCraftAssets", () => {
  it("把 texture/frame/divider/placeholder 四槽位算成 CSS 自定义属性，seal 不在内（走既有 [data-illust] 机制）", () => {
    applyCraftAssets("ink");
    const cs = getComputedStyle(document.documentElement);
    expect(cs.getPropertyValue("--craft-texture")).toContain("/illustrations/ink/texture.webp");
    expect(cs.getPropertyValue("--craft-frame")).toContain("/illustrations/ink/frame.webp");
    expect(cs.getPropertyValue("--craft-divider")).toContain("/illustrations/ink/divider.webp");
    expect(cs.getPropertyValue("--craft-placeholder")).toContain("/illustrations/ink/placeholder.webp");
    expect(cs.getPropertyValue("--craft-seal-nextstop")).toBe(""); // 确认没有多算一份用不到的属性
  });
});

describe("M57 容器边框（border-image 9-slice）", () => {
  beforeEach(() => {
    injectStyle();
    document.documentElement.setAttribute("data-theme", "ink");
    applyCraftAssets("ink");
  });

  it("console/paper/machine/share-sheet 四个大容器 border-image-source 引用 --craft-frame", () => {
    document.body.innerHTML = `
      <div class="console"></div><div class="paper"></div>
      <div class="machine"></div><div class="share-sheet"></div>`;
    ["console", "paper", "machine", "share-sheet"].forEach(cls => {
      const el = document.querySelector(`.${cls}`)!;
      expect(getComputedStyle(el).borderImageSource).toBe('url("/illustrations/ink/frame.webp")');
    });
  });

  it("缺图回退：--craft-frame 未设置时 border-color 仍是墨色（不是破图/空白，M52 前基线）", () => {
    document.body.innerHTML = `<div class="console"></div>`;
    document.documentElement.style.removeProperty("--craft-frame");
    const el = document.querySelector(".console")!;
    const cs = getComputedStyle(el);
    expect(cs.borderImageSource).toBe("none");
    expect(cs.borderColor).not.toBe("transparent"); // 不再是 M52 时期的 transparent（那是给伪元素让位用的）
  });
});

describe("M57 底材纹理（body::after 两层 background-image）", () => {
  it("真实纹理图源码字符串存在于 style.css，且排在 M52 程序噪点 data-URI 之前（图优先、失败时噪点透出）", () => {
    const css = readFileSync(join(ROOT, "src/style.css"), "utf8");
    const m = css.match(/\[data-theme="ink"\] body::after \{[^}]*background-image:\s*([^;]+);/);
    expect(m, "找不到 body::after 的 background-image 声明").not.toBeNull();
    const decl = m![1];
    const textureIdx = decl.indexOf("--craft-texture");
    const noiseIdx = decl.indexOf("feTurbulence");
    expect(textureIdx).toBeGreaterThanOrEqual(0);
    expect(noiseIdx).toBeGreaterThanOrEqual(0);
    expect(textureIdx).toBeLessThan(noiseIdx); // 真图层在前，程序噪点兜底层在后
  });
});

describe("M57 分隔线笔触（四处 --divider-* 消费点 + 图位垫底 c-photo/dt-banner）", () => {
  beforeEach(() => {
    injectStyle();
    document.documentElement.setAttribute("data-theme", "ink");
    applyCraftAssets("ink");
  });

  it("leg-line .dash / rb-sk-row（非末行）/ console-foot::before / rb-cover::after 均引用 --craft-divider", () => {
    document.body.innerHTML = `
      <div class="leg-line"><span class="dash"></span></div>
      <div class="rb-sk-row"></div><div class="rb-sk-row"></div>`; // 两个 row：只测非 last-child 那个
    const dash = document.querySelector(".dash")!;
    const row = document.querySelectorAll(".rb-sk-row")[0];
    expect(getComputedStyle(dash).backgroundImage).toContain("/illustrations/ink/divider.webp");
    expect(getComputedStyle(dash).backgroundImage).toContain("repeating-linear-gradient"); // 代码版兜底层仍在
    expect(getComputedStyle(row).backgroundImage).toContain("/illustrations/ink/divider.webp");
  });

  it("console-foot::before / rb-cover::after 的源码声明含 --craft-divider（伪元素，happy-dom 不支持计算样式，断言源码）", () => {
    const css = readFileSync(join(ROOT, "src/style.css"), "utf8");
    const m = css.match(/\[data-theme="ink"\] \.console-foot::before, \[data-theme="ink"\] \.rb-cover::after \{[^}]*background-image:\s*([^;]+);/);
    expect(m, "找不到 console-foot::before/rb-cover::after 的 background-image 声明").not.toBeNull();
    expect(m![1]).toContain("--craft-divider");
    expect(m![1]).toContain("repeating-linear-gradient"); // 代码版兜底层仍在
  });

  it("c-photo / dt-banner 图位垫底引用 --craft-placeholder，且 M52 远山剪影渐变仍在（缺图回退）", () => {
    document.body.innerHTML = `<div class="c-photo"></div><div class="dt-banner"></div>`;
    [".c-photo", ".dt-banner"].forEach(sel => {
      const bg = getComputedStyle(document.querySelector(sel)!).backgroundImage;
      expect(bg).toContain("/illustrations/ink/placeholder.webp");
      expect(bg).toContain("radial-gradient");
    });
  });
});

describe("M57 印章（img 叠 SVG 代码版之上，走既有 [data-illust] 机制）", () => {
  it("index.html 两枚印章均含 .ink-seal-svg（代码版）+ .illust[data-illust] 图片叠加，槽位名各自独立", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    const seals = [...html.matchAll(/<span class="ink-seal">[\s\S]*?<\/span>/g)];
    expect(seals.length).toBe(2);
    const slots = seals.map(m => m[0].match(/data-illust="([^"]+)"/)?.[1]);
    expect(slots.sort()).toEqual(["seal-nextstop", "seal-wheretoplay"]);
    seals.forEach(m => {
      expect(m[0]).toContain("ink-seal-svg"); // 代码版 SVG 仍在，未被删除
      expect(m[0]).toContain('class="illust ink-seal-img"');
      expect(m[0]).toContain('data-fallback="hide"');
      expect(m[0]).not.toContain("data-illust-frame"); // 刻意不标 frame——404 只隐藏 img 自己，SVG 天然透出
    });
  });

  it("CSS：.ink-seal-img 绝对定位铺满容器，叠在 .ink-seal-svg 之上（DOM 顺序决定层叠，同一层叠上下文）", () => {
    injectStyle();
    document.documentElement.setAttribute("data-theme", "ink");
    document.body.innerHTML = `<span class="ink-seal"><svg class="ink-seal-svg"></svg><img class="illust ink-seal-img"></span>`;
    const img = document.querySelector(".ink-seal-img")!;
    expect(getComputedStyle(img).position).toBe("absolute");
  });
});
