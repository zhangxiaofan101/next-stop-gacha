import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// F60：tools/build_illustrations.py 此前只打印比例/预算/命名/编码违规，从不非零退出——
// `bun run test:build-assets`/部署门禁形同虚设，畸形或超限产物能悄悄进 public/。这里用临时目录
// （脚本读 BUILD_ILLUST_PICKED_DIR/BUILD_ILLUST_OUT_DIR/BUILD_ILLUST_BUDGET_* 覆盖真实路径与预算，
// 见脚本顶部）跑真实 python3+cwebp+webpinfo 二进制，不碰 assets/picked 与 public/illustrations
// 真实资产；直接复用仓库里已有的 picked/ink 母版做输入，不额外造图，规避合成图片的不确定性。

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "tools", "build_illustrations.py");
const REAL_INK_PICKED = join(ROOT, "assets", "illustrations", "picked", "ink");
const REAL_DEST_PICKED = join(ROOT, "assets", "illustrations", "picked", "dest");

function runPipeline(pickedDir, outDir, extraEnv = {}) {
  try {
    execFileSync("python3", [SCRIPT], {
      env: { ...process.env, BUILD_ILLUST_PICKED_DIR: pickedDir, BUILD_ILLUST_OUT_DIR: outDir, ...extraEnv },
      stdio: "pipe",
    });
    return { code: 0, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stderr: e.stderr?.toString() ?? "" };
  }
}

// PICKED_DIR 是「各皮肤子目录的父目录」，脚本 main() 用 os.listdir(PICKED_DIR) 找皮肤名——传皮肤
// 子目录本身会被当成空的 PICKED_DIR（子目录里全是文件，没有子目录，扫不出任何皮肤），一言不发地
// 空跑退出 0，最先在这写错过一次，留意别重犯。
function withTmpDirs(fn) {
  const tmp = mkdtempSync(join(tmpdir(), "build-illust-"));
  const pickedRoot = join(tmp, "picked");
  const probeDir = join(pickedRoot, "probe"); // 皮肤子目录，脚本按此拼 "probe-<slot>.webp" 命名前缀
  const out = join(tmp, "out");
  mkdirSync(probeDir, { recursive: true });
  try {
    fn(probeDir, pickedRoot, out);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// M60：picked/dest/ 不是皮肤子目录，脚本用固定名 "dest" 特判（process_dest()），不经 classify()
// 的皮肤前缀规则——这里单独造一个 "dest" 子目录而非 "probe"。
function withTmpDestDir(fn) {
  const tmp = mkdtempSync(join(tmpdir(), "build-illust-dest-"));
  const pickedRoot = join(tmp, "picked");
  const destDir = join(pickedRoot, "dest");
  const out = join(tmp, "out");
  mkdirSync(destDir, { recursive: true });
  try {
    fn(destDir, pickedRoot, out);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test("比例不符的母版被拒绝，不做拉伸变形", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    // ink-decor-hill.webp 是真实 1024x512（2:1）母版，冒充期望 1:1 的 mascot 槽位——远超 2% 容差
    copyFileSync(join(REAL_INK_PICKED, "ink-decor-hill.webp"), join(probeDir, "probe-mascot.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.notEqual(result.code, 0, "比例不符必须非零退出，不能悄悄拉伸通过");
    assert.match(result.stderr, /比例/);
    assert.ok(
      !existsSync(join(out, "probe", "mascot.webp")),
      "比例不符时不应产出被拉伸变形的错误产物",
    );
  });
});

test("质量下限仍超预算时非零退出，且计入违规而非打印后静默通过", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    copyFileSync(join(REAL_INK_PICKED, "ink-mascot.webp"), join(probeDir, "probe-mascot.webp"));
    // 预算压到 1 字节，任何真实压缩产物在 q40 也不可能达标，确定性触发「质量下限仍超预算」分支
    const result = runPipeline(pickedRoot, out, { BUILD_ILLUST_BUDGET_DECOR: "1" });
    assert.notEqual(result.code, 0, "质量下限仍超预算必须非零退出");
    assert.match(result.stderr, /质量下限|超预算/);
    // 超预算是软失败：产物仍写出供人工核对，只是退出码要红
    assert.ok(existsSync(join(out, "probe", "mascot.webp")));
  });
});

test("比例与预算都合规的母版仍按 happy path 通过（校验不能矫枉过正）", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    copyFileSync(join(REAL_INK_PICKED, "ink-mascot.webp"), join(probeDir, "probe-mascot.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.equal(result.code, 0, "合规母版必须零退出通过");
    assert.ok(existsSync(join(out, "probe", "mascot.webp")));
  });
});

test("未知槽位命名不合规也计入违规、非零退出", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    copyFileSync(join(REAL_INK_PICKED, "ink-mascot.webp"), join(probeDir, "probe-not-a-real-slot.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.notEqual(result.code, 0, "未知槽位命名必须非零退出，不能只打印跳过");
    assert.match(result.stderr, /不属于已知类别/);
  });
});

// M57：五类工艺件槽位——真实使用仓库里已有的 picked/ink 母版（A8 批已终审转档，命名带描述性
// 后缀，如 ink-texture-paper.webp），复用同一个 REAL_INK_PICKED 目录，不额外造合成图片。
test("M57 工艺件槽位：texture/frame/divider/placeholder 描述性后缀归一化为裸槽位名", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    copyFileSync(join(REAL_INK_PICKED, "ink-texture-paper.webp"), join(probeDir, "probe-texture-paper.webp"));
    copyFileSync(join(REAL_INK_PICKED, "ink-frame-brush.webp"), join(probeDir, "probe-frame-brush.webp"));
    copyFileSync(join(REAL_INK_PICKED, "ink-divider-brush.webp"), join(probeDir, "probe-divider-brush.webp"));
    copyFileSync(join(REAL_INK_PICKED, "ink-placeholder-mist.webp"), join(probeDir, "probe-placeholder-mist.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.equal(result.code, 0, `合规母版必须零退出通过，stderr: ${result.stderr}`);
    // 输出文件名去掉了描述性后缀（-paper/-brush/-mist），归一化成裸槽位名
    assert.ok(existsSync(join(out, "probe", "texture.webp")), "texture.webp 应归一化产出（不带 -paper 后缀）");
    assert.ok(existsSync(join(out, "probe", "frame.webp")), "frame.webp 应归一化产出（不带 -brush 后缀）");
    assert.ok(existsSync(join(out, "probe", "divider.webp")), "divider.webp 应归一化产出（不带 -brush 后缀）");
    assert.ok(existsSync(join(out, "probe", "placeholder.webp")), "placeholder.webp 应归一化产出（不带 -mist 后缀）");
  });
});

test("M57 工艺件槽位：seal-<name> 保留完整多实例标识符（不归一化，两枚印章各自独立产出）", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    copyFileSync(join(REAL_INK_PICKED, "ink-seal-nextstop.webp"), join(probeDir, "probe-seal-nextstop.webp"));
    copyFileSync(join(REAL_INK_PICKED, "ink-seal-wheretoplay.webp"), join(probeDir, "probe-seal-wheretoplay.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.equal(result.code, 0, `合规母版必须零退出通过，stderr: ${result.stderr}`);
    assert.ok(existsSync(join(out, "probe", "seal-nextstop.webp")));
    assert.ok(existsSync(join(out, "probe", "seal-wheretoplay.webp")));
  });
});

// F62：texture/frame/divider/placeholder 描述性后缀归一化后，两个不同源文件可能撞成同一个
// 输出名——此前脚本会连续两次报告 "OK frame.webp"、只留下按文件名排序更晚的那个产物、退出码仍是
// 0，文件名排序变化即可悄悄改变上线素材。修复后第二个源文件必须计入违规、非零退出，且保留按
// 文件名排序排第一的那个产物不被覆盖。
test("F62 回归：单例工艺槽位归一化撞名必须非零退出，不能静默覆盖", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    copyFileSync(join(REAL_INK_PICKED, "ink-frame-brush.webp"), join(probeDir, "probe-frame-first.webp"));
    copyFileSync(join(REAL_INK_PICKED, "ink-frame-brush.webp"), join(probeDir, "probe-frame-second.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.notEqual(result.code, 0, "同一皮肤内撞名必须非零退出");
    assert.match(result.stderr, /撞名/);
    // 按文件名排序，"probe-frame-first" 先于 "probe-frame-second"：保留先出现的产物
    assert.ok(existsSync(join(out, "probe", "frame.webp")), "先出现的源文件仍应正常产出");
  });
});

// M60：九区题头晋升共享题头层——picked/dest/ 同时容纳 region-<slug>.webp（2:1 题头）与
// dest-<cityid>.webp（3:2 个图），复用仓库里真实资产（region-jzh.webp 是刚从 picked/ink/ 转档
// 过来的真实母版，dest-hangzhou.webp 是既有 M44 母版），不合成图片。
test("M60：picked/dest/ 内 region-<slug> 共享题头与 dest-<cityid> 目的地个图并存，各自按自己的比例校验互不误伤", () => {
  withTmpDestDir((destDir, pickedRoot, out) => {
    copyFileSync(join(REAL_DEST_PICKED, "region-jzh.webp"), join(destDir, "region-jzh.webp"));
    copyFileSync(join(REAL_DEST_PICKED, "dest-hangzhou.webp"), join(destDir, "dest-hangzhou.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.equal(result.code, 0, `两族母版都合规必须零退出通过，stderr: ${result.stderr}`);
    assert.ok(existsSync(join(out, "dest", "region-jzh.webp")), "region-jzh.webp 应保留 region- 前缀原样产出");
    assert.ok(existsSync(join(out, "dest", "hangzhou.webp")), "dest-hangzhou.webp 应剥掉 dest- 前缀产出为 hangzhou.webp");
  });
});

test("M60：region-<slug> 槽位一样受 2:1 比例硬闸——3:2 个图冒充题头必须被拒绝", () => {
  withTmpDestDir((destDir, pickedRoot, out) => {
    // dest-hangzhou.webp 真实比例 3:2（1536x1024），冒充期望 2:1 的题头槽位——远超 2% 容差
    copyFileSync(join(REAL_DEST_PICKED, "dest-hangzhou.webp"), join(destDir, "region-fake.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.notEqual(result.code, 0, "3:2 母版冒充 2:1 题头槽位必须非零退出");
    assert.match(result.stderr, /比例/);
    assert.ok(!existsSync(join(out, "dest", "region-fake.webp")), "比例不符不应产出被拉伸变形的错误产物");
  });
});

test("M60：皮肤目录（非 dest）内的 <skin>-region-<slug> 命名不再被识别为合法槽位（九区已退出皮肤素材维度）", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    copyFileSync(join(REAL_INK_PICKED, "ink-decor-hill.webp"), join(probeDir, "probe-region-test.webp"));
    const result = runPipeline(pickedRoot, out);
    assert.notEqual(result.code, 0, "皮肤目录内的 region- 前缀不应再被当成合法槽位识别");
    assert.match(result.stderr, /不属于已知类别/);
  });
});
