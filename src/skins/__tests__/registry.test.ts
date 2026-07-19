// M45：皮肤注册表 + 防闪烁内联脚本的漂移钉子（两处刻意重复的字面量必须保持同步）。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGION_COLOR } from "../../logic/constants";
import { DEFAULT_SKIN, resolveSkinId, RANDOM_CHOICE, SKIN_IDS } from "../registry";

const ROOT = process.cwd();

describe("SKIN_IDS", () => {
  it("唯一且包含默认皮肤", () => {
    expect(new Set(SKIN_IDS).size).toBe(SKIN_IDS.length);
    expect(SKIN_IDS).toContain(DEFAULT_SKIN);
  });
});

describe("index.html 防闪烁内联脚本与 registry 同步（漂移钉子）", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  it("内联脚本里的皮肤数组/默认值字面量与 SKIN_IDS/DEFAULT_SKIN 一致", () => {
    const arrMatch = html.match(/var S=(\[[^\]]*\])/);
    const defMatch = html.match(/D="([^"]*)"/);
    expect(arrMatch, "index.html 缺少防闪烁内联脚本里的 var S=[...] ").not.toBeNull();
    expect(defMatch, "index.html 缺少防闪烁内联脚本里的 D=\"...\"").not.toBeNull();
    expect(JSON.parse(arrMatch![1])).toEqual(SKIN_IDS);
    expect(defMatch![1]).toBe(DEFAULT_SKIN);
  });
});

describe("cream.css 覆盖 REGION_COLOR 引用到的全部 region token", () => {
  const css = readFileSync(join(ROOT, "src/skins/cream.css"), "utf8");
  it("REGION_COLOR 每个值引用的 --region-<slug> 均在 cream.css 定义，--region-fallback 也定义", () => {
    const refs = Object.values(REGION_COLOR).map(v => {
      const m = v.match(/var\((--region-[\w-]+)\)/);
      expect(m, `REGION_COLOR 值 "${v}" 不是 var(--region-*) 形式`).not.toBeNull();
      return m![1];
    });
    expect(refs.length).toBe(Object.keys(REGION_COLOR).length);
    refs.forEach(name => {
      expect(css, `cream.css 缺少 ${name} 的定义`).toMatch(new RegExp(`${name}\\s*:`));
    });
    expect(css).toMatch(/--region-fallback\s*:/);
  });
});

describe("resolveSkinId", () => {
  it("已知 id 原样通过", () => {
    expect(resolveSkinId(DEFAULT_SKIN)).toBe(DEFAULT_SKIN);
  });
  it("未知 id 回退默认皮肤", () => {
    expect(resolveSkinId("no-such-skin")).toBe(DEFAULT_SKIN);
  });
  it("random 落在 SKIN_IDS 内", () => {
    expect(SKIN_IDS).toContain(resolveSkinId(RANDOM_CHOICE));
  });
});
