import { $ } from "./dom";

let timer: number | undefined;
// M86：toast 升级为可带一枚内嵌胶囊动作（撤销/查看）。带 action 时存活期升到 4000ms（撤销/查看
// 都需要读完文案再决定要不要点，1.8s 太短）；不带 action 的既有调用一律维持旧行为（1.8s，
// duration 可显式覆盖两种情况）。toastAction 是单例按钮，每次调用直接整体替换 onclick——
// 不用 addEventListener，避免连续多次 toast() 在同一个按钮上叠加旧监听器。
export function toast(msg: string, opts?: { action?: { label: string; fn: () => void }; duration?: number }) {
  const t = $("toast");
  $("toastMsg").textContent = msg;
  const actionBtn = $<HTMLButtonElement>("toastAction");
  if (opts?.action) {
    const { label, fn } = opts.action;
    actionBtn.textContent = label;
    actionBtn.hidden = false;
    actionBtn.onclick = () => { clearTimeout(timer); t.style.display = "none"; fn(); };
  } else {
    actionBtn.hidden = true;
    actionBtn.textContent = "";
    actionBtn.onclick = null;
  }
  t.style.display = "flex";
  clearTimeout(timer);
  timer = window.setTimeout(() => t.style.display = "none", opts?.duration ?? (opts?.action ? 4000 : 1800));
}
