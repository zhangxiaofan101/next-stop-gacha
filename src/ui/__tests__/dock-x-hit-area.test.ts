// M86：dock 清空 ✕ 视觉尺寸 22px→26px，热区靠 ::after 外扩到 ≥44px（同 F77 .cmp-del 先例）。
// 同款理由：happy-dom 的 getComputedStyle 不支持伪元素专属计算样式，改为对 style.css 源码文本
// 做结构化解析，直接断言这份代数关系。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/style.css"), "utf8");
const boxRule = css.match(/\.dock-x\s*\{([^}]*)\}/)?.[1] ?? "";
const afterRule = css.match(/\.dock-x::after\s*\{([^}]*)\}/)?.[1] ?? "";

describe("M86：.dock-x 触达热区 ≥44px（::after 外扩，视觉尺寸升到 26px）", () => {
  it("视觉圆钮 26×26px", () => {
    expect(boxRule).toMatch(/width:\s*26px/);
    expect(boxRule).toMatch(/height:\s*26px/);
  });

  it("position: relative（::after 的定位基准）", () => {
    expect(boxRule).toMatch(/position:\s*relative/);
  });

  it("::after 外扩热区达到 ≥44px（算法与皮肤边框宽度无关，见 .cmp-del 同款注释）", () => {
    expect(afterRule).toMatch(/position:\s*absolute/);
    const boxSize = Number(boxRule.match(/width:\s*(\d+(?:\.\d+)?)px/)?.[1]);
    const n = Number(afterRule.match(/inset:\s*calc\(-(\d+(?:\.\d+)?)px\s*-\s*var\(--bw-thin\)\)/)?.[1]);
    expect(boxSize).toBeGreaterThan(0);
    expect(n).toBeGreaterThan(0);
    expect(boxSize + 2 * n).toBeGreaterThanOrEqual(44);
  });
});
