// 配置常量（自单文件版逐字迁移，语义与顺序不变——chip 顺序即 UI 展示顺序）。
import type { GroupKey, Place } from "./types";

export const REGIONS = ["江浙沪", "华东", "华北", "东北", "华中", "华南", "西南", "西北", "港澳"];
// M45：值改为 var(--region-<slug>) 字符串，颜色本体挪去 src/skins/cream.css（皮肤 token 化）；
// 键名与导出形状不变，slug 映射：江浙沪→jzh 华东→huadong 华北→huabei 东北→dongbei
// 华中→huazhong 华南→huanan 西南→xinan 西北→xibei 港澳→gangao。
export const REGION_COLOR: Record<string, string> = {
  "江浙沪": "var(--region-jzh)", "华东": "var(--region-huadong)", "华北": "var(--region-huabei)", "东北": "var(--region-dongbei)",
  "华中": "var(--region-huazhong)", "华南": "var(--region-huanan)", "西南": "var(--region-xinan)", "西北": "var(--region-xibei)", "港澳": "var(--region-gangao)",
};
// M46：九区题头插画的文件名 slug，从 REGION_COLOR 的 var(--region-<slug>) 里正则抠出来，
// 不另开一份映射——两处字面写重复的 slug 会有漂移风险，这里只有一个真相源。
export const REGION_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(REGION_COLOR).map(([region, token]) => [region, token.match(/--region-([\w-]+)\)/)![1]]),
);
export const SEASONS = ["春", "夏", "秋", "冬"];
// M78：天数从固定分段多选改判容忍型天花板——时间预算是单调判据（时间充裕者必然接受更短
// 行程），点第 t 档＝该目的地最短方案落在天花板内即命中（min(days) ≤ cap），与花费/抵达
// 难度同一「点档＝含所有更省档」机制（CEIL_GROUPS 收编，见下）。原「2周+」档（key "14"）
// 天花板语义等价不限，随顶档裁撤条款一并退场；原 "45" 键改判为「最多5天」cap，键改 "5"。
export const DAY_BUCKETS: { key: string; label: string; test: (d: number[]) => boolean }[] = [
  { key: "2", label: "最多2天", test: d => d.some(x => x <= 2) },
  { key: "3", label: "最多3天", test: d => d.some(x => x <= 3) },
  { key: "5", label: "最多5天", test: d => d.some(x => x <= 5) },
  { key: "7", label: "最多1周", test: d => d.some(x => x <= 7) },
];
export const CROWDS = ["热门", "适中", "小众"];
// 玩法 chip 列表：数据里仍保留「亲子」tag（搜索可命中），但 chip 不再展示——同行组「带娃」承载该场景（2026-07-14 用户拍板：UI 隐藏、数据保留）
export const TAGS = ["美食", "博物馆", "古建筑", "古镇古村", "自然风光", "海岛海滨", "徒步", "民俗非遗", "citywalk", "夜生活", "温泉", "滑雪", "沙漠", "草原", "摄影出片", "世界遗产", "边境风情", "实景演艺", "观星", "工业遗产"];
export const COMPANIONS = ["带娃", "带爸妈", "独行", "情侣周末"]; // 偏好型多选 OR；记录 companions 为空数组 = 谁来都合适（通配）
export const CROWD_CLASS: Record<string, string> = { "热门": "hot", "适中": "mid", "小众": "hid" };
export const EFFORTS = ["躺平", "正常", "费腿", "硬核"]; // 偏好型多选 OR；记录 effort 为空数组 = 怎么玩都行（通配）
export const SH: Place = { name: "上海", region: "江浙沪", coords: [31.23, 121.47] }; // region 供 M30 江浙沪自驾判定

export const PER_DAY_COST: Record<string, number> = { "¥": 380, "¥¥": 680, "¥¥¥": 1150 };
// 序数·容忍型筛选：点一档=天花板，自动含更省/更易达的所有低档（花费、抵达难度、M78 天数）。
// 偏好型筛选（体力/冷热/地区/季节）不在此，走纯多选 OR。值按 低→高 排列。
// 注：cost/difficulty 仍是 3 档全量（数据枚举/卡面徽章不动）——M78 只裁撤了顶档在筛选
// chip 行的展示，选中次档仍正确排除顶档（¥¥ 天花板不含 ¥¥¥、一次中转天花板不含折腾）。
export const CEIL_GROUPS: Partial<Record<GroupKey, string[]>> = {
  cost: ["¥", "¥¥", "¥¥¥"],
  difficulty: ["直达", "一次中转", "折腾"],
  days: DAY_BUCKETS.map(b => b.key),
};

export const GROUP_NAMES: Partial<Record<GroupKey, string>> = {
  region: "地区", season: "季节", days: "天数", crowd: "冷热",
  cost: "花费", difficulty: "抵达难度", effort: "体力", companions: "同行",
};

export const SEASON_BY_MONTH = ["冬", "冬", "春", "春", "春", "夏", "夏", "夏", "秋", "秋", "秋", "冬"];
export const seasonForMonth = (month: number) => SEASON_BY_MONTH[month];

// 玩法节奏小清单：路线型目的地（玩法主体=沿线移动、按晚换落脚点），路书住宿建议按段订房。
// 从严收录——单基地+一晚特色住宿（林芝/神农架/漠河）与双基地（乐山峨眉/晋东南）不算路线型。
export const ROUTE_STAY = new Set(["chuanxi-loop", "hulunbuir", "gannan", "yili", "siguniangshan-danba", "altay"]); // M31：独库/青海湖环线已迁线路卡

export const TRIP_MAX = 10; // M54：一次行程最多站数 6→10（最长线路 4 站，散选 3 城再装整线即顶满旧上限）
export const CMP_MAX = 6; // M53：对比池上限 4→6
