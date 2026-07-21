// M22 出发地机制：出发地是全站数据视角（非筛选条件）。注册表=代码内预设城市表；
// 某出发地「可选」当且仅当其视角文件已发布进 origins 索引（tools/build.py 产出的
// public/data/origins.json）——启用新出发地=加一个 data/origin-<id>.json，零代码改动。
// 当前出发地是模块级状态（同 CUR_SEASON 的环境态先例）：决策层纯函数经 getOrigin()
// 读取，测试用 setOrigin 注入并复位。基座 data-*.json 的 transit/difficulty 恒为上海
// 视角，换视角的数据面在 logic/originView.ts。
import { SH } from "./constants";

export interface Origin {
  id: string;
  name: string;
  region: string;
  coords: [number, number];
  /** 对应城市卡 id：目的地 id==当前出发地 cardId 时从池中隐去（本城卡对偶，见 design M22） */
  cardId: string;
}

export const ORIGINS: Origin[] = [
  { id: "shanghai", name: SH.name, region: SH.region!, coords: SH.coords, cardId: "shanghai" },
  { id: "beijing", name: "北京", region: "华北", coords: [39.9, 116.4], cardId: "beijing" },
];

/** 基座视角：data-*.json 的 transit/difficulty 按此出发地书写，无需视角文件 */
export const BASE_ORIGIN = ORIGINS[0];

let cur: Origin = BASE_ORIGIN;
export const getOrigin = (): Origin => cur;
export function setOrigin(o: Origin) { cur = o; }

export const originById = (id: string | null | undefined): Origin | undefined =>
  ORIGINS.find(o => o.id === id);

/** localStorage 原始选择 + 已发布视角索引 → 实际可生效的出发地（脏值/未注册/未发布一律回基座） */
export function resolveOrigin(choice: string | null, published: Record<string, string>): Origin {
  const o = originById(choice);
  if (!o) return BASE_ORIGIN;
  return o.id === BASE_ORIGIN.id || published[o.id] ? o : BASE_ORIGIN;
}
