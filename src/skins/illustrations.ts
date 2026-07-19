// 插画接入（M42，随山水皮肤 M46 首落地）。管线皮肤无关：url 只由 assetDir + 槽位名拼出，
// 后续皮肤只要产出同名槽位（mascot/gacha/empty/region-<slug>/decor-<name>）即可复用本文件，
// 不用改一行代码——这是「管线随首个带资产的皮肤落地、后续皮肤复用」的字面兑现（design M42）。
import { REGION_SLUG } from "../logic/constants";
import { DEFAULT_SKIN, SKINS, type SkinDeclaration } from "./registry";

const BASE = import.meta.env.BASE_URL;

// skinId → 该皮肤声明的 assetDir（F58：此前 illustSrc 直接拿 skinId 拼路径，assetDir 字段从未
// 被读过——两个皮肤恰好 id===assetDir 才没露馅。skins 参数默认吃真实 SKINS，测试可传自定义数组
// 造 id!==assetDir 的探针，不用动全局注册表）。查不到声明时退回 skinId 本身（未注册皮肤兜底）。
export const assetDirFor = (skinId: string, skins: SkinDeclaration[] = SKINS): string =>
  skins.find(s => s.id === skinId)?.assetDir ?? skinId;
// 装饰位小图——参数是 assetDir（已解析好的目录名），不是 skinId；调用方一律先过 assetDirFor
// （见下方 applySkinVisuals 及 ui/detail.ts、ui/gacha.ts），见 tools/build_illustrations.py 的
// 画布契约与命名
export const illustSrc = (assetDir: string, slot: string) => `${BASE}illustrations/${assetDir}/${slot}.webp`;
// 目的地共享集（皮肤无关，M44 分批铺量，见 design「插画层」成本模型）
export const destPhotoSrc = (id: string) => `${BASE}illustrations/dest/${id}.webp`;
// 九区题头槽位名：region-<slug>，slug 见 REGION_SLUG（唯一真相源在 logic/constants.ts）
export const regionSlot = (region: string) => `region-${REGION_SLUG[region] || REGION_SLUG["江浙沪"]}`;

export const currentSkinId = (): string => document.documentElement.dataset.theme || DEFAULT_SKIN;

// 皮肤切换（含首帧）时对齐画面：① 把 [data-illust] 静态槽位（吉祥物/扭蛋机/空态/自由装饰件）
// 的 src 写成当前皮肤（真解析出的 assetDir，F58）的资产地址；② 消费 registry 的 decorations 声明
// ——带 data-deco 的槽位只有该 key 在当前皮肤声明里为 true 才显示/取图，否则整个隐藏且不发请求
// （不是「装饰开关」摆设，而是真的决定这三张图请不请求）；③ 复位上一次可能残留的缺图回退状态
// （F59：wireIllustFallbacks 只隐藏不销毁节点，这里负责在皮肤切换时把它「叫醒」重试——清
// fallbackTried、摘掉遗留的 emoji 兜底 span、恢复 frame/img 可见性，再重新赋 src。哪怕新皮肤
// 仍然缺图，重试会再次触发 error 走一遍回退，不会比切换前更差；但只要目标皮肤真的有资产，
// 之前因为「切到过没有资产的皮肤」而被隐藏的槽位就能重新显示——这是双皮肤来回切换不永久丢
// 插画的关键）。区域题头/目的地共享图用在 detail/gacha 等动态生成的模板里，生成时已经直接按
// currentSkinId() + assetDirFor() 拼好 src，不依赖本函数事后回填（那些元素本来就是每次重新生成）。
export function applySkinVisuals(skinId: string) {
  const decorations = SKINS.find(s => s.id === skinId)?.decorations || {};
  const dir = assetDirFor(skinId);
  document.querySelectorAll<HTMLImageElement>("[data-illust]").forEach(img => {
    const decoKey = img.dataset.deco;
    if (decoKey && !decorations[decoKey]) {
      img.hidden = true;
      img.removeAttribute("src");
      return;
    }
    delete img.dataset.fallbackTried;
    if (img.nextElementSibling?.classList.contains("illust-fallback")) {
      img.nextElementSibling.remove();
    }
    const frame = img.closest<HTMLElement>("[data-illust-frame]");
    if (frame) frame.hidden = false;
    img.hidden = false;
    img.src = illustSrc(dir, img.dataset.illust!);
  });
}

// error 事件不冒泡，必须用捕获阶段委托（同文档级 click 委托是同一习语，只是挂载阶段不同）。
// 三级回退，由 data-* 区分，按顺序检查：
//   ① data-fallback-src（一次性）→ 换一个 src 重试一次（详情页头图：目的地个图缺失时退到该城
//      所属大区的题头图；`fallbackTried` 防止「换过的 src 也 404」时死循环重换）；
//   ② data-fallback 是显式 emoji 字符 → 就地在同级插入等大 <span> 顶上视觉，img 本身只隐藏不
//      摘除（目前只有空态一处，插入的兜底必须原样是同一个 emoji 才叫「零回归」）；
//   ③ 其余（含 "hide"，未标注也按此处理）→ 隐藏最近的 [data-illust-frame] 容器（找不到该属性
//      就退化为隐藏 img 自身，自框场景，见 index.html 的装饰件标记）。
// F59：终态一律「隐藏」不「删除/替换」——img 与其 data-illust 元数据必须留在 DOM 里，否则皮肤
// 切回来时 applySkinVisuals 的 [data-illust] 查询会找不到这个槽位，永远恢复不了（双皮肤来回切换
// 的场景：山水下 mascot 加载成功 → 切奶油因无资产 404 → 若这里把节点删了，切回山水也没救）。
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
    img.hidden = true;
    const fb = img.dataset.fallback;
    if (fb && fb !== "hide") {
      if (!img.nextElementSibling?.classList.contains("illust-fallback")) {
        const span = document.createElement("span");
        span.className = img.className.replace("illust", "illust-fallback");
        span.textContent = fb;
        img.insertAdjacentElement("afterend", span);
      }
    } else {
      const frame = img.closest<HTMLElement>("[data-illust-frame]");
      if (frame) frame.hidden = true;
    }
  }, true);
}
