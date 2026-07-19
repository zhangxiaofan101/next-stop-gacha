/* 彩带 */
import { $ } from "./dom";

// M45：彩带六色不再硬编码，改在起飞那一刻读当前皮肤的 token 计算值——换肤后彩带跟着换色；
// 兜底值＝奶油皮肤原色（token 读取异常/皮肤没定义该 token 时不至于变成透明碎屑）。
const CONFETTI_TOKENS: [string, string][] = [
  ["--orange", "#ff9c3f"], ["--blue", "#58b7f0"], ["--green", "#7bc86c"],
  ["--pink", "#f79ec4"], ["--yellow", "#ffd95c"], ["--purple", "#b39deb"],
];
function confettiColors(): string[] {
  const cs = getComputedStyle(document.documentElement);
  return CONFETTI_TOKENS.map(([name, fallback]) => cs.getPropertyValue(name).trim() || fallback);
}

export function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $<HTMLCanvasElement>("confettiCanvas");
  const ctx = cv.getContext("2d")!;
  cv.width = innerWidth; cv.height = innerHeight; cv.style.display = "block";
  const colors = confettiColors();
  const ps = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 260,
    y: innerHeight * 0.3,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3,
    s: Math.random() * 8 + 4,
    c: colors[Math.floor(Math.random() * colors.length)],
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
  }));
  let frames = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
      ctx.restore();
    });
    if (++frames < 110) requestAnimationFrame(tick);
    else cv.style.display = "none";
  })();
}
