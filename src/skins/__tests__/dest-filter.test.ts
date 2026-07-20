// @vitest-environment happy-dom
// M51：共享集皮肤适配滤镜——回归钉住 CSS 联动本身，而不是只测 registry/常量。加载真实
// cream.css + ink.css + style.css（拼接而非 @import——happy-dom 对注入 <style> 里的相对路径
// @import 不做文件系统解析，测试环境没有真实 base URL，手动内联三个文件等价复现生产级联层叠）。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("M51 共享集皮肤适配滤镜", () => {
  it("奶油皮肤下卡片个图零滤镜（--dest-filter: none）", () => {
    injectStyle();
    document.documentElement.removeAttribute("data-theme");
    document.body.innerHTML = `<div class="c-photo"><img class="illust"></div>`;
    const img = document.querySelector(".illust")!;
    expect(getComputedStyle(img).filter).toBe("none");
  });

  it("山水皮肤下卡片个图应用轻降饱和+暖调滤镜", () => {
    injectStyle();
    document.documentElement.setAttribute("data-theme", "ink");
    document.body.innerHTML = `<div class="c-photo"><img class="illust"></div>`;
    const img = document.querySelector(".illust")!;
    expect(getComputedStyle(img).filter).not.toBe("none");
    expect(getComputedStyle(img).filter).toContain("saturate");
  });

  it("详情页 .photo 态（个图）在山水下同样吃滤镜；非 .photo 态（题头兜底/线路卡）不吃", () => {
    injectStyle();
    document.documentElement.setAttribute("data-theme", "ink");
    document.body.innerHTML = `
      <div class="dt-banner photo"><img class="illust" id="photo-img"></div>
      <div class="dt-banner"><img class="illust" id="region-img"></div>`;
    const photoImg = document.getElementById("photo-img")!;
    const regionImg = document.getElementById("region-img")!;
    // 用 toContain("saturate") 而非 not.toBe("none")：happy-dom 对「从未被任何规则命中」的
    // filter 属性算出空串 ""，"" !== "none" 恒真——not.toBe("none") 在规则完全没命中时也会
    // 意外通过，测不出真被吃了滤镜（revert 源码验证过这个坑：这条断言曾在滤镜规则被整个删掉
    // 时仍然通过）。
    expect(getComputedStyle(photoImg).filter).toContain("saturate");
    // 题头图没有任何规则命中 filter 属性——happy-dom 对「从未被任何规则触碰」的属性算出空串，
    // 真实浏览器算出初始值字面量 "none"；两者语义等价（都是「无滤镜」），故两个值都接受
    expect(["", "none"]).toContain(getComputedStyle(regionImg).filter);
  });

  it("cream.css / ink.css 都显式声明了 --dest-filter（漂移钉子闸门的具体样本，防止两处只改一边）", () => {
    const cream = readFileSync(join(ROOT, "src/skins/cream.css"), "utf8");
    const ink = readFileSync(join(ROOT, "src/skins/ink.css"), "utf8");
    expect(cream).toMatch(/--dest-filter\s*:\s*none\s*;/);
    expect(ink).toMatch(/--dest-filter\s*:\s*[^;]+;/);
    expect(ink).not.toMatch(/--dest-filter\s*:\s*none\s*;/); // ink 必须真的声明了非 none 的滤镜，不是抄错值
  });
});
