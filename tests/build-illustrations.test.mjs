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

test("比例不符的母版被拒绝，不做拉伸变形", () => {
  withTmpDirs((probeDir, pickedRoot, out) => {
    // ink-region-jzh.webp 是真实 1024x512（2:1）母版，冒充期望 1:1 的 mascot 槽位——远超 2% 容差
    copyFileSync(join(REAL_INK_PICKED, "ink-region-jzh.webp"), join(probeDir, "probe-mascot.webp"));
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
