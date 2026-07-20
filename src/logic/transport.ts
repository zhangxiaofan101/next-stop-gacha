// 交通启发式（design「决策机制·交通启发式」）：距离分档 + 三条覆盖规则（显式交通 > leg 陆路例外 > 门户在 itinerary 层）。
import { hav } from "./geo";
import type { ExplicitTransport, LegEstimate, Place } from "./types";

export const FLY_PROV = new Set(["西藏", "新疆", "海南", "香港", "澳门"]);
// 渤海湾/胶东半岛：铁路大幅绕行（青岛真实 6h vs 直线估 3h），超 500km 的段倾向飞。
// 只对真跨海方向生效（codex F10），按对端方位判定，同侧陆路走廊不强制飞：
//  · 大连：除东北三省（哈大/沈白直达）外，其余方向直线均跨渤海/黄海
//  · 胶东三市南向：纬度<34.5 且经度>118（江浙沪及以南沿海）跨黄海；西/西南内陆（徐州、郑洛、石家庄）走陆路
//  · 胶东三市北向：东北三省跨渤海海峡；烟台/威海位置近海角，北纬>38.8（京/承/大同一线）即跨渤海湾；
//    青岛偏南基部，西北扇面（北京/正定）有陆路直达，仅东北向（承德/坝上，纬>39.5 且经>117.4）跨湾
export const SD_PEN = new Set(["qingdao", "yantai", "weihai"]);
export const NE_PROV = new Set(["辽宁", "吉林", "黑龙江"]);

export function seaDetour(p: Place & { id?: string }, q: Place): boolean {
  const [lat, lng] = q.coords;
  if (p.id === "dalian") return !NE_PROV.has(q.province || "");
  if (!p.id || !SD_PEN.has(p.id)) return false;
  if (lat < 34.5 && lng > 118) return true;
  if (NE_PROV.has(q.province || "")) return true;
  if (p.id === "qingdao") return lat > 39.5 && lng > 117.4;
  return lat > 38.8;
}

// 时长参数以 245 条 transit 人写时长回归标定（2026-07-14）：高铁=直线km/190+0.6，
// 飞机=直线km/625+2.4（口径为门到门、含机场地面时间）；干线快/沿海支线慢的残差是直线模型固有的，输出恒标"估算"
// 显式交通语义（F30）：leg 只承诺逐日文案与住宿，不代表陆路；游轮/轮渡/火车段用 stop.leg.transport 直接指定，
// 避免 F29 的 overland 把非公路 leg（如三峡游轮）也标成自驾。
export const TRANSPORT_META: Record<ExplicitTransport, { icon: string; kmph: number }> = {
  "游轮": { icon: "🚢", kmph: 26 }, "轮渡": { icon: "⛴", kmph: 24 }, "火车": { icon: "🚄", kmph: 120 },
};

// overland=true：该段是同一条完整 leg 组内的相邻站（招牌自驾/包车线，如 G318、阿里、沙漠公路），
// 两站再远也是陆路翻山穿沙，不存在航班——此时禁用「飞机」判定，落包车/自驾（中途过夜由 leg.stays 承载）。
export function legInfo(a: Place & { id?: string }, b: Place & { id?: string }, overland?: boolean, transport?: ExplicitTransport | null): LegEstimate {
  const km = hav(a.coords, b.coords);
  const straight = Math.round(km * 1.25); // 近似实际里程
  if (transport && TRANSPORT_META[transport]) { // 显式模式优先于距离启发式
    const t = TRANSPORT_META[transport];
    return { km: straight, mode: transport, icon: t.icon, hours: Math.round(km / t.kmph * 10) / 10 };
  }
  const provFly = FLY_PROV.has(a.province || "") || FLY_PROV.has(b.province || "");
  const needFly = provFly || (km >= 500 && (seaDetour(a, b) || seaDetour(b, a)));
  // M30：两端都在江浙沪的段（上海计入江浙沪），160~400km 也标自驾并列——用户自驾圈
  const jzh = a.region === "江浙沪" && b.region === "江浙沪";
  let mode: string, icon: string, hours: number;
  if (km < 60) { mode = "打车/自驾"; icon = "🚕"; hours = Math.max(.6, km / 50); }
  // overland：同一条完整 leg 组内的相邻站（招牌自驾/包车线），60km 以上一律陆路，不判高铁/飞机
  else if (overland) { mode = "包车/自驾"; icon = "🚐"; hours = km / 55; }
  else if (km < 160 && !needFly) { mode = "高铁/自驾"; icon = "🚄"; hours = km / 160 + .4; }
  else if (km < 950 && !needFly) { mode = jzh && km < 400 ? "高铁/自驾" : "高铁"; icon = "🚄"; hours = km / 190 + .6; }
  else if (provFly && km < 400) { mode = "包车/大巴"; icon = "🚐"; hours = km / 55; }
  else { mode = "飞机"; icon = "✈️"; hours = km / 625 + 2.4; }
  return { km: straight, mode, icon, hours: Math.round(hours * 10) / 10 };
}

export const fmtH = (h: number) => h >= 1 ? `约${h}h` : `约${Math.round(h * 60)}分钟`;

// M59 ④：卡片交通图标——此前 cards.ts 条带/名下行各自硬编码一枚固定图标（✈/🚄），与实际
// transit 文案脱节（高铁城显✈、飞机城显🚄，双向误导，用户实证截图）。改为从文案里解析出现
// 的第一个交通方式词，取该方式对应图标；两处消费点共用同一份解析结果（同一次调用），保证条带
// 与名下行不会各自解析出不同答案。关键词按“文案中最先出现的位置”取胜（`indexOf` 最小者），
// 同一起始下标的平局（如“飞机”与其前缀子串“飞”）由列表顺序决定——把更具体的写法排在前面，
// 使其在扫描时先把该位置“认领”，后面的子串写法就不会覆盖它（见 parseTransitIcon 实现）。
// 267 城 + 53 线共 320 条真实 transit 文案跑过这份关键词表：318 条命中明确方式词，仅 2 条
// （“经兰州/西安中转……”类，完全没点名具体方式的模糊转乘描述）落到中性兜底图标——宁可显示
// 「查文案」式的中性图标，也不猜一个可能错的具体方式（同「估算的诚实性」原则）。
const TRANSIT_ICON_KEYWORDS: [string, string][] = [
  ["直飞", "✈️"], ["飞机", "✈️"], ["航班", "✈️"], ["转机", "✈️"],
  ["高铁", "🚄"], ["动车", "🚄"], ["城际", "🚄"], ["铁路", "🚄"], ["普速", "🚄"], ["火车", "🚄"],
  ["地铁", "🚇"], ["轻轨", "🚇"],
  ["自驾", "🚐"], ["包车", "🚐"], ["公路", "🚐"], ["用车", "🚐"], ["车辆", "🚐"],
  ["大巴", "🚌"], ["客车", "🚌"], ["班车", "🚌"],
  ["游轮", "🚢"], ["邮轮", "🚢"], ["渡轮", "🚢"], ["轮渡", "⛴"], ["快艇", "🚢"], ["乘船", "🚢"], ["坐船", "🚢"],
  ["索道", "🚡"], ["缆车", "🚡"],
  ["飞", "✈️"], ["船", "🚢"],
];
const TRANSIT_ICON_FALLBACK = "🧭";

export function parseTransitIcon(transit: string): string {
  let icon = TRANSIT_ICON_FALLBACK, pos = Infinity;
  for (const [kw, ic] of TRANSIT_ICON_KEYWORDS) {
    const i = transit.indexOf(kw);
    if (i !== -1 && i < pos) { pos = i; icon = ic; }
  }
  return icon;
}
