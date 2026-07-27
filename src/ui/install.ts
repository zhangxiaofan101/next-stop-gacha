/* M70：分享面板「装成 App」区块的 DOM 侧——环境判定在 logic/install（纯函数有单测）。
   beforeinstallprompt 只在页面生命周期里发一次且不重发，必须在 wireEvents 同一批（首个
   同步 tick）挂监听抢下来，openShare 时按「抢没抢到」决定渲染一键按钮还是图文指引。 */
import { installMode, isIOS } from "../logic/install";
import { $ } from "./dom";
import { toast } from "./toast";

// Chrome 系专有事件，lib.dom 无类型；只消费 prompt()，窄声明即可
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<unknown> };
let deferredPrompt: BeforeInstallPromptEvent | null = null;

const COPY = {
  offline: "装好后全屏打开，断网也能筛选、扭蛋、看路书（天气和短链要联网）。",
  ios: "用 Safari 打开本页 → 点底部「分享」按钮 → 选「添加到主屏幕」。",
  generic: "在浏览器菜单里找「安装应用」或「添加到主屏幕」。",
};

export function wireInstallGuide() {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // 拦下浏览器自带的安装横幅，入口收进分享面板（拍板：不做首访打扰）
    deferredPrompt = e as BeforeInstallPromptEvent;
    renderInstallBlock();
  });
  addEventListener("appinstalled", () => {
    deferredPrompt = null;
    toast("装好啦，去主屏幕找咔啦 🎉");
    renderInstallBlock();
  });
  $("installBtn").addEventListener("click", async () => {
    // prompt() 一次性——无论用户装没装，事件都作废，按钮随之退场换图文指引
    const p = deferredPrompt;
    deferredPrompt = null;
    if (p) await p.prompt().catch(() => {});
    renderInstallBlock();
  });
}

export function renderInstallBlock() {
  const mode = installMode({
    standalone: matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true,
    ios: isIOS(navigator.userAgent, navigator.maxTouchPoints || 0),
    canPrompt: !!deferredPrompt,
  });
  const block = $("installBlock");
  if (mode === "hidden") { block.style.display = "none"; return; }
  block.style.display = "";
  $("installBtn").style.display = mode === "prompt" ? "" : "none";
  $("installHint").textContent = mode === "prompt" ? COPY.offline
    : `${mode === "ios" ? COPY.ios : COPY.generic}${COPY.offline}`;
}
