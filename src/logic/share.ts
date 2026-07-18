// 分享/备份（design「决策机制·分享/备份」）：payload 序列化/解析与并集合并语义——三通道（链接/QR/JSON）同源。
// URL/剪贴板/DOM 由 ui/share.ts 负责。
import type { Destination } from "./types";

export interface SharePayload { favs: string[]; visited: string[]; }

export const serializeShare = (p: SharePayload) => `f:${p.favs.join(".")};v:${p.visited.join(".")}`;

export function parseShare(str: string | null | undefined, data: Destination[]): SharePayload | null { // "f:a.b;v:c.d" → 只收当前数据集内合法的 id（visited 仅城市，favs 城市+线路都行）
  const m = /^f:([^;]*);v:(.*)$/.exec(str || "");
  if (!m) return null;
  const allIds = new Set(data.map(d => d.id));
  const cityIds = new Set(data.filter(d => !d.stops).map(d => d.id));
  return {
    favs: [...new Set(m[1].split(".").filter(id => allIds.has(id)))],
    visited: [...new Set(m[2].split(".").filter(id => cityIds.has(id)))],
  };
}

// 并集合并，绝不覆盖本机已有；行程/对比不动（返回合并后的 favs/visited 与新增计数，由 UI 写回 state）。
export function mergeUnion(cur: SharePayload, p: SharePayload): SharePayload & { addedFavs: number; addedVisited: number } {
  const addedFavs = p.favs.filter(id => !cur.favs.includes(id)).length;
  const addedVisited = p.visited.filter(id => !cur.visited.includes(id)).length;
  return {
    favs: [...new Set([...cur.favs, ...p.favs])],
    visited: [...new Set([...cur.visited, ...p.visited])],
    addedFavs, addedVisited,
  };
}

// JSON 导入（F16）：合法 JSON 但不是对象（null/数字/数组）也要走格式提示，不能裸访问 obj.favs 抛异常。
export type ImportParseResult = { error: "parse" | "shape" } | SharePayload | null;
export function parseImportJSON(text: string, data: Destination[]): ImportParseResult {
  let obj: unknown;
  try { obj = JSON.parse(text); } catch (e) { return { error: "parse" }; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return { error: "shape" };
  const o = obj as { favs?: unknown; visited?: unknown };
  return parseShare(`f:${(Array.isArray(o.favs) ? o.favs : []).join(".")};v:${(Array.isArray(o.visited) ? o.visited : []).join(".")}`, data);
}
