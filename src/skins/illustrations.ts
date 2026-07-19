// 插画接入（M42，随山水皮肤 M46 首落地）。管线皮肤无关：url 只由 assetDir + 槽位名拼出，
// 后续皮肤只要产出同名槽位（mascot/gacha/empty/region-<slug>/decor-<name>）即可复用本文件，
// 不用改一行代码——这是「管线随首个带资产的皮肤落地、后续皮肤复用」的字面兑现（design M42）。
import { REGION_SLUG } from "../logic/constants";
import { DEFAULT_SKIN, SKINS } from "./registry";

const BASE = import.meta.env.BASE_URL;

// 装饰位小图（按皮肤分目录，见 tools/build_illustrations.py 的画布契约与命名）
export const illustSrc = (skinId: string, slot: string) => `${BASE}illustrations/${skinId}/${slot}.webp`;
// 目的地共享集（皮肤无关，M44 分批铺量，见 design「插画层」成本模型）
export const destPhotoSrc = (id: string) => `${BASE}illustrations/dest/${id}.webp`;
// 九区题头槽位名：region-<slug>，slug 见 REGION_SLUG（唯一真相源在 logic/constants.ts）
export const regionSlot = (region: string) => `region-${REGION_SLUG[region] || REGION_SLUG["江浙沪"]}`;

export const currentSkinId = (): string => document.documentElement.dataset.theme || DEFAULT_SKIN;

// 皮肤切换（含首帧）时对齐画面：① 把 [data-illust] 静态槽位（吉祥物/扭蛋机/空态/自由装饰件）
// 的 src 写成当前皮肤的资产地址；② 消费 registry 的 decorations 声明——带 data-deco 的槽位只有
// 该 key 在当前皮肤声明里为 true 才显示/取图，否则整个隐藏且不发请求（不是「装饰开关」摆设，
// 而是真的决定这三张图请不请求）。区域题头/目的地共享图用在 detail/gacha 等动态生成的模板里，
// 生成时已经直接按 currentSkinId() 拼好 src，不依赖本函数事后回填（那些元素本来就是每次重新生成）。
export function applySkinVisuals(skinId: string) {
  const decorations = SKINS.find(s => s.id === skinId)?.decorations || {};
  document.querySelectorAll<HTMLImageElement>("[data-illust]").forEach(img => {
    const decoKey = img.dataset.deco;
    if (decoKey && !decorations[decoKey]) {
      img.hidden = true;
      img.removeAttribute("src");
      return;
    }
    img.hidden = false;
    img.src = illustSrc(skinId, img.dataset.illust!);
  });
}

// error 事件不冒泡，必须用捕获阶段委托（同文档级 click 委托是同一习语，只是挂载阶段不同）。
// 三级回退，由 data-* 区分，按顺序检查：
//   ① data-fallback-src（一次性）→ 换一个 src 重试一次（详情页头图：目的地个图缺失时退到该城
//      所属大区的题头图；`fallbackTried` 防止「换过的 src 也 404」时死循环重换）；
//   ② data-fallback 是显式 emoji 字符 → 就地把 <img> 换成等大 <span>（目前只有空态一处，替换的
//      是本来就是 emoji 的位置，必须原样退回同一个 emoji 才叫「零回归」）；
//   ③ 其余（含 "hide"，未标注也按此处理）→ 移除最近的 [data-illust-frame] 容器——「缺图不硬占」
//      的字面实现：找不到该属性就退化为移除 img 自身（自框场景，见 index.html 的装饰件标记）。
export function wireIllustFallbacks() {
  document.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains("illust")) return;
    const fallbackSrc = img.dataset.fallbackSrc;
    if (fallbackSrc && !img.dataset.fallbackTried) {
      img.dataset.fallbackTried = "1";
      img.src = fallbackSrc;
      return;
    }
    const fb = img.dataset.fallback;
    if (fb && fb !== "hide") {
      const span = document.createElement("span");
      span.className = img.className.replace("illust", "illust-fallback");
      span.textContent = fb;
      img.replaceWith(span);
    } else {
      (img.closest<HTMLElement>("[data-illust-frame]") || img).remove();
    }
  }, true);
}
