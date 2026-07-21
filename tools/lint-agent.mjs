#!/usr/bin/env bun
// .agent 协议 linter（M65）——agent-project-workflow skill「Mechanical enforcement」节的机械可断言子集。
// 能写成 assert 的约定不靠自觉：verify 链首位运行（最便宜、fail-fast），规则升级须与 skill 同步（协议
// 是 cc/codex 共享物，两侧同规）。只 lint 实现者所有的文件（design/state）+ 编外文件申报；goal.md
// （用户所有）与 review.md（评审者所有）不 lint。
//
// 规则：
//   design.md  ① 无状态 emoji（✅🔜⏭🟡❌🪦——状态词汇表属 state 独有；🌫️ 是 tag 语法，允许）
//              ② 无时代标记日期（ISO 日期 20xx-xx-xx；真正的数据语义日期在行内挂
//                 <!-- agent-lint: allow-date --> 例外声明）
//              ③ 无 review 发现编号（F\d{2,3}——出处属 git blame/review.md，不属现在时设计）
//   state.md   ④ 每个条目以署名结尾（[cc]/[codex]，可叠写）——缩进行是上一条目的续行，署名落在
//                 条目末行即可；标题/引用/表格/分隔线/🪦 墓碑节/末尾 --- 之后的规则脚注除外
//   两者       ⑤ tag 语法严格为 [R1-3 · S1-3] 或 [R1-3 · S1-3 · 🌫️]（间隔符=空格·空格）
//   目录       ⑥ .agent/ 下四文件之外的每个 *.md 必须在 design.md 中被申报（文件名出现即可）
//
// 用法：bun tools/lint-agent.mjs [agentDir]   （agentDir 默认为仓库 .agent/，测试时可指向 fixture）

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const AGENT_DIR = process.argv[2] ?? join(fileURLToPath(new URL("..", import.meta.url)), ".agent");
const CORE = ["goal.md", "design.md", "state.md", "review.md"];
const STATUS_EMOJI = ["✅", "🔜", "⏭", "🟡", "❌", "🪦"];
const ISO_DATE = /\b20\d{2}-\d{2}-\d{2}\b/;
const FINDING_ID = /\bF\d{2,3}\b/;
const TAG_TOKEN = /\[R\d[^\]]*\]/g;
const TAG_EXACT = /^\[R[1-3] · S[1-3]( · 🌫️)?\]$/;
const BYLINE_END = /\[(cc|codex)\]$/;
const ALLOW_DATE = "agent-lint: allow-date";

const problems = [];
const flag = (file, line, rule, msg) => problems.push(`${file}:${line}  [${rule}] ${msg}`);
const lines = (name) => readFileSync(join(AGENT_DIR, name), "utf8").split("\n");

// ── design.md：无状态 emoji / 无时代标记日期 / 无 F 编号 ──
const design = lines("design.md");
design.forEach((text, i) => {
  const n = i + 1;
  for (const e of STATUS_EMOJI) {
    if (text.includes(e)) flag("design.md", n, "status-emoji", `状态 emoji「${e}」属 state.md 词汇表——design 是无状态的现在时`);
  }
  if (ISO_DATE.test(text) && !text.includes(ALLOW_DATE)) {
    flag("design.md", n, "era-date", `时代标记日期「${text.match(ISO_DATE)[0]}」——时间线属 state.md，出处属 git blame（数据语义日期加 <!-- ${ALLOW_DATE} -->）`);
  }
  if (FINDING_ID.test(text)) {
    flag("design.md", n, "finding-id", `review 发现编号「${text.match(FINDING_ID)[0]}」——处置完的发现出处属 git blame，不属现在时设计`);
  }
});

// ── state.md：条目署名（缩进行=续行，署名要求落在条目末行） ──
const state = lines("state.md");
let inTombstone = false;
let entry = null; // { startLine, lastText }
const flushEntry = () => {
  if (entry && !BYLINE_END.test(entry.lastText)) {
    flag("state.md", entry.startLine, "byline", "条目须以署名 [cc]/[codex] 结尾（state 的每条时间线都有作者）");
  }
  entry = null;
};
const lastHr = state.reduce((acc, t, i) => (t.trim() === "---" ? i : acc), -1);
state.forEach((raw, i) => {
  const n = i + 1;
  const text = raw.trim();
  if (raw.startsWith("#")) inTombstone = raw.includes("🪦");
  if (
    text === "" || raw.startsWith("#") || text.startsWith(">") || text.startsWith("|") ||
    text === "---" || text.startsWith("```") || inTombstone || (lastHr !== -1 && i > lastHr)
  ) {
    flushEntry();
    return;
  }
  if (/^\s/.test(raw) && entry) entry.lastText = text;
  else {
    flushEntry();
    entry = { startLine: n, lastText: text };
  }
});
flushEntry();

// ── design + state：tag 语法 ──
for (const name of ["design.md", "state.md"]) {
  lines(name).forEach((text, i) => {
    for (const m of text.match(TAG_TOKEN) ?? []) {
      if (!TAG_EXACT.test(m)) flag(name, i + 1, "tag-grammar", `tag「${m}」不合语法——须为 [R1-3 · S1-3] 或 [R1-3 · S1-3 · 🌫️]（间隔符=空格·空格）`);
    }
  });
}

// ── 编外文件申报：四文件之外的 *.md 须在 design.md 中被提及 ──
const designText = design.join("\n");
for (const f of readdirSync(AGENT_DIR).filter((f) => f.endsWith(".md") && !CORE.includes(f))) {
  if (!designText.includes(f)) flag(f, 1, "undeclared", `.agent/ 编外文件未在 design.md 申报（常驻领域文件须有一行说明管什么、谁所有）`);
}

if (problems.length) {
  console.error(`lint:agent — ${problems.length} 处协议违例：\n` + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log("lint:agent — .agent 协议检查通过");
