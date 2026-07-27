// M70：安装引导环境四分与 iOS 判定（design M70「安装引导」）
import { describe, expect, it } from "vitest";
import { installMode, isIOS } from "../install";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15";
const IPADOS_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15"; // iPadOS「请求桌面网站」
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0";

describe("installMode", () => {
  it("standalone 压倒一切——已装成 App 就整块隐藏，别教人装已经装了的东西", () => {
    expect(installMode({ standalone: true, ios: false, canPrompt: false })).toBe("hidden");
    expect(installMode({ standalone: true, ios: true, canPrompt: true })).toBe("hidden");
  });

  it("捕获到 beforeinstallprompt 就给真·一键——能直接装不必读图文", () => {
    expect(installMode({ standalone: false, ios: false, canPrompt: true })).toBe("prompt");
  });

  it("iOS 永远等不来一键事件，图文引导是唯一路径", () => {
    expect(installMode({ standalone: false, ios: true, canPrompt: false })).toBe("ios");
  });

  it("其余浏览器给菜单通用指引", () => {
    expect(installMode({ standalone: false, ios: false, canPrompt: false })).toBe("generic");
  });
});

describe("isIOS", () => {
  it("iPhone/iPad UA 直接命中", () => {
    expect(isIOS(IPHONE, 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)", 5)).toBe(true);
  });

  it("iPadOS 桌面模式伪装 Macintosh——靠多触点识破；真 Mac（0 触点）不误伤", () => {
    expect(isIOS(IPADOS_DESKTOP, 5)).toBe(true);
    expect(isIOS(IPADOS_DESKTOP, 0)).toBe(false);
  });

  it("安卓不命中（一键路径归 beforeinstallprompt，与 UA 无关）", () => {
    expect(isIOS(ANDROID, 5)).toBe(false);
  });
});
