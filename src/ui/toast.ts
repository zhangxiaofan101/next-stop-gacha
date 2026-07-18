import { $ } from "./dom";

let timer: number | undefined;
export function toast(msg: string) {
  const t = $("toast");
  t.textContent = msg; t.style.display = "block";
  clearTimeout(timer); timer = window.setTimeout(() => t.style.display = "none", 1800);
}
