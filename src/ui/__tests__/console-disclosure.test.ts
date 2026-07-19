// @vitest-environment happy-dom
// F57：M47 收纳 disclosure 的可访问性契约——按钮与面板的关联（aria-controls）和
// 展开状态（aria-expanded）必须真实存在并随切换同步，读屏才知道这个按钮控制什么、现在是开是合。
import { beforeEach, describe, expect, it } from "vitest";
import { buildConsole } from "../console";

describe("筛选台收纳 disclosure（F57）", () => {
  beforeEach(() => {
    document.body.innerHTML = '<section class="console" id="console"></section>';
    buildConsole();
  });

  it("初始折叠态：aria-expanded=false，aria-controls 指向真实存在的面板 id", () => {
    const btn = document.getElementById("filterToggle")!;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-controls")).toBe("consoleBody");
    expect(document.getElementById("consoleBody")).not.toBeNull();
  });

  it("点击展开 → aria-expanded=true 且面板 .open；再点收起 → 双双复位", () => {
    const btn = document.getElementById("filterToggle")!;
    const panel = document.getElementById("console")!;
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(panel.classList.contains("open")).toBe(true);
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(panel.classList.contains("open")).toBe(false);
  });
});
