// M22 视角换值（纯函数）：基座 data-*.json 恒为上海视角；切换出发地=把内存数据的
// transit/difficulty 换成该出发地视角文件的值，切回基座=恢复快照。快照持有与编排在
// store.ts（应用状态层），这里只有数据变换。
import type { Destination } from "./types";

export interface OriginViewEntry { transit: string; difficulty: string }
/** 视角文件形状：目的地 id → 该出发地视角的 {transit, difficulty}（构建闸门保证全量覆盖） */
export type ViewMap = Record<string, OriginViewEntry>;

export function captureBaseView(data: Destination[]): Map<string, OriginViewEntry> {
  return new Map(data.map(d => [d.id, { transit: d.transit, difficulty: d.difficulty }]));
}

/** view=null 恢复基座；视角文件缺某 id（闸门保证不发生，防御新数据未重打）时保守回退基座值 */
export function applyView(data: Destination[], view: ViewMap | null, base: Map<string, OriginViewEntry>): void {
  data.forEach(d => {
    const v = (view && view[d.id]) || base.get(d.id);
    if (v) { d.transit = v.transit; d.difficulty = v.difficulty; }
  });
}
