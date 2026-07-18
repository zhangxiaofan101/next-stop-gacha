// 足迹地图决策（design M24）：点亮口径与撒点投影。SVG 组装在 ui/mapview.ts。
import type { Destination } from "./types";

// 足迹统计：打卡数 + 点亮省份数（只算城市记录，线路卡不计入 visited）
// F11：点亮省份唯一口径——CN_MAP 省短名被任一 visited 城市的 province 字符串 includes 即点亮
// （跨省交界记录如泸沽湖「云南·四川交界」点亮两省）；地图填色、地图统计条、足迹胶囊三处同源
export function litProvinces(visited: Destination[], provs: { n: string }[]): string[] {
  return provs.filter(p => visited.some(d => (d.province || "").includes(p.n))).map(p => p.n);
}

export interface MapProjection { lng0: number; lat1: number; kx: number; ky: number; }

// 撒点投影务必和 CN_MAP.prj 公式一致：x=(lng-lng0)*kx, y=(lat1-lat)*ky（注意 coords=[lat,lng] 顺序）
export function projectPoint(coords: [number, number], prj: MapProjection): { x: string; y: string } {
  const [lat, lng] = coords;
  return {
    x: ((lng - prj.lng0) * prj.kx).toFixed(1),
    y: ((prj.lat1 - lat) * prj.ky).toFixed(1),
  };
}
