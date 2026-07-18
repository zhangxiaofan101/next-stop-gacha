/* M26 分享/备份（打卡+收藏跨设备迁移）——payload/合并语义在 logic/share，这里是链接/QR/JSON 三通道的 DOM 侧 */
import { qrEncode } from "../logic/qr";
import { mergeUnion, parseImportJSON, parseShare, serializeShare, type SharePayload } from "../logic/share";
import { DATA, saveLS, state } from "../store";
import { $ } from "./dom";
import { render } from "./render";
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
export function checkShareHash() { // 带 #s= 打开页面：顶部确认条，点「合并」才写入；无论如何都清掉 hash
  if (!location.hash.startsWith("#s=")) return;
  const p = parseShare(decodeURIComponent(location.hash.slice(3)), DATA);
  history.replaceState(null, "", location.pathname + location.search);
  if (!p || (!p.favs.length && !p.visited.length)) return;
  const bar = $("importBar");
  $("importBarText").textContent = `收到一份迁移记录：♥ ${p.favs.length} 收藏 · 👣 ${p.visited.length} 打卡。合并进本机？`;
  bar.style.display = "flex";
  $("importYes").onclick = () => { bar.style.display = "none"; mergeRecords(p); };
  $("importNo").onclick = () => { bar.style.display = "none"; };
}
export function openShare() {
  $("shareStats").textContent = `本机现有：♥ ${state.favs.length} 个收藏 · 👣 ${state.visited.length} 个打卡`;
  $("qrWrap").style.display = "none";
  $("shareOverlay").classList.add("show");
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
