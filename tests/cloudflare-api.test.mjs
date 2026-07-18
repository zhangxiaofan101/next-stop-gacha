import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest } from "../cloudflare/worker.mjs";

function fakeKV(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
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

test("unknown /api/* routes return a JSON 404 and never reach ASSETS", async () => {
  const env = {
    APP_KV: fakeKV(),
    ASSETS: { fetch: async () => { throw new Error("should not reach ASSETS for /api/* paths"); } },
  };
  const res = await handleRequest(req("/api/whatever"), env);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, "not_found");
});
