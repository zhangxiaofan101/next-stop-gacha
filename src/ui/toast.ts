import { $ } from "./dom";

let timer: number | undefined;
export function toast(msg: string) {
  const t = $("toast");
  $("toastMsg").textContent = msg; t.style.display = "flex";
  clearTimeout(timer); timer = window.setTimeout(() => t.style.display = "none", 1800);
}
