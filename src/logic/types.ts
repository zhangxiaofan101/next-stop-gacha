// 决策层共享类型。数据契约见 design「存储与精确性」「线路卡数据契约」；
// 字段全量必填（构建闸门 tools/build.py 强校验），可选字段仅限线路专属（stops/entry/exit/regions）与 leg。

export interface Plan {
  days: number;
  title: string;
  route: string;
  /** 路线型方案：每晚落脚点，长度==days（build 校验） */
  stays?: string[];
}

export type ExplicitTransport = "游轮" | "轮渡" | "火车";

export interface StopLeg {
  /** 线路视角逐日文案（写死前后站顺序，整组启用才生效——F21） */
  route: string;
  /** 每晚落脚点，长度==stop.days */
  stays: string[];
  /** 显式交通（F30）：该段非陆路时声明，优先于一切启发式 */
  transport?: ExplicitTransport;
}

export interface RouteStop {
  id: string;
  days: number;
  leg?: StopLeg;
}

export interface Destination {
  id: string;
  name: string;
  emoji: string;
  region: string;
  /** 线路卡：途经大区（多选 OR）；region 保留为主大区徽章 */
  regions?: string[];
  province: string;
  coords: [number, number];
  tagline: string;
  transit: string;
  difficulty: string;
  cost: string;
  crowd: string;
  alt: boolean;
  seasons: string[];
  seasonNote: string;
  days: number[];
  effort: string[];
  companions: string[];
  tags: string[];
  food: string[];
  museums: string[];
  architecture: string[];
  highlights: string[];
  hotel: string;
  local: string;
  plans: Plan[];
  /** stops 的存在与否是线路卡的唯一判别标志（design：不新增 type 字段） */
  stops?: RouteStop[];
  /** 进出门户城市 id（F31），仅整组行程生效 */
  entry?: string;
  exit?: string;
}

/** 行程单条目；r=装入来源线路 id（既是装入标记，也供路书回查 leg——F18） */
export interface TripItem {
  id: string;
  days: number;
  r?: string;
}

/** 行程站点视图：目的地 + 行程上下文（选定天数 / 线路来源） */
export interface TripStopX extends Destination {
  chosenDays: number;
  fromRoute: boolean;
  rid?: string;
}

/** legInfo 的端点：目的地或上海锚点（SH 无 province，FLY_PROV 判定天然为 false） */
export interface Place {
  name: string;
  coords: [number, number];
  province?: string;
  region?: string;
}

export interface LegEstimate {
  km: number;
  mode: string;
  icon: string;
  hours: number;
}

export interface TripLeg extends LegEstimate {
  from: Place;
  to: Place;
  /** 门户改写时的门户城市名（F31），供行程单/速览文案 */
  gwName: string | null;
}

/** 偏好/容忍 chip 组的键（GROUP_NAMES 的键 + tags） */
export type GroupKey =
  | "region" | "season" | "days" | "crowd"
  | "cost" | "difficulty" | "effort" | "companions" | "tags";

export interface FilterState {
  region: Set<string>;
  season: Set<string>;
  days: Set<string>;
  crowd: Set<string>;
  cost: Set<string>;
  difficulty: Set<string>;
  effort: Set<string>;
  companions: Set<string>;
  tags: Set<string>;
  q: string;
  sort: string;
  onlyFav: boolean;
  noAlt: boolean;
  hideVisited: boolean;
  favs: string[];
  cmp: string[];
  trip: TripItem[];
  visited: string[];
  /** M29 出发日期（"YYYY-MM-DD"，空=不标日期，路书退回 D1/D2 记法） */
  tripStart: string;
}

export type ById = (id: string) => Destination | undefined;
