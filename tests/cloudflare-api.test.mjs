import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../cloudflare/worker.mjs";

function fakeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  const putCalls = [];
  return {
    store,
    putCalls,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value, opts) { store.set(key, value); putCalls.push({ key, value, opts }); },
  };
}

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

test("POST /api/share creates a well-formed 6-char code and GET roundtrips a marks payload", async () => {
  const env = { APP_KV: fakeKV() };
  const body = { type: "marks", payload: { favs: ["hangzhou"], visited: ["chengdu"] } };
  const createRes = await handleRequest(post("/api/share", body), env);
  assert.equal(createRes.status, 200);
  const { code } = await createRes.json();
  assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);

  const getRes = await handleRequest(req(`/api/share/${code}`), env);
  assert.equal(getRes.status, 200);
  assert.deepEqual(await getRes.json(), body);
});

test("GET roundtrips a trip payload", async () => {
  const env = { APP_KV: fakeKV() };
  const body = { type: "trip", payload: { trip: [{ id: "hangzhou", days: 3 }, { id: "chengdu", days: 2, r: "route-x" }], tripStart: "2026-08-01" } };
  const createRes = await handleRequest(post("/api/share", body), env);
  assert.equal(createRes.status, 200);
  const { code } = await createRes.json();
  const getRes = await handleRequest(req(`/api/share/${code}`), env);
  assert.deepEqual(await getRes.json(), body);
});

test("GET an unknown but well-formed code returns 404", async () => {
  const env = { APP_KV: fakeKV() };
  const res = await handleRequest(req("/api/share/ABCDEF"), env);
  assert.equal(res.status, 404);
});

test("GET a malformed code returns 404 without touching KV", async () => {
  const kv = fakeKV();
  let getCalls = 0;
  const origGet = kv.get.bind(kv);
  kv.get = async (k) => { getCalls++; return origGet(k); };
  const env = { APP_KV: kv };
  const res = await handleRequest(req("/api/share/short"), env);
  assert.equal(res.status, 404);
  assert.equal(getCalls, 0);
});

test("rejects invalid type, malformed JSON, and oversized payload", async () => {
  const env = { APP_KV: fakeKV() };

  const badType = await handleRequest(post("/api/share", { type: "nope", payload: {} }), env);
  assert.equal(badType.status, 400);

  const badJson = await handleRequest(post("/api/share", "{not json"), env);
  assert.equal(badJson.status, 400);

  const big = "x".repeat(9000);
  const oversized = await handleRequest(post("/api/share", { type: "marks", payload: { favs: [big], visited: [] } }), env);
  assert.equal(oversized.status, 413);
});

test("rejects malformed trip payload items (bad days / bad shape)", async () => {
  const env = { APP_KV: fakeKV() };
  const badDays = await handleRequest(post("/api/share", { type: "trip", payload: { trip: [{ id: "hangzhou", days: 99 }] } }), env);
  assert.equal(badDays.status, 400);

  const notArray = await handleRequest(post("/api/share", { type: "trip", payload: { trip: "nope" } }), env);
  assert.equal(notArray.status, 400);
});

test("rate limits after the daily cap per IP", async () => {
  const env = { APP_KV: fakeKV() };
  const body = { type: "marks", payload: { favs: [], visited: [] } };
  let last;
  for (let i = 0; i < 21; i++) {
    last = await handleRequest(post("/api/share", body, { "cf-connecting-ip": "1.2.3.4" }), env);
  }
  assert.equal(last.status, 429);
});

test("a different IP is not affected by another IP's rate limit", async () => {
  const env = { APP_KV: fakeKV() };
  const body = { type: "marks", payload: { favs: [], visited: [] } };
  for (let i = 0; i < 20; i++) await handleRequest(post("/api/share", body, { "cf-connecting-ip": "1.1.1.1" }), env);
  const other = await handleRequest(post("/api/share", body, { "cf-connecting-ip": "2.2.2.2" }), env);
  assert.equal(other.status, 200);
});

test("retries on short-code collision", async () => {
  const kv = fakeKV();
  let shareGetCalls = 0;
  const origGet = kv.get.bind(kv);
  kv.get = async (key) => {
    if (key.startsWith("share:")) {
      shareGetCalls++;
      if (shareGetCalls === 1) return JSON.stringify({ type: "marks", payload: { favs: [], visited: [] } }); // 第一次判占用
    }
    return origGet(key);
  };
  const env = { APP_KV: kv };
  const res = await handleRequest(post("/api/share", { type: "marks", payload: { favs: [], visited: [] } }), env);
  assert.equal(res.status, 200);
  assert.ok(shareGetCalls >= 2, "expected a retry after the first code collided");
});

test("returns 503 (not a crash) when the KV binding isn't provisioned yet", async () => {
  const env = {};
  const createRes = await handleRequest(post("/api/share", { type: "marks", payload: { favs: [], visited: [] } }), env);
  assert.equal(createRes.status, 503);
  const getRes = await handleRequest(req("/api/share/ABCDEF"), env);
  assert.equal(getRes.status, 503);
});

// M41 同步码云同步

test("POST /api/sync creates a 12-digit code seeded with the caller's payload, GET returns it with updatedAt", async () => {
  const env = { APP_KV: fakeKV() };
  const body = { favs: ["hangzhou"], visited: ["chengdu"] };
  const createRes = await handleRequest(post("/api/sync", body), env);
  assert.equal(createRes.status, 200);
  const { code } = await createRes.json();
  assert.match(code, /^[0-9]{12}$/);

  const getRes = await handleRequest(req(`/api/sync/${code}`), env);
  assert.equal(getRes.status, 200);
  const got = await getRes.json();
  assert.deepEqual(got.favs, body.favs);
  assert.deepEqual(got.visited, body.visited);
  assert.equal(typeof got.updatedAt, "string");
});

test("PUT /api/sync/:code overwrites the payload and refreshes updatedAt; GET reflects the new data", async () => {
  const env = { APP_KV: fakeKV() };
  const { code } = await (await handleRequest(post("/api/sync", { favs: ["hangzhou"], visited: [] }), env)).json();

  const putRes = await handleRequest(put(`/api/sync/${code}`, { favs: ["hangzhou", "chengdu"], visited: ["chengdu"] }), env);
  assert.equal(putRes.status, 200);
  assert.deepEqual(await putRes.json(), { ok: true });

  const getRes = await handleRequest(req(`/api/sync/${code}`), env);
  const got = await getRes.json();
  assert.deepEqual(got.favs, ["hangzhou", "chengdu"]);
  assert.deepEqual(got.visited, ["chengdu"]);
});

test("PUT to an unknown (never-created) code returns 404 — codes must originate from POST", async () => {
  const env = { APP_KV: fakeKV() };
  const res = await handleRequest(put("/api/sync/000000000000", { favs: [], visited: [] }), env);
  assert.equal(res.status, 404);
});

test("GET an unknown sync code returns 404", async () => {
  const env = { APP_KV: fakeKV() };
  const res = await handleRequest(req("/api/sync/123456789012"), env);
  assert.equal(res.status, 404);
});

test("malformed sync codes (wrong length/non-digit) 404 without touching KV, for both GET and PUT", async () => {
  const kv = fakeKV();
  let getCalls = 0;
  const origGet = kv.get.bind(kv);
  kv.get = async (k) => { getCalls++; return origGet(k); };
  const env = { APP_KV: kv };

  const getRes = await handleRequest(req("/api/sync/short"), env);
  assert.equal(getRes.status, 404);
  const putRes = await handleRequest(put("/api/sync/ABCDEFGHIJKL", { favs: [], visited: [] }), env);
  assert.equal(putRes.status, 404);
  assert.equal(getCalls, 0);
});

test("sync create/put reject non-marks payloads and oversized payloads", async () => {
  const env = { APP_KV: fakeKV() };

  const badShape = await handleRequest(post("/api/sync", { trip: [] }), env);
  assert.equal(badShape.status, 400);

  const badJson = await handleRequest(post("/api/sync", "{not json"), env);
  assert.equal(badJson.status, 400);

  const big = "x".repeat(9000);
  const oversized = await handleRequest(post("/api/sync", { favs: [big], visited: [] }), env);
  assert.equal(oversized.status, 413);

  const { code } = await (await handleRequest(post("/api/sync", { favs: [], visited: [] }), env)).json();
  const badPut = await handleRequest(put(`/api/sync/${code}`, { trip: [] }), env);
  assert.equal(badPut.status, 400);
});

test("sync KV entries are written with the sync TTL (create and every PUT refresh)", async () => {
  const kv = fakeKV();
  const env = { APP_KV: kv };
  const { code } = await (await handleRequest(post("/api/sync", { favs: [], visited: [] }), env)).json();
  await handleRequest(put(`/api/sync/${code}`, { favs: ["hangzhou"], visited: [] }), env);

  const writes = kv.putCalls.filter((c) => c.key === `sync:${code}`);
  assert.equal(writes.length, 2);
  for (const w of writes) assert.equal(w.opts.expirationTtl, 400 * 24 * 60 * 60);
});

test("sync-create rate limit is a separate bucket from share-create and from sync read/write", async () => {
  const env = { APP_KV: fakeKV() };
  const ip = "9.9.9.9";
  for (let i = 0; i < 20; i++) await handleRequest(post("/api/share", { type: "marks", payload: { favs: [], visited: [] } }, { "cf-connecting-ip": ip }), env);
  // share-create bucket is now maxed out for this IP; sync-create must be unaffected
  const syncCreate = await handleRequest(post("/api/sync", { favs: [], visited: [] }, { "cf-connecting-ip": ip }), env);
  assert.equal(syncCreate.status, 200);
});

test("sync create hits its own daily rate limit after enough requests from one IP", async () => {
  const env = { APP_KV: fakeKV() };
  const ip = "8.8.8.8";
  let last;
  for (let i = 0; i < 21; i++) {
    last = await handleRequest(post("/api/sync", { favs: [], visited: [] }, { "cf-connecting-ip": ip }), env);
  }
  assert.equal(last.status, 429);
});

test("sync read/write share one rate-limit bucket, capped higher than creation", async () => {
  const env = { APP_KV: fakeKV() };
  const ip = "7.7.7.7";
  const { code } = await (await handleRequest(post("/api/sync", { favs: [], visited: [] }, { "cf-connecting-ip": "1.0.0.1" }), env)).json();
  let last;
  for (let i = 0; i < 61; i++) {
    last = await handleRequest(req(`/api/sync/${code}`, { headers: { "cf-connecting-ip": ip } }), env);
  }
  assert.equal(last.status, 429);
});

test("retries sync code generation on collision", async () => {
  const kv = fakeKV();
  let syncGetCalls = 0;
  const origGet = kv.get.bind(kv);
  kv.get = async (key) => {
    if (key.startsWith("sync:")) {
      syncGetCalls++;
      if (syncGetCalls === 1) return JSON.stringify({ favs: [], visited: [], updatedAt: "x" }); // 第一次判占用
    }
    return origGet(key);
  };
  const env = { APP_KV: kv };
  const res = await handleRequest(post("/api/sync", { favs: [], visited: [] }), env);
  assert.equal(res.status, 200);
  assert.ok(syncGetCalls >= 2, "expected a retry after the first code collided");
});

test("sync endpoints return 503 (not a crash) when the KV binding isn't provisioned yet", async () => {
  const env = {};
  const createRes = await handleRequest(post("/api/sync", { favs: [], visited: [] }), env);
  assert.equal(createRes.status, 503);
  const getRes = await handleRequest(req("/api/sync/123456789012"), env);
  assert.equal(getRes.status, 503);
  const putRes = await handleRequest(put("/api/sync/123456789012", { favs: [], visited: [] }), env);
  assert.equal(putRes.status, 503);
});

test("unknown /api/* routes return a JSON 404 and never reach ASSETS", async () => {
  const env = {
    APP_KV: fakeKV(),
    ASSETS: { fetch: async () => { throw new Error("should not reach ASSETS for /api/* paths"); } },
  };
  const res = await handleRequest(req("/api/whatever"), env);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, "not_found");
});
