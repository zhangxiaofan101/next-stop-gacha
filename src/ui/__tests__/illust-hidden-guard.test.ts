// @vitest-environment happy-dom
// [interrupt] F59 回退残留（2026-07-20 生产实证）：wireIllustFallbacks 的 hide 分支从「移除 DOM 节点」
// 改成「保留节点、置 hidden=true」（M45/M46 review 响应一轮），但 style.css 的 `.illust { display:
// block }` 是普通作者规则、`[hidden]` 只是浏览器默认样式表的默认值——作者样式无条件覆盖默认样式表，
// 于是 hidden 的 <img> 仍占 92×92 布局盒、露出破图框。守卫 `.illust[hidden] { display: none }` 用
// 同等特异度但更具体的选择器把 hidden 态的优先级找回来。本测试加载真实 src/style.css（不是手抄片
// 段），回归其规则被误删/误改时必须真的失败。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function loadStyleInto(doc: Document) {
  const css = readFileSync(join(process.cwd(), "src/style.css"), "utf8");
  const style = doc.createElement("style");
  style.textContent = css;
  doc.head.appendChild(style);
}

describe(".illust[hidden] 布局盒守卫（F59 回退残留）", () => {
  it("hidden=true 的 .illust 计算 display 为 none（不占布局盒）", () => {
    loadStyleInto(document);
    document.body.innerHTML = `<div class="g-illust"><img class="illust" hidden></div>`;
    const img = document.querySelector<HTMLImageElement>(".illust")!;
    expect(img.hidden).toBe(true);
    expect(getComputedStyle(img).display).toBe("none");
  });

  it("未 hidden 的 .illust 仍是 display:block（守卫不误伤正常显示态）", () => {
    loadStyleInto(document);
    document.body.innerHTML = `<div class="g-illust"><img class="illust" src="x.webp"></div>`;
    const img = document.querySelector<HTMLImageElement>(".illust")!;
    expect(img.hidden).toBe(false);
    expect(getComputedStyle(img).display).toBe("block");
  });
});
