// M66：皮肤 × 关键视图截图基线（design M66）。矩阵=主页/详情/扭蛋舞台/行程/路书 × 每套已注册
// 皮肤（SKIN_IDS，见 src/skins/registry.ts）；改坏任一皮肤 token/资产先于目检报警——
// 皮肤×视图×模块是乘法，目检不可扩展，这是它的机器等价物。用法见 tests/visual/README.md。
import { test, expect, type Page } from "@playwright/test";

// 不从 src/skins/registry.ts 导入 SKIN_IDS：该模块经 illustrations.ts 引用
// `import.meta.env.BASE_URL`（Vite 专属全局），Playwright 测试跑在纯 Node/esbuild 转译下没有这个
// 全局，import 时会直接抛错。字面量镜像 + drift-pin 断言（同 index.html 防闪烁内联脚本的先例，见
// src/skins/__tests__/registry.test.ts）比强行 import 更稳，两处一致性由该测试保证。
const SKIN_IDS = ["cream", "ink", "porcelain", "doodle"];

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
//
// F73：`toHaveScreenshot` 自带「等字体加载完」的稳定化步骤，若测试代码没有自己显式等过，这一步
// 会算进断言自身的（默认 5s）超时预算——`fullyParallel` 下多个页面并发抢字体请求/CPU 时，字体加载
// 变慢，等待步骤和断言超时撞在一起就会偶发超时（本轮实跑复现：cream-detail 首轮 9/10、次轮
// 10/10）。这里显式等 `document.fonts.ready` 让字体加载不再占用断言自己的超时窗口；playwright.config
// 另把 `toHaveScreenshot` 的 timeout 从默认 5s 提到 10s 兜底并发抢占的余量。
async function waitForImages(page: Page) {
  await page.evaluate(() => document.fonts.ready);
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

    // F75：M66 排期理由是「M63 舞台定型后建基线」，但此前只拍了待机态——开壳卡（揭晓）/蛋堆两块
    // M63 重做的主体画面从未进基线保护。抽中哪座城市本身是随机的，不适合做基线，但结果内容不是
    // 本用例要保护的对象；把 Math.random 钉成常数让 gachaPick 恒选池的第 0 个，画面（开壳卡布局/
    // 蛋堆小卡/满堆前的两颗态）就是确定的。roll() 靠 `matchMedia("(prefers-reduced-motion: reduce)")`
    // 判定是否跳过 ~2s 的老虎机动画同步结算——实测 Playwright context 的 `reducedMotion:'reduce'`
    // 选项并不会让这条 matchMedia 查询本身返回 true（与 CSS `@media` 层生效不是一回事，曾经在本
    // 测试踩过：两次点击其实各自走了完整动画，`waitForImages` 之后截到的是动画中途的不确定态）。
    // 直接在页面里覆写 matchMedia 强制该查询恒真，逼 roll() 走与 Vitest 单测（`vi.stubGlobal`）同款
    // 的同步路径，两次点击各自在返回前就已落堆，不依赖任何计时器。
    test("扭蛋舞台：揭晓+蛋堆（连扭两次）", async ({ page }) => {
      await openHome(page);
      await page.click("#fabGacha");
      await page.waitForSelector("#gachaOverlay.show");
      await page.evaluate(() => {
        const orig = window.matchMedia.bind(window);
        window.matchMedia = q => (q.includes("prefers-reduced-motion") ? ({ matches: true } as MediaQueryList) : orig(q));
        Math.random = () => 0;
      });
      await page.click("#gKnob");
      await page.click("#gKnob");
      // `.overlay` 自身是滚动容器（`overflow-y:auto`）；落堆后蛋堆区从 display:none 长出内容，
      // 容器变高触发浏览器的 scroll anchoring（保持刚点击过的 #gKnob 在视口内不跳动）——落地
      // 位置与两次点击间的精确时序相关，实测同样的操作序列会在「露出顶部」和「卷去顶部只剩机器
      // 往下」之间摇摆（连跑 5 轮见过两种结果），是与 M66 既有 flakiness 同类的「滚动位置不确定」
      // 噪声，与皮肤 token 是否改坏无关。截图前显式复位到容器顶部，消掉这个噪声源。
      await page.evaluate(() => { document.getElementById("gachaOverlay")!.scrollTop = 0; });
      await waitForImages(page);
      await expect(page).toHaveScreenshot(`${skin}-gacha-reveal.png`);
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
