// 皮肤声明与选择解析（M45）。一皮肤 = token 集 + 字体对 + 资产目录 + 装饰件开关位；
// 本模块只落地「奶油」默认皮肤（现行视觉原样收编），山水等后续皮肤只追加声明条目，
// 不改本文件的机制。fonts 字段是预留槽位——构建期 pyftsubset 子集化/非当前皮肤懒加载
// 管线随第一个声明真实字体文件的皮肤（M46）落地，此前 fonts:null 就是契约本身。
import { setSkinChoice } from "../store";

export interface SkinDeclaration {
  id: string;
  label: string;
  fonts: { title: string; body: string } | null;
  assetDir: string;
  decorations: Record<string, boolean>;
}

export const SKINS: SkinDeclaration[] = [
  { id: "cream", label: "奶油", fonts: null, assetDir: "cream", decorations: {} },
];

export const SKIN_IDS = SKINS.map(s => s.id);
export const DEFAULT_SKIN = "cream";
export const RANDOM_CHOICE = "random";

// choice 是用户选择的原始值（某皮肤 id 或 "random"）；resolve 出真正要落到 data-theme 上的皮肤 id。
// 未知 choice（脏数据/皮肤下架）一律回退默认皮肤，不抛错。
export function resolveSkinId(choice: string): string {
  if (choice === RANDOM_CHOICE) return SKIN_IDS[Math.floor(Math.random() * SKIN_IDS.length)];
  return SKIN_IDS.includes(choice) ? choice : DEFAULT_SKIN;
}

// 持久化 choice（原始值，含 "random"）+ 立即切换 data-theme（同步生效，无需刷新页面）。
export function applySkinChoice(choice: string) {
  setSkinChoice(choice);
  document.documentElement.dataset.theme = resolveSkinId(choice);
}
