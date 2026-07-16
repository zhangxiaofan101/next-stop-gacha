import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest, isGamePath } from "../cloudflare/worker.mjs";

function assetEnv(handler) {
  const calls = [];
  return {
    calls,
    env: {
      ASSETS: {
        async fetch(request) {
          calls.push(request);
          return handler?.(request) ?? new Response("asset", {
            headers: { "content-type": "text/plain" },
          });
        },
      },
    },
  };
}

test("recognizes only the game prefix", () => {
  assert.equal(isGamePath("/next-stop-gacha"), true);
  assert.equal(isGamePath("/next-stop-gacha/"), true);
  assert.equal(isGamePath("/next-stop-gacha/assets/app.css"), true);
  assert.equal(isGamePath("/next-stop-gacha-other/"), false);
  assert.equal(isGamePath("/"), false);
});

test("rejects paths outside the game without touching static assets", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(new Request("https://lab.medspiral.com/"), env);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not Found");
  assert.equal(calls.length, 0);
});

test("redirects the bare prefix to the canonical trailing-slash URL", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha?from=poster"),
    env,
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://lab.medspiral.com/next-stop-gacha/?from=poster",
  );
  assert.equal(calls.length, 0);
});

test("strips the public prefix before fetching the root asset", async () => {
  const { env, calls } = assetEnv();
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/?seed=42"),
    env,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://lab.medspiral.com/?seed=42");
  assert.equal(await response.text(), "asset");
  assert.equal(response.headers.get("x-content-owner"), "next-stop-gacha-repo");
});

test("strips the prefix from nested asset paths", async () => {
  const { env, calls } = assetEnv();
  await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/assets/app.css?v=3"),
    env,
  );

  assert.equal(calls[0].url, "https://lab.medspiral.com/assets/app.css?v=3");
});

test("preserves asset status, headers, and body", async () => {
  const { env } = assetEnv(() => new Response("missing", {
    status: 404,
    headers: { "cache-control": "public, max-age=60" },
  }));
  const response = await handleRequest(
    new Request("https://lab.medspiral.com/next-stop-gacha/missing.js"),
    env,
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "public, max-age=60");
  assert.equal(response.headers.get("x-content-owner"), "next-stop-gacha-repo");
  assert.equal(await response.text(), "missing");
});
