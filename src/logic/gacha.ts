// 条件随机（design「决策机制·条件随机」）：在当前过滤结果内均匀抽样。rng 可注入以便测试。
export function gachaPick<T>(pool: T[], rng: () => number = Math.random): T | null {
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}
