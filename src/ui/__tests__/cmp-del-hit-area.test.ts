// F77：M69 新增的对比表删除按钮 `.cmp-del` 只有 20×20px 视觉，且此前没有 ::after 外扩热区
// （同家族的 .icon-btn/.g-pile 已有此惯例）——手机横向滚动的对比表场景下不到通用 44px 触达
// 建议的一半。视觉圆钮维持 20px，热区靠 ::after 外扩，算法见 style.css `.cmp-del::after` 注释：
// `inset: calc(-Npx - var(--bw-thin))` 的边框项在 padding-box 基准下被减法抵消，外扩量恒等于 N，
// 与皮肤边框宽度（cream 1.5px / ink 1px）无关——不需要每皮肤分别验证。
//
// 之所以不像 F59 的 `.illust[hidden]` 守卫那样加载真实 CSS 跑 `getComputedStyle` 断言：探测过
// happy-dom 的 `getComputedStyle(el, "::after")` 不支持伪元素专属计算样式，会退化成返回宿主
// 元素自身的值（读到的是 .cmp-del 本体的 top/right/width，不是 ::after 的 inset）。改为对
// src/style.css 源码文本做结构化解析，直接断言这份代数关系，任何后续改动漏改都会让这里失败。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/style.css"), "utf8");
const boxRule = css.match(/\.cmp-del\s*\{([^}]*)\}/)?.[1] ?? "";
const afterRule = css.match(/\.cmp-del::after\s*\{([^}]*)\}/)?.[1] ?? "";

describe("F77：.cmp-del 触达热区 ≥44px（::after 外扩，视觉尺寸不变）", () => {
  it("视觉圆钮维持 20×20px", () => {
    expect(boxRule).toMatch(/width:\s*20px/);
    expect(boxRule).toMatch(/height:\s*20px/);
  });

  it("::after 外扩热区达到 ≥44px（算法与皮肤边框宽度无关）", () => {
    expect(afterRule).toMatch(/position:\s*absolute/);
    const boxSize = Number(boxRule.match(/width:\s*(\d+(?:\.\d+)?)px/)?.[1]);
    const n = Number(afterRule.match(/inset:\s*calc\(-(\d+(?:\.\d+)?)px\s*-\s*var\(--bw-thin\)\)/)?.[1]);
    expect(boxSize).toBeGreaterThan(0);
    expect(n).toBeGreaterThan(0);
    expect(boxSize + 2 * n).toBeGreaterThanOrEqual(44);
  });
});
