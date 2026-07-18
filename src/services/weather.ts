/* M23 天气预报（Open-Meteo，失败静默降级）——唯一的外部实时接入，永远不是页面可用性的前提。 */
import type { ById, Destination } from "../logic/types";

// WMO weather_code → {e: emoji, t: 简短中文}
export const WX_CODE_MAP: Record<number, { e: string; t: string }> = {
  0: { e: "☀️", t: "晴" },
  1: { e: "🌤", t: "多云" }, 2: { e: "🌤", t: "多云" },
  3: { e: "☁️", t: "阴" },
  45: { e: "🌫", t: "雾" }, 48: { e: "🌫", t: "雾" },
  51: { e: "🌦", t: "毛毛雨" }, 53: { e: "🌦", t: "毛毛雨" }, 55: { e: "🌦", t: "毛毛雨" }, 56: { e: "🌦", t: "毛毛雨" }, 57: { e: "🌦", t: "毛毛雨" },
  61: { e: "🌧", t: "雨" }, 63: { e: "🌧", t: "雨" }, 65: { e: "🌧", t: "雨" }, 66: { e: "🌧", t: "雨" }, 67: { e: "🌧", t: "雨" },
  71: { e: "🌨", t: "雪" }, 73: { e: "🌨", t: "雪" }, 75: { e: "🌨", t: "雪" }, 77: { e: "🌨", t: "雪" },
  80: { e: "🌦", t: "阵雨" }, 81: { e: "🌦", t: "阵雨" }, 82: { e: "🌦", t: "阵雨" },
  85: { e: "🌨", t: "阵雪" }, 86: { e: "🌨", t: "阵雪" },
  95: { e: "⛈", t: "雷雨" }, 96: { e: "⛈", t: "雷雨" }, 99: { e: "⛈", t: "雷雨" },
};
export const wxInfo = (code: number) => WX_CODE_MAP[code] || { e: "🌡", t: "未知" };

export interface WxDay { dt: string; code: number; hi: number; lo: number; }
export const wxLine = (days: WxDay[]) => days.map(x => `${wxInfo(x.code).e}${x.hi}°`).join(" "); // 逐日 emoji+最高温压缩成一行

const WX_LS_KEY = "nextstop_wx_v1";
const WX_TTL = 3 * 60 * 60 * 1000; // 缓存 3 小时内直接复用，减少请求
type WxCache = Record<string, { t: number; days: WxDay[] }>;
function wxCacheRead(): WxCache {
  try { return JSON.parse(localStorage.getItem(WX_LS_KEY) || "{}"); } catch (e) { return {}; }
}
function wxCacheWrite(cache: WxCache) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > 60) keys.sort((a, b) => cache[a].t - cache[b].t).slice(0, keys.length - 60).forEach(k => delete cache[k]);
    localStorage.setItem(WX_LS_KEY, JSON.stringify(cache));
  } catch (e) {}
}
// 同步读缓存（仅 TTL 内命中才返回），供路书文本导出等不发请求的场景用
export function wxCacheGet(id: string): WxDay[] | null {
  const hit = wxCacheRead()[id];
  return (hit && Date.now() - hit.t < WX_TTL) ? hit.days : null;
}
// 拉 7 天预报；任何失败（超时/断网/非200/解析错）都只 console.warn 后返回 null，绝不抛错影响页面其他功能
export async function fetchWeather(d: Destination, byId: ById): Promise<WxDay[] | null> {
  const cached = wxCacheGet(d.id);
  if (cached) return cached;
  const coords = (d.stops && d.stops.length ? byId(d.stops[0].id)?.coords : d.coords) || null; // 线路卡取首站坐标，代表起点站
  if (!coords) return null;
  const [lat, lng] = coords;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=7`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const days: WxDay[] = j.daily.time.map((dt: string, i: number) => ({
      dt, code: j.daily.weather_code[i],
      hi: Math.round(j.daily.temperature_2m_max[i]), lo: Math.round(j.daily.temperature_2m_min[i]),
    }));
    const cache = wxCacheRead();
    cache[d.id] = { t: Date.now(), days };
    wxCacheWrite(cache);
    return days;
  } catch (e) {
    console.warn("天气预报获取失败：", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
