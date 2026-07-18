// 球面几何。
export function havRaw(a: [number, number], b: [number, number]): number { // 不取整版：几何计算（绕路增量差值）必须用它，取整会破坏三角不等式（F17）
  const R = 6371, r = (x: number) => x * Math.PI / 180;
  const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const hav = (a: [number, number], b: [number, number]) => Math.round(havRaw(a, b));
