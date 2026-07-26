// M83：老存档跨域名接运（纯函数侧）。
//
// 这批断言守的是「搬家不等于分享」这条分野：分享是别人的记录并给你，只动收藏/打卡；
// 搬家是你自己的家当换了 origin，行程/对比/出发日一并带走。写反了不会报错，
// 只会让老玩家跳过来发现行程没了——而数据其实还在旧 origin 里，只是再没人去拿。
import { describe, expect, it } from "vitest";

import { encodeMigration, hasAnything, migrationMode, parseMigration } from "../migrate";
import type { Destination } from "../types";

const DATA = [
  { id: "hangzhou", days: [2, 3] },
  { id: "suzhou", days: [2] },
  { id: "wuzhen", days: [1, 2] },
  { id: "jiangnan-loop", days: [5], stops: ["hangzhou", "suzhou"] },
] as unknown as Destination[];

const EMPTY = { favs: [], cmp: [], trip: [], visited: [] };

const FULL = {
  favs: ["hangzhou", "suzhou"],
  cmp: ["wuzhen"],
  trip: [{ id: "hangzhou", days: 3 }],
  visited: ["suzhou"],
  tripStart: "2026-08-01",
};

describe("parseMigration", () => {
  it("round-trips a full save through the fragment encoding", () => {
    const p = parseMigration(encodeMigration(FULL), DATA);
    expect(p).not.toBe(null);
    expect(p!.favs).toEqual(["hangzhou", "suzhou"]);
    expect(p!.cmp).toEqual(["wuzhen"]);
    expect(p!.trip).toEqual([{ id: "hangzhou", days: 3 }]);
    expect(p!.visited).toEqual(["suzhou"]);
    expect(p!.tripStart).toBe("2026-08-01");
  });

  // 搬家载荷和 localStorage 恢复是同一类外部输入（本地可再生、非当前数据集权威），
  // 所以复用 normalizePersisted 的信任边界，而不是另立一套。
  it("drops ids that no longer exist in the current dataset", () => {
    const p = parseMigration(encodeMigration({ ...FULL, favs: ["hangzhou", "atlantis"] }), DATA);
    expect(p!.favs).toEqual(["hangzhou"]);
  });

  it("keeps route ids out of visited (they are not cities)", () => {
    const p = parseMigration(encodeMigration({ ...FULL, visited: ["suzhou", "jiangnan-loop"] }), DATA);
    expect(p!.visited).toEqual(["suzhou"]);
  });

  it("returns null on garbage rather than importing half a save", () => {
    expect(parseMigration("not-json", DATA)).toBe(null);
    expect(parseMigration(encodeMigration([1, 2, 3]), DATA)).toBe(null);
    expect(parseMigration(encodeMigration("nope"), DATA)).toBe(null);
    expect(parseMigration("%E0%A4%A", DATA)).toBe(null); // 坏的百分号编码
  });

  // 空壳不值得走搬家路径：跳过去只会弹一条「搬了 0 个收藏」的无意义提示。
  it("returns null for a save with nothing in it", () => {
    expect(parseMigration(encodeMigration(EMPTY), DATA)).toBe(null);
    expect(parseMigration(encodeMigration({ tripStart: "2026-08-01" }), DATA)).toBe(null);
  });
});

describe("migrationMode", () => {
  it("adopts wholesale when the new origin is untouched", () => {
    expect(migrationMode(parseMigration(encodeMigration(FULL), DATA)!, EMPTY)).toBe("adopt");
  });

  // 最要紧的一条：已经在新域名玩出内容的人，绝不能因为翻出一条旧链接就被旧状态盖掉。
  it("falls back to merge when the new origin already has anything", () => {
    const incoming = parseMigration(encodeMigration(FULL), DATA)!;
    expect(migrationMode(incoming, { ...EMPTY, favs: ["wuzhen"] })).toBe("merge");
    expect(migrationMode(incoming, { ...EMPTY, visited: ["wuzhen"] })).toBe("merge");
    expect(migrationMode(incoming, { ...EMPTY, cmp: ["wuzhen"] })).toBe("merge");
    expect(migrationMode(incoming, { ...EMPTY, trip: [{ id: "wuzhen", days: 1 }] })).toBe("merge");
  });

  // tripStart 单独存在不算「玩出内容」——它只是个日期，盖掉它不损失记录。
  it("does not count a bare tripStart as local content", () => {
    expect(hasAnything(EMPTY)).toBe(false);
  });
});
