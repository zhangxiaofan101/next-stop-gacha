// M68：概念词 → 筛选映射（design「搜索增强」②）。搜索词命中概念词时结果区给「按筛选看：××」
// 一键 chip；词表集中在本文件一处，映射到既有筛选语义（不新增筛选组）。「短途/长途」是唯一
// 例外——不复用任何离散组，改走 filter.ts 的 distMode（距出发地直线距离派生）。
// 收录口径：词与既有筛选语义能对应且用户会真的这么搜——不是穷举同义词典，词表随反馈增补。
import type { GroupKey } from "./types";

export type IntentAction =
  | { type: "setGroup"; key: GroupKey; value: string }
  | { type: "setDistMode"; mode: "short" | "long" };

export interface IntentEntry {
  /** chip 文案用的展示词——多个搜索词可归到同一展示词（如「短途」「周边」都显示「短途」） */
  label: string;
  action: IntentAction;
}

const INTENT_WORDS: Record<string, IntentEntry> = {
  "短途": { label: "短途", action: { type: "setDistMode", mode: "short" } },
  "周边": { label: "短途", action: { type: "setDistMode", mode: "short" } },
  "长途": { label: "长途", action: { type: "setDistMode", mode: "long" } },
  "避暑": { label: "避暑", action: { type: "setGroup", key: "season", value: "夏" } },
  "海岛": { label: "海岛", action: { type: "setGroup", key: "tags", value: "海岛海滨" } },
  "古镇": { label: "古镇", action: { type: "setGroup", key: "tags", value: "古镇古村" } },
  "亲子": { label: "亲子", action: { type: "setGroup", key: "companions", value: "带娃" } },
  "冬天": { label: "冬天", action: { type: "setGroup", key: "season", value: "冬" } },
};

// 精确匹配整条搜索词（trim 后）——概念词是用户单独搜的一个词，不是子串扫描；子串扫描会在
// 「XX 避暑山庄」这类恰好包含概念词字面的普通关键词搜索里误触发无关的筛选建议。
export function matchIntent(q: string): IntentEntry | null {
  return INTENT_WORDS[q.trim()] ?? null;
}
