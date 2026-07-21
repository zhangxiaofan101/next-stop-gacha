// M66：皮肤 × 关键视图截图基线（design M66）。矩阵=主页/详情/扭蛋舞台/行程/路书 × 每套已注册
// 皮肤（SKIN_IDS，见 src/skins/registry.ts）；改坏任一皮肤 token/资产先于目检报警——
// 皮肤×视图×模块是乘法，目检不可扩展，这是它的机器等价物。用法见 tests/visual/README.md。
import { test, expect, type Page } from "@playwright/test";

// 不从 src/skins/registry.ts 导入 SKIN_IDS：该模块经 illustrations.ts 引用
// `import.meta.env.BASE_URL`（Vite 专属全局），Playwright 测试跑在纯 Node/esbuild 转译下没有这个
// 全局，import 时会直接抛错。字面量镜像 + drift-pin 断言（同 index.html 防闪烁内联脚本的先例，见
// src/skins/__tests__/registry.test.ts）比强行 import 更稳，两处一致性由该测试保证。
const SKIN_IDS = ["cream", "ink"];

// 天气是唯一的外部实时接入（Open-Meteo），详情页会异步发起；截图必须是网络无关的确定态——
// 阻断后走既有静默降级路径（design「实时天气」），不是伪造成功响应。
async function blockWeather(page: Page) {
  await page.route("https://api.open-meteo.com/**", route => route.abort());
}

async function setSkin(page: Page, skin: string) {
  await page.addInitScript(s => {
    try { localStorage.setItem("nextstop_skin_v1", s); } catch { /* noop */ }
  }, skin);
}

// 页面有两处真实 `new Date()` 读数：store.ts 模块顶层算 CUR_SEASON（决定卡片「当季」徽章，
// 影响主页截图）、roadbook.ts 渲染路书时嵌「生成于 YYYY.M.D」文案（影响路书截图）——不冻结时
// 基线会随日历天然漂移，把「今天变了」误判成「视觉回归」。固定钟必须在 page.goto 之前调用
// （在页面脚本第一次读 Date 之前生效），冻结到哪一天并不重要，只要往后恒定。
async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-07-21T04:00:00Z"));
}

// 弹层背板 .overlay 是半透明 tint（.38 alpha）+ backdrop-filter:blur(5px)（style.css）——两个问题
// 叠加：① GPU 合成的模糊本身在无头浏览器里跑不出两次逐像素一致的结果；② 就算去掉模糊，.38 透明度
// 仍让背后页面内容透出来，而点击「加入行程」「排行程」这些按钮会把对应卡片滚动进视口，滚动落点
// 跟点击前的布局/时序相关、并不总是同一行（实测两次截图背景分别停在「杭州」区与「扬州」区）——
// 于是「背景透出的是哪张卡」逐次不同，反而成了主噪声源（比 blur 噪声更大）。测试环境把背板换成
// 各皮肤 --paper 纯色全不透明，背后是谁、滚到哪都不再透出来；只对截图确定性负责，不代表这条
// CSS 规则本身有问题。
async function disableBackdropBlur(page: Page) {
  await page.addStyleTag({ content: ".overlay { backdrop-filter: none !important; background: var(--paper) !important; }" });
}

// toHaveScreenshot 的「连续两帧一致」稳定性判定只保证内部一致，保证不了「图片真的加载完了」——
// 详情页目的地头图这类同源静态图，若截图早于 decode 完成，两次跑出的「稳定」帧可能是不同的
// 中间态（占位 vs 已解码），彼此和基线都对不上（实测 ink-detail 复现过）。截图前显式等落定
// （成功或失败，两者都是终态，不区分）——只等**当前视口内**的 <img>：主页网格 267+ 城市卡多数
// `loading=lazy` 且在首屏外，永远不会触发 load/error，等全部 `document.images` 会挂到超时。
async function waitForImages(page: Page) {
  await page.evaluate(() => Promise.all(
    Array.from(document.images)
      .filter(img => {
        const r = img.getBoundingClientRect();
        return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
      })
      .map(img => (img.complete ? Promise.resolve() : new Promise<void>(res => { img.onload = img.onerror = () => res(); })))
  ));
}

async function openHome(page: Page) {
  await page.goto("./");
  await disableBackdropBlur(page);
  await page.waitForSelector("#grid .card");
  await waitForImages(page);
}

for (const skin of SKIN_IDS) {
  test.describe(`皮肤=${skin}`, () => {
    test.beforeEach(async ({ page }) => {
      await setSkin(page, skin);
      await blockWeather(page);
      await freezeClock(page);
    });

    test("主页", async ({ page }) => {
      await openHome(page);
      await expect(page).toHaveScreenshot(`${skin}-home.png`);
    });

    test("详情", async ({ page }) => {
      await openHome(page);
      await page.click('[data-id="hangzhou"]');
      await page.waitForSelector("#detailOverlay.show");
      await waitForImages(page);
      await expect(page).toHaveScreenshot(`${skin}-detail.png`);
    });

    test("扭蛋舞台", async ({ page }) => {
      await openHome(page);
      await page.click("#fabGacha");
      await page.waitForSelector("#gachaOverlay.show");
      await waitForImages(page);
      // 拍未扭之前的确定态（「？？？」+ 待机气泡）——扭出的结果是随机的，不适合做基线
      await expect(page).toHaveScreenshot(`${skin}-gacha.png`);
    });

    test("行程", async ({ page }) => {
      await openHome(page);
      await page.click('[data-id="hangzhou"] [data-trip="hangzhou"]');
      await page.click('[data-id="suzhou"] [data-trip="suzhou"]');
      await page.click("#tripGo");
      await page.waitForSelector("#tripOverlay.show");
      await waitForImages(page);
      await expect(page).toHaveScreenshot(`${skin}-trip.png`);
    });

    test("路书", async ({ page }) => {
      await openHome(page);
      await page.click('[data-id="hangzhou"] [data-trip="hangzhou"]');
      await page.click('[data-id="suzhou"] [data-trip="suzhou"]');
      await page.click("#tripGo");
      await page.waitForSelector("#tripOverlay.show");
      await page.click("#makeRoadbookBtn");
      await page.waitForSelector("#rbOverlay.show");
      await waitForImages(page);
      await expect(page).toHaveScreenshot(`${skin}-roadbook.png`);
    });
  });
}
