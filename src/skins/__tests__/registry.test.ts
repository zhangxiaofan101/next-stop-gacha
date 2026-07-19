// M45：皮肤注册表 + 防闪烁内联脚本的漂移钉子（两处刻意重复的字面量必须保持同步）。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGION_COLOR } from "../../logic/constants";
import { DEFAULT_SKIN, normalizeSkinChoice, resolveSkinId, RANDOM_CHOICE, SKINS, SKIN_IDS } from "../registry";

const ROOT = process.cwd();

describe("SKIN_IDS", () => {
  it("唯一且包含默认皮肤", () => {
    expect(new Set(SKIN_IDS).size).toBe(SKIN_IDS.length);
    expect(SKIN_IDS).toContain(DEFAULT_SKIN);
  });
});

describe("M46：山水皮肤声明契约（首次落地真实 fonts/assetDir/decorations，非空占位）", () => {
  it("ink 在册，assetDir 指向自己的资产目录，fonts 非空", () => {
    const ink = SKINS.find(s => s.id === "ink");
    expect(ink).toBeDefined();
    expect(ink!.assetDir).toBe("ink");
    expect(ink!.fonts).not.toBeNull();
  });
  it("默认皮肤本模块仍是 cream（默认给谁是用户终审拍板项，见 state.md）", () => {
    expect(DEFAULT_SKIN).toBe("cream");
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

describe("normalizeSkinChoice（F56：脏 localStorage 与高亮/生效一致性的共用回退）", () => {
  it("合法 id 与 random 原样通过", () => {
    expect(normalizeSkinChoice(DEFAULT_SKIN)).toBe(DEFAULT_SKIN);
    expect(normalizeSkinChoice(RANDOM_CHOICE)).toBe(RANDOM_CHOICE);
  });
  it("脏值/null（含 localStorage 不可用时 store 返回的 null）回退默认皮肤", () => {
    expect(normalizeSkinChoice("garbage-value")).toBe(DEFAULT_SKIN);
    expect(normalizeSkinChoice("")).toBe(DEFAULT_SKIN);
    expect(normalizeSkinChoice(null)).toBe(DEFAULT_SKIN);
  });
});

describe("storage key 漂移钉子（F56：首帧内联脚本与 store.ts 各写一份 key，必须同步）", () => {
  it("index.html 内联脚本读的 localStorage key 与 store.ts 的 SKIN_LS_KEY 一致", () => {
    const html = readFileSync(join(ROOT, "index.html"), "utf8");
    const store = readFileSync(join(ROOT, "src/store.ts"), "utf8");
    const htmlKey = html.match(/localStorage\.getItem\("([^"]+)"\)/);
    const storeKey = store.match(/SKIN_LS_KEY = "([^"]+)"/);
    expect(htmlKey).not.toBeNull();
    expect(storeKey).not.toBeNull();
    expect(htmlKey![1]).toBe(storeKey![1]);
  });
});
