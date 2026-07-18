/* 彩带 */
import { $ } from "./dom";

export function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $<HTMLCanvasElement>("confettiCanvas");
  const ctx = cv.getContext("2d")!;
  cv.width = innerWidth; cv.height = innerHeight; cv.style.display = "block";
  const colors = ["#ff9c3f", "#58b7f0", "#7bc86c", "#f79ec4", "#ffd95c", "#b39deb"];
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
