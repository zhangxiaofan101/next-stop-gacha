// F55：硬编码视觉值审计——皮肤 token 纪律的机械闸门。视图层（HTML/TS/style.css）里不允许
// 出现裸 hex 颜色或裸 rgba(数字) 三元组，可换肤颜色必须走 var(--*)；刻意例外进 allowlist
// 并写明理由。cream.css 是 token 本体所在，天然不在扫描范围。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

// 精确匹配 3/6/8 位 hex 且后随非字母数字（排除 #detailOverlay 这类 id 选择器/字符串）
const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z-])/g;
// 裸 rgba(数字 开头（token 化写法是 rgba(var(--x-rgb), .5)，不会命中）
const RGBA_RE = /rgba?\(\s*\d/g;

// 例外清单：文件 → 允许残留的模式与理由
const ALLOWLIST: Record<string, RegExp[]> = {
  // 彩带 token 读取失败时的兜底色（等于奶油原值，防止透明碎屑）——刻意保留
  "src/ui/effects.ts": [/#ff9c3f|#58b7f0|#7bc86c|#f79ec4|#ffd95c|#b39deb/],
  // QR 码必须黑白高对比才可扫，属功能性图形非皮肤维度——刻意保留
  "src/ui/share.ts": [/#fff|#000/],
  // 完全透明色没有色相可换肤——刻意保留
  "src/style.css": [/rgba\(0,\s*0,\s*0,\s*0\)/],
};

const FILES = [
  "index.html",
  "src/style.css",
  "src/main.ts",
  "src/store.ts",
  "src/cn-map.ts",
  "src/skins/registry.ts",
  ...["actions", "cards", "clipboard", "compare", "console", "detail", "dock", "dom",
    "effects", "events", "gacha", "mapview", "render", "roadbook", "share", "skin", "toast", "trip"]
    .map(f => `src/ui/${f}.ts`),
];

describe("视图层无硬编码视觉值（F55 审计闸门）", () => {
  FILES.forEach(rel => {
    it(rel, () => {
      const text = readFileSync(join(ROOT, rel), "utf8");
      const allowed = ALLOWLIST[rel] || [];
      const offenders: string[] = [];
      for (const re of [HEX_RE, RGBA_RE]) {
        for (const m of text.matchAll(re)) {
          const line = text.slice(0, m.index).split("\n").length;
          const lineText = text.split("\n")[line - 1];
          if (allowed.some(a => a.test(lineText))) continue;
          offenders.push(`L${line}: ${lineText.trim().slice(0, 80)}`);
        }
      }
      expect(offenders, `${rel} 存在未 token 化的视觉字面量（或补充 allowlist 并说明理由）:\n${offenders.join("\n")}`).toEqual([]);
    });
  });
});
