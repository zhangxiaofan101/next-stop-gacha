// /api/* 请求级测试。跑在 @cloudflare/vitest-pool-workers 的本地 workerd 沙箱里（见
// vitest.workers.config.ts），`env` 是 wrangler.jsonc 里声明的真实绑定的本地模拟——APP_KV 是真
// 本地 KV、RATE_LIMITER/SYNC_CODE_STORE 是真 Durable Object（真的 input gate 串行化，不是手写
// fakeKV 能模拟的）。每个 test() 自动拿到隔离存储，互不污染，不需要手动重置。
//
// F47/F48（2026-07-19 codex 复核第二轮）：手写的 fakeKV 证明不了「同 key 每秒限写 1 次」和「两个
// 并发 PUT 到底会不会丢数据」这类真实约束/竞态——codex 用受限频 fake 和并发 barrier fake 分别把
// 限流失效、并集合并丢数据都实测复现了。这个文件换成真实 DO 语义后，能真正对着「两个请求同时打到
// 同一个 DO 实例」写回归（见 "F48 regression"/"F47 regression" 两条），而不是只能证明「顺序请求时
// 逻辑对」。
import { env, runDurableObjectAlarm } from "cloudflare:test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { handleRequest } from "../cloudflare/worker.mjs";

function req(pathname, opts) {
  return new Request(`https://lab.medspiral.com/next-stop-gacha${pathname}`, opts);
}
function post(pathname, body, headers) {
  return req(pathname, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}
function put(pathname, body, headers) {
  return req(pathname, {
    method: "PUT",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

// randomCode()/randomSyncCode() 都是 `crypto.getRandomValues(new Uint8Array(N))` 逐字节取模映射
// 字符——固定返回全 0 字节，两套字母表 [0] 分别是 "2"（share）和 "0"（sync），可以稳定复现同一个候选码。
function stubRandomBytesOnce(byteValue) {
  const spy = vi.spyOn(crypto, "getRandomValues").mockImplementationOnce((arr) => {
    arr.fill(byteValue);
    return arr;
  });
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("POST /api/share creates a well-formed 6-char code and GET roundtrips a marks payload", async () => {
  const body = { type: "marks", payload: { favs: ["hangzhou"], visited: ["chengdu"] } };
  const createRes = await handleRequest(post("/api/share", body), env);
  expect(createRes.status).toBe(200);
  const { code } = await createRes.json();
  expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);

  const getRes = await handleRequest(req(`/api/share/${code}`), env);
  expect(getRes.status).toBe(200);
  expect(await getRes.json()).toEqual(body);
});

test("GET roundtrips a trip payload", async () => {
  const body = { type: "trip", payload: { trip: [{ id: "hangzhou", days: 3 }, { id: "chengdu", days: 2, r: "route-x" }], tripStart: "2026-08-01" } };
  const createRes = await handleRequest(post("/api/share", body), env);
  expect(createRes.status).toBe(200);
  const { code } = await createRes.json();
  const getRes = await handleRequest(req(`/api/share/${code}`), env);
  expect(await getRes.json()).toEqual(body);
});

test("GET an unknown but well-formed share code returns 404", async () => {
  const res = await handleRequest(req("/api/share/ABCDEF"), env);
  expect(res.status).toBe(404);
});

test("GET a malformed share code returns 404", async () => {
  const res = await handleRequest(req("/api/share/short"), env);
  expect(res.status).toBe(404);
});

test("rejects invalid type, malformed JSON, and oversized payload", async () => {
  const badType = await handleRequest(post("/api/share", { type: "nope", payload: {} }), env);
  expect(badType.status).toBe(400);

  const badJson = await handleRequest(post("/api/share", "{not json"), env);
  expect(badJson.status).toBe(400);

  const big = "x".repeat(9000);
  const oversized = await handleRequest(post("/api/share", { type: "marks", payload: { favs: [big], visited: [] } }), env);
  expect(oversized.status).toBe(413);
});

test("rejects malformed trip payload items (bad days / bad shape)", async () => {
  const badDays = await handleRequest(post("/api/share", { type: "trip", payload: { trip: [{ id: "hangzhou", days: 99 }] } }), env);
  expect(badDays.status).toBe(400);

  const notArray = await handleRequest(post("/api/share", { type: "trip", payload: { trip: "nope" } }), env);
  expect(notArray.status).toBe(400);
});

// F78：短链固化分享者出发地。worker 只做 originId 的**结构**校验（合法字符形状），不硬编码城市枚举
// ——城市是数据驱动的，worker 侧无数据集可查（见 validateTripPayload 注）。
test("F78: a trip payload with a well-formed originId roundtrips through create+GET", async () => {
  const body = { type: "trip", payload: { trip: [{ id: "hangzhou", days: 3 }], tripStart: "2026-08-01", originId: "beijing" } };
  const createRes = await handleRequest(post("/api/share", body), env);
  expect(createRes.status).toBe(200);
  const { code } = await createRes.json();
  const getRes = await handleRequest(req(`/api/share/${code}`), env);
  expect(await getRes.json()).toEqual(body); // originId 原样保留
});

test("F78: originId is optional — a trip payload without it is still accepted (historical short links)", async () => {
  const res = await handleRequest(post("/api/share", { type: "trip", payload: { trip: [{ id: "hangzhou", days: 2 }] } }), env);
  expect(res.status).toBe(200);
});

test("F78: rejects a non-string originId", async () => {
  const num = await handleRequest(post("/api/share", { type: "trip", payload: { trip: [{ id: "hangzhou", days: 2 }], originId: 123 } }), env);
  expect(num.status).toBe(400);
  const obj = await handleRequest(post("/api/share", { type: "trip", payload: { trip: [{ id: "hangzhou", days: 2 }], originId: { id: "beijing" } } }), env);
  expect(obj.status).toBe(400);
});

test("F78: rejects originId strings that violate the id character pattern", async () => {
  const bad = [
    "Beijing",              // 大写
    "1city",                // 数字开头
    "北京",                  // 非 ASCII
    "",                     // 空串
    "bei jing",             // 空格
    "beijing_1",            // 下划线
    "a".repeat(33),         // 超过 32 字符（[a-z] + {0,31}）
  ];
  for (const originId of bad) {
    const res = await handleRequest(post("/api/share", { type: "trip", payload: { trip: [{ id: "hangzhou", days: 2 }], originId } }), env);
    expect(res.status, `originId=${JSON.stringify(originId)} should be rejected`).toBe(400);
  }
});

test("F78: accepts boundary-legal originId forms (single char, hyphens, digits, 32-char max)", async () => {
  const ok = ["a", "x-1", "us-west-2", "a".repeat(32)];
  for (const originId of ok) {
    const res = await handleRequest(post("/api/share", { type: "trip", payload: { trip: [{ id: "hangzhou", days: 2 }], originId } }), env);
    expect(res.status, `originId=${JSON.stringify(originId)} should be accepted`).toBe(200);
  }
});

test("rate limits after the daily cap per IP (real Durable Object counting)", async () => {
  const body = { type: "marks", payload: { favs: [], visited: [] } };
  let last;
  for (let i = 0; i < 21; i++) {
    last = await handleRequest(post("/api/share", body, { "cf-connecting-ip": "1.2.3.4" }), env);
  }
  expect(last.status).toBe(429);
});

test("a different IP is not affected by another IP's rate limit", async () => {
  const body = { type: "marks", payload: { favs: [], visited: [] } };
  for (let i = 0; i < 20; i++) await handleRequest(post("/api/share", body, { "cf-connecting-ip": "1.1.1.1" }), env);
  const other = await handleRequest(post("/api/share", body, { "cf-connecting-ip": "2.2.2.2" }), env);
  expect(other.status).toBe(200);
});

test("retries share code generation on collision", async () => {
  stubRandomBytesOnce(0); // 第一次候选码全靠字母表[0]="2"×6="222222"
  const first = await handleRequest(post("/api/share", { type: "marks", payload: { favs: [], visited: [] } }), env);
  const { code: firstCode } = await first.json();
  expect(firstCode).toBe("222222");

  stubRandomBytesOnce(0); // 第二次还是撞上同一个候选码——应该在内部重掷（真实 crypto 会拿到另一个）
  const second = await handleRequest(post("/api/share", { type: "marks", payload: { favs: [], visited: [] } }), env);
  expect(second.status).toBe(200);
  const { code: secondCode } = await second.json();
  expect(secondCode).not.toBe("222222"); // 重掷成功，拿到了一个没被占用的新码
});

test("returns 503 (not a crash) when the KV binding isn't provisioned yet", async () => {
  const bareEnv = { RATE_LIMITER: env.RATE_LIMITER };
  const createRes = await handleRequest(post("/api/share", { type: "marks", payload: { favs: [], visited: [] } }), bareEnv);
  expect(createRes.status).toBe(503);
  const getRes = await handleRequest(req("/api/share/ABCDEF"), bareEnv);
  expect(getRes.status).toBe(503);
});

test("unknown /api/* routes return a JSON 404 and never reach ASSETS", async () => {
  const withAssets = { ...env, ASSETS: { fetch: async () => { throw new Error("should not reach ASSETS for /api/* paths"); } } };
  const res = await handleRequest(req("/api/whatever"), withAssets);
  expect(res.status).toBe(404);
  expect((await res.json()).error).toBe("not_found");
});

// M41 同步码云同步

test("POST /api/sync creates a 12-digit code seeded with the caller's payload, GET returns it with updatedAt", async () => {
  const body = { favs: ["hangzhou"], visited: ["chengdu"] };
  const createRes = await handleRequest(post("/api/sync", body), env);
  expect(createRes.status).toBe(200);
  const { code } = await createRes.json();
  expect(code).toMatch(/^[0-9]{12}$/);

  const getRes = await handleRequest(req(`/api/sync/${code}`), env);
  expect(getRes.status).toBe(200);
  const got = await getRes.json();
  expect(got.favs).toEqual(body.favs);
  expect(got.visited).toEqual(body.visited);
  expect(typeof got.updatedAt).toBe("string");
});

test("PUT /api/sync/:code merges into the payload and refreshes updatedAt; GET reflects the new data", async () => {
  const { code } = await (await handleRequest(post("/api/sync", { favs: ["hangzhou"], visited: [] }), env)).json();

  const putRes = await handleRequest(put(`/api/sync/${code}`, { favs: ["hangzhou", "chengdu"], visited: ["chengdu"] }), env);
  expect(putRes.status).toBe(200);
  const putBody = await putRes.json();
  expect(putBody.ok).toBe(true);
  expect(putBody.favs).toEqual(["hangzhou", "chengdu"]);
  expect(putBody.visited).toEqual(["chengdu"]);

  const getRes = await handleRequest(req(`/api/sync/${code}`), env);
  const got = await getRes.json();
  expect(got.favs).toEqual(["hangzhou", "chengdu"]);
  expect(got.visited).toEqual(["chengdu"]);
});

test("PUT performs a server-side union merge — an item this device doesn't know about survives", async () => {
  const { code } = await (await handleRequest(post("/api/sync", { favs: ["hangzhou"], visited: [] }), env)).json();
  await handleRequest(put(`/api/sync/${code}`, { favs: ["sanya"], visited: [] }), env); // 模拟另一台设备已推送 sanya

  const res = await handleRequest(put(`/api/sync/${code}`, { favs: ["hangzhou", "chengdu"], visited: [] }), env);
  const body = await res.json();
  expect([...body.favs].sort()).toEqual(["chengdu", "hangzhou", "sanya"]);
});

// F48 regression：两个请求真的并发打到同一个 DO 实例（不是先后串行发出），DO 的 input gate 保证
// 各自的 get→put 不会交错——最终结果必须是两边独占新增项的并集，不能是其中一个整体覆盖另一个。
test("F48 regression: two truly concurrent PUTs to the same code never lose either side's data", async () => {
  const { code } = await (await handleRequest(post("/api/sync", { favs: ["hangzhou"], visited: [] }), env)).json();

  const [r1, r2] = await Promise.all([
    handleRequest(put(`/api/sync/${code}`, { favs: ["chengdu"], visited: [] }), env),
    handleRequest(put(`/api/sync/${code}`, { favs: ["sanya"], visited: [] }), env),
  ]);
  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);

  const final = await (await handleRequest(req(`/api/sync/${code}`), env)).json();
  expect(new Set(final.favs)).toEqual(new Set(["hangzhou", "chengdu", "sanya"]));
});

test("PUT to an unknown (never-created) code returns 404 — codes must originate from POST, PUT never revives", async () => {
  const res = await handleRequest(put("/api/sync/000000000000", { favs: [], visited: [] }), env);
  expect(res.status).toBe(404);
});

test("GET an unknown sync code returns 404", async () => {
  const res = await handleRequest(req("/api/sync/123456789012"), env);
  expect(res.status).toBe(404);
});

test("malformed sync codes (wrong length/non-digit) 404 for both GET and PUT", async () => {
  const getRes = await handleRequest(req("/api/sync/short"), env);
  expect(getRes.status).toBe(404);
  const putRes = await handleRequest(put("/api/sync/ABCDEFGHIJKL", { favs: [], visited: [] }), env);
  expect(putRes.status).toBe(404);
});

test("sync create/put reject non-marks payloads and oversized payloads", async () => {
  const badShape = await handleRequest(post("/api/sync", { trip: [] }), env);
  expect(badShape.status).toBe(400);

  const badJson = await handleRequest(post("/api/sync", "{not json"), env);
  expect(badJson.status).toBe(400);

  const big = "x".repeat(9000);
  const oversized = await handleRequest(post("/api/sync", { favs: [big], visited: [] }), env);
  expect(oversized.status).toBe(413);

  const { code } = await (await handleRequest(post("/api/sync", { favs: [], visited: [] }), env)).json();
  const badPut = await handleRequest(put(`/api/sync/${code}`, { trip: [] }), env);
  expect(badPut.status).toBe(400);
});

test("PUT rejects when the merged result would exceed the size cap, without persisting it", async () => {
  const { code } = await (await handleRequest(post("/api/sync", { favs: ["hangzhou"], visited: [] }), env)).json();
  const many = Array.from({ length: 2000 }, (_, i) => `city-${i}`); // 远超 8KB
  const res = await handleRequest(put(`/api/sync/${code}`, { favs: many, visited: [] }), env);
  expect(res.status).toBe(413);

  const getRes = await handleRequest(req(`/api/sync/${code}`), env);
  const got = await getRes.json();
  expect(got.favs).toEqual(["hangzhou"]); // 拒绝的合并结果没有落盘，原值不变
});

// F52 regression：create()（handleSyncCreate）只量 {favs,visited}，merge() 一度把 updatedAt 也算了
// 进去——同样内容 POST 建档能过，随后 PUT 却因为多出的时间戳字节数被判超标。构造一个卡在「量
// {favs,visited} 时刚好低于上限，但加上 updatedAt 就会越界」这个临界点上的 payload，直接证伪。
test("F52 regression: a payload just under the canonical size cap succeeds on create AND on an identical PUT", async () => {
  const overhead = new TextEncoder().encode(JSON.stringify({ favs: [""], visited: [] })).length;
  const padLen = 8180 - overhead;
  const payload = { favs: ["x".repeat(padLen)], visited: [] };
  const rawLen = new TextEncoder().encode(JSON.stringify(payload)).length;
  expect(rawLen).toBeLessThan(8192);
  expect(rawLen + 40).toBeGreaterThan(8192); // 确认真的卡在临界点：加上 updatedAt 的量级会越界

  const createRes = await handleRequest(post("/api/sync", payload), env);
  expect(createRes.status).toBe(200);
  const { code } = await createRes.json();

  const putRes = await handleRequest(put(`/api/sync/${code}`, payload), env); // 同样内容，并集后大小不变
  expect(putRes.status).toBe(200); // 旧 bug 会在这里错误地返回 413
});

// TTL：SyncCodeStore 没有 KV 那种 expirationTtl，靠 alarm 自己实现「闲置过期」——直接触发这个
// 实例的 alarm（模拟到期），验证之后 read()/merge() 都会认为这个码不存在了。
test("sync code expires via its Durable Object alarm (idle TTL), matching the POST-only/no-revival contract", async () => {
  const { code } = await (await handleRequest(post("/api/sync", { favs: ["hangzhou"], visited: [] }), env)).json();
  const stub = env.SYNC_CODE_STORE.getByName(code);

  expect(await stub.read()).not.toBeNull();
  const ran = await runDurableObjectAlarm(stub);
  expect(ran).toBe(true);
  expect(await stub.read()).toBeNull();

  const getRes = await handleRequest(req(`/api/sync/${code}`), env);
  expect(getRes.status).toBe(404);
  const putRes = await handleRequest(put(`/api/sync/${code}`, { favs: [], visited: [] }), env);
  expect(putRes.status).toBe(404); // 过期后 PUT 依然不能复活，同 POST-only 约束
});

test("sync-create rate limit is a separate bucket from share-create and from sync read/write", async () => {
  const ip = "9.9.9.9";
  for (let i = 0; i < 20; i++) await handleRequest(post("/api/share", { type: "marks", payload: { favs: [], visited: [] } }, { "cf-connecting-ip": ip }), env);
  const syncCreate = await handleRequest(post("/api/sync", { favs: [], visited: [] }, { "cf-connecting-ip": ip }), env);
  expect(syncCreate.status).toBe(200); // share-create 的额度用尽不影响 sync-create
});

test("sync create hits its own daily rate limit after enough requests from one IP", async () => {
  const ip = "8.8.8.8";
  let last;
  for (let i = 0; i < 21; i++) {
    last = await handleRequest(post("/api/sync", { favs: [], visited: [] }, { "cf-connecting-ip": ip }), env);
  }
  expect(last.status).toBe(429);
});

test("sync read/write share one rate-limit bucket, capped higher than creation", async () => {
  const ip = "7.7.7.7";
  const { code } = await (await handleRequest(post("/api/sync", { favs: [], visited: [] }, { "cf-connecting-ip": "1.0.0.1" }), env)).json();
  let last;
  for (let i = 0; i < 61; i++) {
    last = await handleRequest(req(`/api/sync/${code}`, { headers: { "cf-connecting-ip": ip } }), env);
  }
  expect(last.status).toBe(429);
});

// F47 regression：N 个请求真的并发发出（不是循环里 await 出来的串行请求），最终成功数必须恰好等于
// 限额——不多（说明没有并发计数竞态导致超放）、不少（说明没有并发写丢计数导致提前/额外拒绝）。
test("F47 regression: concurrent requests from one IP never exceed the rate limit", async () => {
  const ip = "6.6.6.6";
  const results = await Promise.all(
    Array.from({ length: 25 }, () => handleRequest(post("/api/sync", { favs: [], visited: [] }, { "cf-connecting-ip": ip }), env)),
  );
  const successCount = results.filter((r) => r.status === 200).length;
  expect(successCount).toBe(20); // RATE_LIMIT_PER_DAY
});

test("retries sync code generation on collision", async () => {
  stubRandomBytesOnce(0); // 全 0 字节 → 字母表[0]="0" 重复 12 位 = "000000000000"
  const first = await handleRequest(post("/api/sync", { favs: [], visited: [] }), env);
  const { code: firstCode } = await first.json();
  expect(firstCode).toBe("000000000000");

  stubRandomBytesOnce(0); // 再撞一次同一个已占用的候选码，应该重掷成功
  const second = await handleRequest(post("/api/sync", { favs: [], visited: [] }), env);
  expect(second.status).toBe(200);
  const { code: secondCode } = await second.json();
  expect(secondCode).not.toBe("000000000000");
});

test("sync endpoints return 503 (not a crash) when the Durable Object binding isn't provisioned yet", async () => {
  const bareEnv = { RATE_LIMITER: env.RATE_LIMITER };
  const createRes = await handleRequest(post("/api/sync", { favs: [], visited: [] }), bareEnv);
  expect(createRes.status).toBe(503);
  const getRes = await handleRequest(req("/api/sync/123456789012"), bareEnv);
  expect(getRes.status).toBe(503);
  const putRes = await handleRequest(put("/api/sync/123456789012", { favs: [], visited: [] }), bareEnv);
  expect(putRes.status).toBe(503);
});

// F49（有界流读取）——与 DO/KV 无关，纯粹是 request body 解析层，跟原来 KV 版本行为一致。

test("a small legit payload padded with a huge irrelevant extra field is rejected as too_large, not silently accepted via the trimmed projection", async () => {
  const junk = "x".repeat(20000);
  const res = await handleRequest(post("/api/sync", { favs: ["hangzhou"], visited: [], junk }), env);
  expect(res.status).toBe(413);
});

test("oversized body is rejected via streaming byte-count even without a Content-Length header", async () => {
  const bigBody = JSON.stringify({ favs: ["x".repeat(20000)], visited: [] });
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(bigBody));
      controller.close();
    },
  });
  const request = new Request("https://lab.medspiral.com/next-stop-gacha/api/sync", {
    method: "POST",
    body: stream,
    duplex: "half",
    headers: { "content-type": "application/json" },
  });
  expect(request.headers.get("content-length")).toBeNull();
  const res = await handleRequest(request, env);
  expect(res.status).toBe(413);
});

test("unknown /api/* routes return a JSON 404 and never reach ASSETS (sync-adjacent paths too)", async () => {
  const withAssets = { ...env, ASSETS: { fetch: async () => { throw new Error("should not reach ASSETS for /api/* paths"); } } };
  const res = await handleRequest(req("/api/sync-typo"), withAssets);
  expect(res.status).toBe(404);
  expect((await res.json()).error).toBe("not_found");
});

// Durable Object 直接单测（补充 HTTP 层测不到的原语级保证，同官方 skill 推荐的 Unit Tests 打法）

describe("SyncCodeStore (direct DO access)", () => {
  test("create() returns null on the second call to the same instance (collision-safety primitive)", async () => {
    const stub = env.SYNC_CODE_STORE.getByName("direct-test-code");
    const first = await stub.create(["hangzhou"], []);
    expect(first).not.toBeNull();
    const second = await stub.create(["chengdu"], []); // 同一个实例，模拟两个并发 create() 撞同一个候选码
    expect(second).toBeNull();
  });

  test("merge() on a never-created instance returns null", async () => {
    const stub = env.SYNC_CODE_STORE.getByName("never-created-code");
    expect(await stub.merge(["hangzhou"], [], 8192)).toBeNull();
  });

  test("different instance names are fully isolated", async () => {
    const a = env.SYNC_CODE_STORE.getByName("iso-a");
    const b = env.SYNC_CODE_STORE.getByName("iso-b");
    await a.create(["hangzhou"], []);
    expect(await b.read()).toBeNull();
  });
});

describe("RateLimiter (direct DO access)", () => {
  test("checkAndIncrement allows up to the limit then denies", async () => {
    const stub = env.RATE_LIMITER.getByName("direct-rl-test");
    for (let i = 0; i < 3; i++) expect(await stub.checkAndIncrement(3)).toBe(true);
    expect(await stub.checkAndIncrement(3)).toBe(false);
  });
});
