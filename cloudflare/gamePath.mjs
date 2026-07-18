// 独立成小文件（无任何 cloudflare: 专属导入），供 worker.mjs 和纯 Node/Bun 环境下的测试
// （tests/build-assets.test.mjs 需要真实文件系统，跑不进 workerd 沙箱，见该文件头注）共用——
// 避免测试文件为了这一个纯函数被迫连带导入 durableObjects.mjs 里对 `cloudflare:workers` 的
// 依赖（那个虚拟模块只在 Workers 运行时/vitest-pool-workers 沙箱里才解析得出来）。
export const GAME_PREFIX = "/next-stop-gacha";

export function isGamePath(pathname) {
  return pathname === GAME_PREFIX || pathname.startsWith(`${GAME_PREFIX}/`);
}
