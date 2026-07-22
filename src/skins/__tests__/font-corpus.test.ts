// M69 字体语料 drift-pin：woff2 是二进制黑盒，`*.corpus.txt`（tools/build_fonts.py 落盘）是它唯一
// 可断言的影子。UI 源文件（index.html + src/**/*.{ts,css}）或数据 chunk 新增了汉字、却没重跑
// build_fonts 重出子集时，本测试红灯——否则新字上屏回退系统字体（实证：M63 新增「清空蛋堆」后
// 「堆」字缺席马善政/文楷两档子集）。语料口径与 build_fonts.py 一致：标题=(UI ∪ name/province)
// - 易混字清单，正文=UI ∪ data 全量文本 ∪ 易混字清单；ASCII 恒在子集内，只核对非 ASCII 字符。
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const FONT_DIR = join(ROOT, "src", "skins", "fonts", "ink");

const nonAscii = (s: string) => new Set([...s].filter(ch => ch.codePointAt(0)! > 0x7e));

function loadCorpus(name: string): Set<string> {
  return nonAscii(readFileSync(join(FONT_DIR, name), "utf8"));
}

function uiChars(): Set<string> {
  const chars = new Set<string>();
  const add = (p: string) => { for (const ch of nonAscii(readFileSync(p, "utf8"))) chars.add(ch); };
  add(join(ROOT, "index.html"));
  for (const e of readdirSync(join(ROOT, "src"), { recursive: true, withFileTypes: true })) {
    if (e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".css"))) add(join(e.parentPath, e.name));
  }
  return chars;
}

function dataChars(): { names: Set<string>; full: Set<string> } {
  const dir = join(ROOT, "public", "data");
  const manifest: string[] = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const names = new Set<string>(), full = new Set<string>();
  const walk = (x: unknown) => {
    if (typeof x === "string") for (const ch of nonAscii(x)) full.add(ch);
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") Object.values(x).forEach(walk);
  };
  for (const f of manifest) {
    const chunk = JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, unknown>[];
    walk(chunk);
    for (const d of chunk) for (const ch of nonAscii(`${d.name ?? ""}${d.province ?? ""}`)) names.add(ch);
  }
  return { names, full };
}

const missing = (need: Set<string>, corpus: Set<string>) => [...need].filter(ch => !corpus.has(ch));

describe("字体子集语料覆盖（改完文案/数据要重跑 python3 tools/build_fonts.py）", () => {
  const title = loadCorpus("title.corpus.txt");
  const body = loadCorpus("body.corpus.txt");
  const titleFallback = loadCorpus("title-fallback.txt");
  const ui = uiChars();
  const { names, full } = dataChars();

  it("标题字体（--round）：UI 文案 + 城市名/省份除易混字外全在语料内", () => {
    const expected = new Set([...ui, ...names].filter(ch => !titleFallback.has(ch)));
    expect(missing(expected, title)).toEqual([]);
  });

  it("正文字体（--sans）：UI 文案 + data 全量文本 全在语料内", () => {
    expect(missing(ui, body)).toEqual([]);
    expect(missing(full, body)).toEqual([]);
  });

  it("标题易混字不进毛笔子集，改由 Ink Body 稳定回退", () => {
    expect([...titleFallback].filter(ch => title.has(ch))).toEqual([]);
    expect(missing(titleFallback, body)).toEqual([]);
    const css = readFileSync(join(ROOT, "src", "skins", "ink.css"), "utf8");
    expect(css).toMatch(/--round:\s*"Ink Title",\s*"Ink Body"/);
  });
});
