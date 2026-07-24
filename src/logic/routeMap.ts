// 路书路线图投影（design M79）：出发地+各站坐标投影到 CN_MAP 同一坐标系（照搬既有换算——
// 见 ui/mapview.ts 足迹地图用法），viewBox 裁剪到该行程的包围盒（加边距），
// SVG 拼装留在 ui/roadbook.ts，本模块只产出投影后的点位与 viewBox 字符串。
import { CN_MAP } from "../cn-map";
import { projectPoint } from "./map";
import type { Place } from "./types";

export interface RouteMapPoint { x: number; y: number; name: string; }

export interface RouteMapModel {
  viewBox: string;
  /** viewBox 的宽高（投影单位），供 UI 层按跨度换算线宽/点半径/字号，避免小跨度行程的描边被撑得过粗 */
  w: number; h: number;
  origin: RouteMapPoint;
  stops: RouteMapPoint[];
}

const MARGIN_FRAC = 0.12; // design 定「加边距~12%」：包围盒每边各扩 12%（两边合计约 +24%）
// 最小跨度下限（投影单位）：CN_MAP 全国画布约 1000×1014，两站近邻（如沪苏一带，直线约
// 80km）时原始包围盒可能只有个位数投影单位，硬套 12% 边距仍会把地图拉到失真的极端特写——
// 90 大致对应几百公里量级的可读上下文，经验取值，两个方向独立生效（不强求跨度相等）。
const MIN_SPAN = 90;

export function buildRouteMap(origin: Place, stops: Place[]): RouteMapModel {
  const pts = [origin, ...stops].map(p => {
    const { x, y } = projectPoint(p.coords, CN_MAP.prj);
    return { x: Number(x), y: Number(y), name: p.name };
  });
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let minX = Math.min(...xs), maxX = Math.max(...xs);
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  const padX = Math.max((maxX - minX) * MARGIN_FRAC, 1);
  const padY = Math.max((maxY - minY) * MARGIN_FRAC, 1);
  minX -= padX; maxX += padX; minY -= padY; maxY += padY;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const w = Math.max(maxX - minX, MIN_SPAN), h = Math.max(maxY - minY, MIN_SPAN);
  minX = cx - w / 2; maxX = cx + w / 2; minY = cy - h / 2; maxY = cy + h / 2;
  const viewBox = `${minX.toFixed(1)} ${minY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  const [originPt, ...stopPts] = pts;
  return { viewBox, w, h, origin: originPt, stops: stopPts };
}
