/* M26 分享/备份（打卡+收藏跨设备迁移）——payload/合并语义在 logic/share，这里是链接/QR/JSON 三通道的 DOM 侧。
   M40 短链（后端增强形态）也走这里：生成短链复用同一份 marks payload，打开短链复用同一条并集合并路径。
   M41 同步码云同步（design「后端·同步码云同步」）同样复用 mergeUnion/parseShare 这套并集合并信任边界——
   区别只是触发方式（用户主动点「同步」，不是被动打开一条别人发来的链接），故直接合并不再弹确认条。 */
import { getOrigin, originById } from "../logic/origin";
import { sanitizeTripItems } from "../logic/persist";
import { qrEncode } from "../logic/qr";
import { mergeUnion, parseImportJSON, parseShare, serializeShare, type SharePayload } from "../logic/share";
import { createMarksShareLink, fetchShare } from "../services/shareApi";
import { createSyncCode, pullSync, pushSync } from "../services/syncApi";
import { clearSyncCode, DATA, getSyncCode, saveLS, setSyncCode, state } from "../store";
import { copyText } from "./clipboard";
import { $ } from "./dom";
import { render } from "./render";
import { switchOrigin } from "./origin";
import { openSharedRoadbook } from "./roadbook";
import { toast } from "./toast";

const SHARE_QR_MAX = 1200; // QR 40-M 上限 2331 字节，留足裕量；超了提示走 JSON
export function shareLink() {
  return location.href.split("#")[0] + "#s=" + serializeShare({ favs: state.favs, visited: state.visited });
}
export function shareJSON() {
  return JSON.stringify({ favs: state.favs, visited: state.visited });
}
function mergeRecords(p: SharePayload) { // 并集合并，绝不覆盖本机已有；行程/对比不动
  const r = mergeUnion({ favs: state.favs, visited: state.visited }, p);
  state.favs = r.favs;
  state.visited = r.visited;
  saveLS(); render();
  toast(r.addedFavs || r.addedVisited ? `已合并：新收藏 ${r.addedFavs} · 新打卡 ${r.addedVisited} 🎒` : "这些记录本机都有啦");
}
function showImportBar(p: SharePayload) {
  const bar = $("importBar");
  $("importBarText").textContent = `收到一份迁移记录：♥ ${p.favs.length} 收藏 · 👣 ${p.visited.length} 打卡。合并进本机？`;
  bar.style.display = "flex";
  $("importYes").onclick = () => { bar.style.display = "none"; mergeRecords(p); };
  $("importNo").onclick = () => { bar.style.display = "none"; };
}

export function checkShareHash() { // 带 #s= 打开页面：顶部确认条，点「合并」才写入；无论如何都清掉 hash
  if (!location.hash.startsWith("#s=")) return;
  const p = parseShare(decodeURIComponent(location.hash.slice(3)), DATA);
  history.replaceState(null, "", location.pathname + location.search);
  if (!p || (!p.favs.length && !p.visited.length)) return;
  showImportBar(p);
}

// M40：短链是 ①/② 的增强形态——`?sc=` 打开页面时向 /api/share/:code 取回 payload 再走同一套渲染/合并。
// 任何失败（码不存在/过期/API 未配置或挂掉）一律静默不打扰——用户可能压根没点过分享，只是普通打开页面。
export async function checkShareCode() {
  const url = new URL(location.href);
  const code = url.searchParams.get("sc");
  if (!code) return;
  url.searchParams.delete("sc");
  history.replaceState(null, "", url.pathname + url.search + url.hash);

  const share = await fetchShare(code);
  if (!share) return;
  if (share.type === "marks") {
    const p = parseShare(`f:${(share.payload.favs || []).join(".")};v:${(share.payload.visited || []).join(".")}`, DATA);
    if (!p || (!p.favs.length && !p.visited.length)) return;
    showImportBar(p);
  } else {
    const trip = sanitizeTripItems(share.payload.trip, DATA);
    if (!trip.length) return;
    // F78：短链固化了分享者的出发地——先切到该视角再渲染，否则访客的默认（上海）视角会把首末段/
    // 交通/预算按「上海往返」无声重算，违反「分享副本保持原义」。无 originId 字段=旧版短链，按 M22
    // 前唯一存在的基座上海解释。
    const oid = share.payload.originId ?? "shanghai";
    if (oid !== getOrigin().id) {
      // persist:false 不写 localStorage——「按分享者视角看一眼」绝不覆盖访客自己的出发地偏好；
      // silent:true 关掉 switchOrigin 默认切换 toast，换成下面这条解释「视角为何变了」的定制提示。
      const ok = await switchOrigin(oid, { silent: true, persist: false });
      if (ok) {
        toast(`路书按分享者的出发地展示：从${originById(oid)!.name}出发 🛫`);
      } else {
        // 切换失败（oid 未注册/未发布/fetch 失败）——分享功能哲学=任何失败都优雅降级：仍打开路书，
        // 但诚实告知它按访客当前出发地重算（switchOrigin 失败不改 getOrigin()，与路书实际渲染口径一致）。
        toast(`分享者的出发地视角加载失败，路书按从${getOrigin().name}出发重算`);
      }
    }
    openSharedRoadbook(trip, share.payload.tripStart || "");
  }
}

export async function generateShareCode() {
  const code = await createMarksShareLink({ favs: state.favs, visited: state.visited });
  if (!code) { toast("短链生成失败，用二维码或复制 JSON 代替"); return; }
  copyText(`${location.origin}${import.meta.env.BASE_URL}?sc=${code}`);
}
export function openShare() {
  $("shareStats").textContent = `本机现有：♥ ${state.favs.length} 个收藏 · 👣 ${state.visited.length} 个打卡`;
  $("qrWrap").style.display = "none";
  renderSyncStatus();
  $("shareOverlay").classList.add("show");
}

function renderSyncStatus() {
  const code = getSyncCode();
  $<HTMLInputElement>("syncCodeInput").value = code;
  $("syncStatus").textContent = code ? `本机已绑定同步码 ${code}` : "本机尚未绑定同步码";
  $("syncForgetBtn").style.display = code ? "" : "none";
}

// 用户主动点「同步」：留空=生成一个新码（种子=本机当前数据）；填了码（新绑或已绑）=拉取→并集
// 合并进本机→把合并后的结果整份写回去，让远端始终是「见过的并集」，双设备各自同步几次后自然收敛。
export async function syncNow() {
  const input = $<HTMLInputElement>("syncCodeInput");
  const typed = input.value.trim();
  const saved = getSyncCode();

  if (!typed && !saved) {
    const code = await createSyncCode({ favs: state.favs, visited: state.visited });
    if (!code) { toast("同步码生成失败，请稍后重试"); return; }
    setSyncCode(code);
    renderSyncStatus();
    copyText(code);
    toast(`已生成同步码并复制：${code}（记得抄到另一台设备）`);
    return;
  }

  const code = typed || saved;
  if (!/^\d{12}$/.test(code)) { toast("同步码应为 12 位数字"); return; }

  const pulled = await pullSync(code);
  if (!pulled.ok) {
    // F50：区分「码确实不存在/已过期」和「单纯网络抖动」——前者如果就是本机当前绑定的那个码，
    // 直接自动解绑，不能让用户对着一个死码反复点同步却猜不到问题在哪（同步码严格 POST-only，
    // 没有「PUT 复活」这回事，见 cloudflare/api.mjs 顶部注释）。
    if (pulled.reason === "not_found") {
      if (code === saved) {
        clearSyncCode();
        renderSyncStatus();
        toast("这个同步码已不存在（可能已过期），已自动解绑本机——重新点「同步」即可生成新码");
      } else {
        toast("这个同步码不存在，检查一下是不是输错了");
      }
    } else {
      toast("同步失败：网络异常，本机数据未受影响");
    }
    return;
  }

  const remote = pulled.data;
  const p = parseShare(`f:${remote.favs.join(".")};v:${remote.visited.join(".")}`, DATA);
  if (p && (p.favs.length || p.visited.length)) {
    const r = mergeUnion({ favs: state.favs, visited: state.visited }, p);
    state.favs = r.favs; state.visited = r.visited;
    saveLS(); render();
  }

  setSyncCode(code);
  renderSyncStatus();

  const pushed = await pushSync(code, { favs: state.favs, visited: state.visited });
  if (pushed) {
    // 服务器端现在做并集合并（design/state F48）：回传的结果可能比本机这份更全——另一台设备
    // 可能在本机 GET 之后、PUT 之前也推送过——用它再并集一次，不能只信本机刚推上去的那份。
    const p2 = parseShare(`f:${pushed.favs.join(".")};v:${pushed.visited.join(".")}`, DATA);
    if (p2) {
      const r2 = mergeUnion({ favs: state.favs, visited: state.visited }, p2);
      state.favs = r2.favs; state.visited = r2.visited;
      saveLS(); render();
    }
  }
  toast(pushed
    ? `已同步：♥ ${state.favs.length} 收藏 · 👣 ${state.visited.length} 打卡`
    : "已合并到本机，但回传服务器失败——下次同步会自动补上");
}

export function forgetSync() {
  clearSyncCode();
  $<HTMLInputElement>("syncCodeInput").value = "";
  renderSyncStatus();
  toast("已解绑本机同步码（服务器数据不受影响，换个设备粘贴同一个码仍能同步）");
}
export function renderShareQR() { // 二维码默认收起，点按钮才展开（用户要求：别大别占地方）
  const wrap = $("qrWrap"), hint = $("qrHint"), cv = $<HTMLCanvasElement>("qrCanvas");
  if (wrap.style.display !== "none") { wrap.style.display = "none"; return; }
  wrap.style.display = "";
  const link = shareLink();
  try {
    if (link.length > SHARE_QR_MAX) throw new Error("too long");
    const q = qrEncode(link);
    const scale = 4, quiet = 4, n = q.size + quiet * 2;
    cv.width = cv.height = n * scale;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#000";
    q.modules.forEach((row: number[], r: number) => row.forEach((v, c) => { if (v) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale); }));
    cv.style.display = "";
    hint.textContent = "手机扫码打开页面，点「合并」即可";
  } catch (e) {
    cv.style.display = "none";
    hint.textContent = "记录太多，二维码装不下——用「复制 JSON」迁移吧";
  }
}
export function importJSON() {
  const box = $<HTMLTextAreaElement>("importBox");
  const r = parseImportJSON(box.value, DATA);
  if (r && "error" in r) {
    toast(r.error === "parse" ? "JSON 没解析出来，检查一下粘贴内容" : '格式不对——需要 {"favs":[…],"visited":[…]}');
    return;
  }
  if (!r || (!r.favs.length && !r.visited.length)) { toast("没找到可导入的记录"); return; }
  mergeRecords(r);
  box.value = "";
}
