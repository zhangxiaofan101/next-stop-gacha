/* M70：安装引导的环境四分（design M70「安装引导」）——纯判定，DOM/UA 探测值由
   ui/install.ts 采集后传入。 */
export type InstallMode = "hidden" | "prompt" | "ios" | "generic";

// 判序：已装（standalone 窗口）压倒一切；真·一键（捕获到 beforeinstallprompt）优先于
// UA 猜测——能直接装就不必读图文；iOS 永远不发该事件，图文引导是唯一路径；其余浏览器
// 给菜单通用指引。
export function installMode(env: { standalone: boolean; ios: boolean; canPrompt: boolean }): InstallMode {
  if (env.standalone) return "hidden";
  if (env.canPrompt) return "prompt";
  if (env.ios) return "ios";
  return "generic";
}

// iPadOS 13+ 的 Safari 默认「请求桌面网站」，UA 伪装成 Macintosh——触点数是官方认可的
// 区分手段（真 Mac 的 maxTouchPoints 为 0）。
export function isIOS(ua: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}
