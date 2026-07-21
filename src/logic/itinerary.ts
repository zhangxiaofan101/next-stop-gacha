// 行程规划（design「决策机制·顺路排序」「顺路彩蛋」及交通三条覆盖规则的 leg/门户两条）。
// 全部纯函数：trip/stops/byId 显式传入；行程数组的变异（splice/赋值）由 UI 层执行。
import { SH } from "./constants";
import { havRaw } from "./geo";
import { legInfo } from "./transport";
import type { ById, Destination, FilterState, Place, TripItem, TripLeg, TripStopX } from "./types";

export function tripStops(trip: TripItem[], byId: ById): TripStopX[] {
  return trip.map(t => ({ ...byId(t.id)!, chosenDays: t.days, fromRoute: !!t.r, rid: t.r }));
}

// 顺路排序：以上海为起点的最近邻贪心；返回新数组，不动入参。
export function nearestNeighborOrder(trip: TripItem[], byId: ById): TripItem[] {
  const rest = [...trip];
  const ordered: TripItem[] = [];
  let cur = SH.coords;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((t, i) => {
      const km = havRaw(cur, byId(t.id)!.coords);
      if (km < bd) { bd = km; bi = i; }
    });
    const next = rest.splice(bi, 1)[0];
    ordered.push(next);
    cur = byId(next.id)!.coords;
  }
  return ordered;
}

// F18/F21：leg 是「线路上下文」文案（写死了前后站顺序），只有整条线路在行程里保持原样才成立：
// 同一 rid 的全部 stop 必须齐全、连续、同序、天数=默认，才整组启用 leg；
// 用户上移/下移/删站/顺路排序/只装入半条 → 组失效，整组回退城市 pickPlan（避免"半条线路+全量分段文案"错位）。
export function legEligibleIndices(stops: TripStopX[], byId: ById): Set<number> {
  const ok = new Set<number>();
  [...new Set(stops.filter(d => d.rid).map(d => d.rid!))].forEach(rid => {
    const rt = byId(rid);
    if (!rt || !rt.stops) return;
    const idxs = stops.map((d, i) => (d.rid === rid ? i : -1)).filter(i => i >= 0);
    const contiguous = idxs.every((v, k) => k === 0 || v === idxs[k - 1] + 1);
    const intact = idxs.length === rt.stops.length
      && rt.stops.every((s, k) => stops[idxs[k]].id === s.id && stops[idxs[k]].chosenDays === s.days);
    if (contiguous && intact) idxs.forEach(i => ok.add(i));
  });
  return ok;
}

// 进出门户（F31）：线路可声明 entry/exit=城市 id（如三亚进、海口出），与首末停留站不同。
// 仅当行程恰好是某条线路的完整整组时生效——首末大交通、逐日速览、详情、预算都用真实进出点。
export function tripGateway(stops: TripStopX[], byId: ById): { entry: Destination | null; exit: Destination | null } | null {
  if (!stops.length) return null;
  const rid = stops[0].rid;
  if (!rid || !stops.every(s => s.rid === rid)) return null; // 必须全部同一条线路
  if (legEligibleIndices(stops, byId).size !== stops.length) return null; // 且为完整整组（齐全/同序/默认天数）
  const rt = byId(rid);
  if (!rt) return null;
  const entry = rt.entry ? byId(rt.entry) ?? null : null;
  const exit = rt.exit ? byId(rt.exit) ?? null : null;
  return (entry || exit) ? { entry, exit } : null;
}

export function tripLegs(stops: TripStopX[], byId: ById): TripLeg[] {
  const legIdx = legEligibleIndices(stops, byId); // 整组完整启用 leg 的站下标（F21）
  const gw = tripGateway(stops, byId);
  const pts: Place[] = [SH, ...stops, SH];
  const legs: TripLeg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    let a = pts[i], b = pts[i + 1];
    const si = i - 1; // a 在 stops 中的下标（i≥1 时）；leg i 连接 stops[si]→stops[si+1]
    const inGroup = i >= 1 && i < stops.length && legIdx.has(si) && legIdx.has(si + 1)
      && !!stops[si].rid && stops[si].rid === stops[si + 1].rid;
    // 相邻两站同属一条完整 leg 组 → 陆路段，禁用飞机判定（F29）
    const overland = inGroup;
    // 进入 stops[si+1] 的段若目标站 leg 带显式 transport（游轮/轮渡/火车），用它覆盖启发式（F30）
    let transport = null;
    if (inGroup) {
      const dest = stops[si + 1], rt = byId(dest.rid!);
      const st = rt && rt.stops && rt.stops.find(s => s.id === dest.id);
      if (st && st.leg && st.leg.transport) transport = st.leg.transport;
    }
    // 门户改写首末大交通端点（F31）：上海→入口门户、出口门户→上海
    let gwName: string | null = null;
    if (gw && i === 0 && gw.entry) { b = gw.entry; gwName = gw.entry.name; }
    if (gw && i === pts.length - 2 && gw.exit) { a = gw.exit; gwName = gw.exit.name; }
    legs.push({ from: a, to: b, gwName, ...legInfo(a, b, overland, transport) });
  }
  return legs;
}

// M28：候选点插入现有环线哪一段绕路最少（add=度量km，at=对应 state.trip 的插入下标）
// F17：差值用不取整的 havRaw——取整后的三边差可为负，展示时再取整并夹到 ≥1
// M28 二轮（用户反馈）：纯几何三边差只对陆路段有意义——直飞大圆航线正下方的点增量≈0
// （上海⇄拉萨曾推「苏州 +绕0km」），但飞机段上不存在「顺路」。
// M28 三轮（落脚顺游）：「到了成都顺便乐山」成立——候选贴着某个非上海站点（直线 ≤150km
// 且该短驳非飞机）时允许插在该站旁，near=锚定站，add 改用「距锚定站 km」（spur 的
// 三边差会把往返里程虚大，距离才是用户关心的量）。两类度量同为 km，混排取小者优先。
export const NEAR_KM = 150;

export interface Insertion { add: number; at: number; near: Place | null; }

export function bestInsertion(c: Destination, stops: TripStopX[], byId: ById): Insertion {
  const pts: Place[] = [SH, ...stops, SH];
  // F74 修复：pts[i]→pts[i+1] 是行程里已经排定的真实段，其 air 判据必须走 tripLegs 同款
  // overland/显式 transport 判定（legEligibleIndices 同 rid 整组陆路豁免+门户改写），不能只用不带
  // 上下文的裸 legInfo(a,b)——后者对 G318 川西环线→林芝、阿里南线日喀则→普兰、南疆线塔县→库车
  // 这类长自驾廊道的相邻两站会按通用距离启发式误判成飞机，静默压掉沿线本该成立的顺路候选。
  // tripLegs 内部用的正是同一个 [SH, ...stops, SH] 序列，legs[i] 与这里的 pts[i]→pts[i+1] 一一对应。
  const legs = tripLegs(stops, byId);
  let add = Infinity, at = 0, near: Place | null = null, tie = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const extra = havRaw(a.coords, c.coords) + havRaw(c.coords, b.coords) - havRaw(a.coords, b.coords);
    // M67：判飞用 air 布尔而非 mode==="飞机"——「飞机+包车」（noair 站的组合档）同样是飞行段，
    // 地面包车只是末程接驳，不构成廊道顺路语义；字符串比较曾漏掉组合档，行程含 noair 远站时
    // 近沪城市以「+绕0km」涌入（budget 侧 M56 已用 air，此处同规）。候选牵涉的 a→c/c→b 两段是
    // 还未真正插入的假设连接，没有「真实行程段」可循，继续用裸 legInfo 守卫。
    const anyFly = legs[i].air || legInfo(a, c).air || legInfo(c, b).air;
    let m: number | null = null, anch: Place | null = null;
    if (!anyFly) m = extra; // 廊道顺路：段与两子段全陆路，度量=绕路增量
    else for (const e of [a, b]) { // 落脚顺游：只认贴着本段非上海端点的候选
      if (e === SH) continue;
      const dk = havRaw(e.coords, c.coords);
      if (dk <= NEAR_KM && !legInfo(e, c).air && (m === null || dk < m)) { m = dk; anch = e; }
    }
    if (m === null) continue;
    // F34：单站行程时「锚点前」「锚点后」两个缺口对同一候选给出完全相同的 m/extra（对称算式），
    // 严格 `<` 只会留住先遍历到的锚点前一侧，把「到了成都顺便乐山」插成「乐山→成都」。
    // 完全并列（同锚点、同度量）时优先锚点后的出站位（a===anch，即插在锚点之后）。
    const afterAnchorTie = m === add && extra === tie && anch !== null && anch === near && a === anch;
    if (m < add || (m === add && extra < tie) || afterAnchorTie) { add = m; at = i; near = anch; tie = extra; }
  }
  return { add, at, near };
}

// 顺路彩蛋候选（M28 四轮）：两类候选同池混排（度量同为 km，取小者），绕路/距离 <200km，前 limit 个；
// 线路卡不进彩蛋（整条装入是行程单动作）；全程直飞且各站周边无卡的行程没有彩蛋，是诚实答案；
// 尊重「避开高海拔」「隐藏去过的」两个开关——不给避高原的人推高海拔、不重推去过的（其余浏览筛选不约束行程建议）。
export function onwaySuggestions(data: Destination[], state: FilterState, byId: ById, limit = 3): ({ d: Destination } & Insertion)[] {
  const stops = tripStops(state.trip, byId);
  return data
    .filter(d => !d.stops && !state.trip.some(t => t.id === d.id)
      && !(state.noAlt && d.alt) && !(state.hideVisited && state.visited.includes(d.id)))
    .map(d => ({ d, ...bestInsertion(d, stops, byId) }))
    .filter(x => x.add < 200)
    .sort((a, b2) => a.add - b2.add).slice(0, limit);
}
