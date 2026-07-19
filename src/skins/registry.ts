// 皮肤声明与选择解析（M45 起框架，M46 首次接入真实字体+资产+装饰声明）。一皮肤 = token 集 +
// 字体对 + 资产目录 + 装饰件开关位。fonts 字段记录该皮肤 --round/--sans 实际解析到的字体族名
// （即 src/skins/<id>.css 里 @font-face 的 font-family），不是运行时拿来生成 <link>/FontFace
// 的输入——CSS token（--round/--sans）本身就是字体懒加载/失败回退的完整机制（浏览器只在某个
// font-family 真的被用来画字时才取 @font-face 的 src，非当前皮肤下 --round/--sans 解析不到
// "Ink Title"/"Ink Body"，浏览器天然不会发起这两个 woff2 请求），fonts 字段留作可核对的声明
// 契约（drift-pin 测试见 src/skins/__tests__/registry.test.ts，锁 ink.css 里的 font-family 与
// 这里字面一致，防止两处各写一份却悄悄分叉）。assetDir/decorations 见 illustrations.ts 的
// applySkinVisuals——两个字段都被真实消费，不是摆设声明。
import { applySkinVisuals } from "./illustrations";
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
  {
    id: "ink", label: "山水",
    fonts: { title: "Ink Title", body: "Ink Body" },
    assetDir: "ink",
    // 自由浮动装饰件（柳桥/竹枝/远山，design「装饰位画布契约」）——三件套皆随本皮肤整套启停；
    // 键名与 index.html 里对应 img 的 data-deco 值一一对应，见 illustrations.ts 的消费逻辑。
    decorations: { willow: true, bamboo: true, distantHill: true },
  },
];

export const SKIN_IDS = SKINS.map(s => s.id);
export const DEFAULT_SKIN = "cream";
export const RANDOM_CHOICE = "random";

// 归一化原始 choice（localStorage 可能存着脏数据/已下架皮肤）：合法皮肤 id 或 "random" 原样
// 通过，其余（含 null）一律回退默认皮肤。首帧内联脚本、resolveSkinId、选择器高亮三处共用这一条
// 回退语义——实际生效皮肤与弹层高亮不可能分叉（F56）。
export function normalizeSkinChoice(raw: string | null): string {
  if (raw === RANDOM_CHOICE) return raw;
  return raw !== null && SKIN_IDS.includes(raw) ? raw : DEFAULT_SKIN;
}

// choice 是用户选择的原始值（某皮肤 id 或 "random"）；resolve 出真正要落到 data-theme 上的皮肤 id。
export function resolveSkinId(choice: string): string {
  const c = normalizeSkinChoice(choice);
  if (c === RANDOM_CHOICE) return SKIN_IDS[Math.floor(Math.random() * SKIN_IDS.length)];
  return c;
}

// 持久化 choice（归一化后落盘，脏值不进 localStorage）+ 立即切换 data-theme（同步生效，无需刷新
// 页面）+ 同步刷新装饰位/自由装饰件（applySkinVisuals，M46）——三者同一个函数一次做完，不会出现
// data-theme 换了但吉祥物/装饰件没跟着换的中间态。
export function applySkinChoice(choice: string) {
  const c = normalizeSkinChoice(choice);
  setSkinChoice(c);
  const resolved = resolveSkinId(c);
  document.documentElement.dataset.theme = resolved;
  applySkinVisuals(resolved);
}
