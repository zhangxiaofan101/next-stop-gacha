// M83：老存档跨域名接运（纯函数侧）。
//
// M82 把站点从别人域名的子路径搬到了自己的域名。localStorage 按 origin 隔离，
// 所以老玩家的 `nextstop_v2`（收藏/对比/行程/足迹/出发日）留在旧 origin 里，
// 新域名一个字节都读不到——裸 308 过去的人会看见空存档。
//
// 通道是 URL fragment：旧地址的搬家页在**老 origin 上**读得到 localStorage，
// 把整份存档塞进 `#m=`，跳到新域名；新域名解出来再落地。fragment 不发给服务器，
// 存档不经过任何后端，也不需要 CORS 或短链 API。
//
// 与既有 `#s=` 分享链接的区别，是这个模块存在的理由：`#s=` 只带收藏+打卡
// （分享语义是「把我的记录并给你」，行程/对比故意不动），迁移带的是**你自己的
// 全部家当**，丢了行程就等于没搬。

import { normalizePersisted, type PersistedState } from "./persist";
import type { Destination } from "./types";

export const MIGRATE_HASH_PREFIX = "#m=";

/** 迁移载荷 = localStorage 里那份 JSON 原样。编码只做 encodeURIComponent，不上 base64：
 *  载荷全是 ASCII（城市 id + ISO 日期），多一层编码只是多一处能出错的地方。 */
export function encodeMigration(persisted: unknown): string {
  return encodeURIComponent(JSON.stringify(persisted));
}

/**
 * 解迁移载荷。任何不合法一律返回 null——调用方按「没带存档」处理，绝不半途而废地
 * 塞进去一半。校验复用 normalizePersisted（localStorage 恢复走的同一套信任边界：
 * 都是「本地可再生数据、非当前数据集权威」的外部输入）。
 */
export function parseMigration(raw: string, data: Destination[]): PersistedState | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  let p: PersistedState;
  try {
    p = normalizePersisted(parsed, data);
  } catch {
    return null; // 非法形状：与 loadLS 同口径，整体放弃
  }
  return hasAnything(p) ? p : null;
}

export function hasAnything(p: Pick<PersistedState, "favs" | "cmp" | "trip" | "visited">): boolean {
  return Boolean(p.favs.length || p.cmp.length || p.trip.length || p.visited.length);
}

/**
 * 落地策略。搬家和分享不是一回事，所以不共用一条路径：
 *
 * - 本机是**空的** → 整份认领（favs/cmp/trip/visited/tripStart 全套）。这是「你的
 *   东西搬过来了」，不该退化成只带一半。
 * - 本机**已有东西** → 不覆盖。退回既有分享语义：收藏/打卡并集合并、行程对比不动，
 *   并且照旧弹确认条让人自己点。在新域名已经玩出内容的人，绝不能因为翻出一条旧链接
 *   就被旧状态盖掉。
 */
export function migrationMode(
  incoming: PersistedState,
  local: Pick<PersistedState, "favs" | "cmp" | "trip" | "visited">,
): "adopt" | "merge" {
  return hasAnything(local) ? "merge" : "adopt";
}
