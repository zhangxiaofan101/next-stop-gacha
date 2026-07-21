import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// F68：tools/build.py 校验 norail/slowrail 互斥（注释早已写明该不变式，但从未落地校验，运行时
// legInfo() 的 norail 分支在前会静默吞掉 slowrail）。此前只手工冒烟验证过修复，未留自动化回归——
// review 明确指出这个缺口。这里复用真实 data/ 目录（已知合法）复制到隔离临时目录，注入冲突记录后
// 跑真实 python3 build.py，不碰仓库真实 data/public 产物；DATA_DIR/PUBLIC_DATA_DIR 覆盖同
// tools/build_illustrations.py 的 BUILD_ILLUST_* 环境变量先例。

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCRIPT = join(ROOT, "tools", "build.py");
const REAL_DATA_DIR = join(ROOT, "data");

function withTmpDataCopy(fn) {
  const tmp = mkdtempSync(join(tmpdir(), "build-py-guards-"));
  const dataDir = join(tmp, "data");
  const publicDataDir = join(tmp, "public-data");
  cpSync(REAL_DATA_DIR, dataDir, { recursive: true });
  try {
    fn(dataDir, publicDataDir);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function runBuildPy(dataDir, publicDataDir) {
  try {
    execFileSync("python3", [SCRIPT], {
      env: { ...process.env, BUILD_DATA_DIR: dataDir, BUILD_PUBLIC_DATA_DIR: publicDataDir },
      stdio: "pipe",
    });
    return { code: 0, stderr: "" };
  } catch (e) {
    return { code: e.status ?? 1, stderr: e.stderr?.toString() ?? "" };
  }
}

test("隔离目录下真实数据副本零改动仍零违规通过（钉住当前 282 城+53 线零 norail/slowrail 冲突）", () => {
  withTmpDataCopy((dataDir, publicDataDir) => {
    const result = runBuildPy(dataDir, publicDataDir);
    assert.equal(result.code, 0, `真实数据副本必须零退出通过，stderr: ${result.stderr}`);
  });
});

test("F68 回归：norail 与 slowrail 同时为 true 必须非零退出并定位到该城", () => {
  withTmpDataCopy((dataDir, publicDataDir) => {
    // ejina-huyanglin（data-d.json）真实数据已标 slowrail:true，注入 norail:true 制造冲突
    const path = join(dataDir, "data-d.json");
    const rows = JSON.parse(readFileSync(path, "utf8"));
    const target = rows.find(d => d.id === "ejina-huyanglin");
    assert.ok(target, "fixture 城市 ejina-huyanglin 应存在于 data-d.json（如 id 变化需同步改测试）");
    assert.equal(target.slowrail, true, "fixture 前置条件：该城应已标 slowrail:true");
    target.norail = true;
    writeFileSync(path, JSON.stringify(rows, null, 2));

    const result = runBuildPy(dataDir, publicDataDir);
    assert.notEqual(result.code, 0, "norail 与 slowrail 同真必须非零退出");
    assert.match(result.stderr, /norail 与 slowrail 不能同时为 true/);
    assert.match(result.stderr, /ejina-huyanglin/);
  });
});

test("合法单标（仅 norail 或仅 slowrail）不受影响，仍零违规通过", () => {
  withTmpDataCopy((dataDir, publicDataDir) => {
    // 挑一个此前均未标注的普通城市，单独打 norail:true，不触碰任何既有 slowrail 记录
    const path = join(dataDir, "data-a.json");
    const rows = JSON.parse(readFileSync(path, "utf8"));
    const target = rows.find(d => !d.noair && !d.norail && !d.slowrail && !("stops" in d));
    assert.ok(target, "fixture 应能找到一个三个守卫字段均未标注的城市卡");
    target.norail = true;
    writeFileSync(path, JSON.stringify(rows, null, 2));

    const result = runBuildPy(dataDir, publicDataDir);
    assert.equal(result.code, 0, `单独标 norail 不应触发互斥校验，stderr: ${result.stderr}`);
  });
});

// ================= M22 per-origin 视角文件闸门 =================
// data/origin-<id>.json 必须全量覆盖全部记录 id、difficulty 同基座枚举、条目恰含两字段；
// 通过后发布 origin-<id>-<hash>.json + origins.json 索引。fixture 从临时副本的真实数据
// 现算全量 id 集合，避免写死 335 这类会随扩容漂移的常量。

import { readdirSync } from "node:fs";

function allIds(dataDir) {
  const ids = [];
  for (const f of readdirSync(dataDir)) {
    if (!/^data-[a-f]\.json$/.test(f) && f !== "routes.json") continue;
    for (const d of JSON.parse(readFileSync(join(dataDir, f), "utf8"))) ids.push(d.id);
  }
  return ids;
}

function fullView(dataDir) {
  const view = {};
  for (const id of allIds(dataDir)) view[id] = { transit: "高铁约2h", difficulty: "直达" };
  return view;
}

test("M22：全量覆盖的视角文件通过并发布 hash chunk + origins.json 索引", () => {
  withTmpDataCopy((dataDir, publicDataDir) => {
    const view = fullView(dataDir);
    writeFileSync(join(dataDir, "origin-beijing.json"), JSON.stringify(view));
    const result = runBuildPy(dataDir, publicDataDir);
    assert.equal(result.code, 0, `全量视角文件应通过，stderr: ${result.stderr}`);
    const index = JSON.parse(readFileSync(join(publicDataDir, "origins.json"), "utf8"));
    assert.match(index.beijing, /^origin-beijing-[0-9a-f]{10}\.json$/);
    const published = JSON.parse(readFileSync(join(publicDataDir, index.beijing), "utf8"));
    assert.deepEqual(published, view, "发布产物应与源视角文件内容一致");
  });
});

test("M22：无视角文件时 origins.json 为空对象（基座-only 形态）", () => {
  withTmpDataCopy((dataDir, publicDataDir) => {
    const result = runBuildPy(dataDir, publicDataDir);
    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(publicDataDir, "origins.json"), "utf8")), {});
  });
});

test("M22：覆盖缺一条必须非零退出并报缺失数", () => {
  withTmpDataCopy((dataDir, publicDataDir) => {
    const view = fullView(dataDir);
    delete view[Object.keys(view)[0]];
    writeFileSync(join(dataDir, "origin-beijing.json"), JSON.stringify(view));
    const result = runBuildPy(dataDir, publicDataDir);
    assert.notEqual(result.code, 0, "覆盖不全必须拦截");
    assert.match(result.stderr, /覆盖不全，缺 1 条/);
  });
});

test("M22：未知 id / 非法 difficulty / 多余字段 各自拦截", () => {
  withTmpDataCopy((dataDir, publicDataDir) => {
    const view = fullView(dataDir);
    view["no-such-city"] = { transit: "x", difficulty: "直达" };
    const someId = allIds(dataDir)[0];
    view[someId] = { transit: "高铁约2h", difficulty: "很难" };
    const otherId = allIds(dataDir)[1];
    view[otherId] = { transit: "高铁约2h", difficulty: "直达", extra: 1 };
    writeFileSync(join(dataDir, "origin-beijing.json"), JSON.stringify(view));
    const result = runBuildPy(dataDir, publicDataDir);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /引用不存在的 id/);
    assert.match(result.stderr, /difficulty 非法: 很难/);
    assert.match(result.stderr, /恰含 transit\+difficulty/);
  });
});
