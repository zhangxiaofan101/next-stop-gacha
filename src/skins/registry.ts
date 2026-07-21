// 皮肤声明与选择解析（M45 起框架，M46 首次接入真实字体+资产+装饰声明）。一皮肤 = token 集 +
// 字体对 + 资产目录 + 装饰件开关位。
//
// fonts 字段（F58 纠偏，2026-07-20）：记录该皮肤 --round/--sans 实际解析到的字体族名（即
// src/skins/<id>.css 里 @font-face 的 font-family），**不参与任何运行时选择**——CSS token
// （--round/--sans）本身就是字体懒加载/失败回退的完整机制且是唯一真相源（浏览器只在某个
// font-family 真的被用来画字时才取 @font-face 的 src，非当前皮肤下 --round/--sans 解析不到
// "Ink Title"/"Ink Body"，浏览器天然不会发起这两个 woff2 请求）。fonts 字段纯粹是可核对的静态
// 声明，唯一用途是被 src/skins/__tests__/registry.test.ts 的 drift-pin 测试拿去和 ink.css 里的
// 字面 font-family 互相核对，防止两处各写一份却悄悄分叉——「有 drift-pin 测试盯着」不等于「被
// 运行时消费」，这是两件事，此前的注释把两者混为一谈。
//
// assetDir/decorations 不同：两者都在 illustrations.ts 里被 applySkinVisuals/assetDirFor 在渲染
// 路径上真实读取消费——运行路径先解析当前 SkinDeclaration 拿到 assetDir 再拼图片 URL，不是只在
// 测试里自证的摆设声明（见该文件顶部注释）。
import { applySkinVisuals } from "./illustrations";
import { setSkinChoice } from "../store";

export interface SkinDeclaration {
  id: string;
  label: string;
  fonts: { title: string; body: string } | null;
  assetDir: string;
  decorations: Record<string, boolean>;
  // M59 ⑨：卡位是否展示目的地共享集个图/大区题头（详情位不受此开关——皮肤无关常显，M60 已
  // 实现）。奶油卡通与水墨淡彩共享集画风违和，关；山水本身与共享集同族，开。票券氛围带与卡位
  // 走同一路径同一开关（design「目的地图展示语义」）。
  cardPhotos: boolean;
}

export const SKINS: SkinDeclaration[] = [
  { id: "cream", label: "原味", fonts: null, assetDir: "cream", decorations: {}, cardPhotos: false },
  {
    id: "ink", label: "山水",
    fonts: { title: "Ink Title", body: "Ink Body" },
    assetDir: "ink",
    // 自由浮动装饰件（柳桥/竹枝/远山，design「装饰位画布契约」）——三件套皆随本皮肤整套启停；
    // 键名与 index.html 里对应 img 的 data-deco 值一一对应，见 illustrations.ts 的消费逻辑。
    decorations: { willow: true, bamboo: true, distantHill: true },
    cardPhotos: true,
  },
  {
    id: "porcelain", label: "青花",
    fonts: null, // 无专属字体对（同 cream 先例），--round/--sans 走系统字体栈，见 porcelain.css
    assetDir: "porcelain",
    // 自由浮动装饰件（缠枝莲角饰/云纹/浪纹，A7 工单）——键名与 index.html 对应 img 的 data-deco
    // 值一一对应；三张母版画幅各不相同（lotus 近 1:1、cloud/wave 近 2:1，M61 起 decor 槽位保留
    // 原生比例，见 tools/build_illustrations.py）。
    decorations: { lotus: true, cloud: true, wave: true },
    cardPhotos: true, // 灰度→钴蓝滤镜下目的地共享集与青花瓷面气质相容（qa-dest-cobalt-map 预演），M61 验收目检确认
  },
  {
    id: "doodle", label: "涂鸦",
    fonts: null, // 无专属字体对（A9 未画字体，同 cream/porcelain 先例），--round/--sans 走系统字体栈，见 doodle.css
    assetDir: "doodle",
    // 自由浮动装饰件——A9 六张全部终审通过（town/plants/travel 各两版，见 illustration-brief），
    // 本批克制铺量只挂三件（每个母题选一版，同 ink/porcelain 三件套先例）：town-1 全宽压底
    // （呼应 ink 的 distantHill/porcelain 的 wave 角色）、plants-1 左上角、travel-1 右上角；
    // 其余三版（town-2/plants-2/travel-2）已转档 picked/doodle/ 留作候补，系统化多件编排是
    // 七期 M72 的事，本模块不提前造机制。键名与 index.html 对应 img 的 data-deco 值一一对应。
    decorations: { town: true, plants: true, travel: true },
    cardPhotos: true, // 灰度线稿滤镜下目的地共享集与钢笔速写气质相容（M62 验收目检确认）
  },
];

export const SKIN_IDS = SKINS.map(s => s.id);
export const DEFAULT_SKIN = "ink";
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
