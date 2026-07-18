import { toast } from "./toast";

export function copyText(txt: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => toast("已复制，去粘贴吧 📋"), () => fallbackCopy(txt));
  } else fallbackCopy(txt);
}
function fallbackCopy(txt: string) {
  const ta = document.createElement("textarea");
  ta.value = txt; document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); toast("已复制 📋"); } catch (e) { toast("复制失败，请手动选择文本"); }
  ta.remove();
}
