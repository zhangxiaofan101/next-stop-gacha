// M40 短链分享（design「后端·短链分享」）：POST /api/share 生成只读短码，GET /api/share/:code 取回。
// KV 未绑定（namespace 尚未创建）或读写故障时一律返回非 2xx——前端据此静默回退到既有链接/QR/JSON
// 通道，与天气接入同一条「后端从不是可用性前提」的哲学（design「实时天气」「后端·总纲」）。

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 无 0/1/I/O/L 歧义字符，6 位 31^6≈8.9亿种
const CODE_LEN = 6;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`);
const MAX_PAYLOAD_BYTES = 8 * 1024;
const SHARE_TTL_SECONDS = 180 * 24 * 60 * 60; // write-once，180 天
const RATE_LIMIT_PER_DAY = 20; // 按 IP 简单限流；读侧天然只读不设限（design「后端·API 与静态资产同 Worker」）
const MAX_CODE_ATTEMPTS = 5;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LEN));
  let s = "";
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

function isStringArray(v) {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function validateMarksPayload(payload) {
  return !!payload && isStringArray(payload.favs) && isStringArray(payload.visited);
}

// 结构性校验（id 是否真实存在于当前数据集由前端渲染时核对——worker 侧无数据集可查，见 design「存储与精确性」）
function validateTripPayload(payload) {
  if (!payload || !Array.isArray(payload.trip)) return false;
  if (payload.tripStart !== undefined && typeof payload.tripStart !== "string") return false;
  return payload.trip.every((t) =>
    t && typeof t.id === "string" && Number.isInteger(t.days) && t.days >= 1 && t.days <= 14 &&
    (t.r === undefined || typeof t.r === "string"));
}

function validateSharePayload(type, payload) {
  if (type === "marks") return validateMarksPayload(payload);
  if (type === "trip") return validateTripPayload(payload);
  return false;
}

function byteLength(str) {
  return new TextEncoder().encode(str).length;
}

async function checkRateLimit(kv, ip) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `ratelimit:${ip}:${day}`;
  const cur = Number(await kv.get(key)) || 0;
  if (cur >= RATE_LIMIT_PER_DAY) return false;
  await kv.put(key, String(cur + 1), { expirationTtl: 86400 });
  return true;
}

export async function handleShareCreate(request, env) {
  if (!env.APP_KV) return json({ error: "unavailable" }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400); }
  const { type, payload } = body || {};
  if (!validateSharePayload(type, payload)) return json({ error: "bad_payload" }, 400);

  const raw = JSON.stringify(payload);
  if (byteLength(raw) > MAX_PAYLOAD_BYTES) return json({ error: "too_large" }, 413);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(env.APP_KV, ip))) return json({ error: "rate_limited" }, 429);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    const key = `share:${code}`;
    const existing = await env.APP_KV.get(key);
    if (existing) continue; // 碰撞重掷（design「短码空间碰撞时重掷」）
    await env.APP_KV.put(key, JSON.stringify({ type, payload }), { expirationTtl: SHARE_TTL_SECONDS });
    return json({ code });
  }
  return json({ error: "collision" }, 500);
}

export async function handleShareGet(env, code) {
  if (!env.APP_KV) return json({ error: "unavailable" }, 503);
  if (!CODE_RE.test(code)) return json({ error: "not_found" }, 404);
  const raw = await env.APP_KV.get(`share:${code}`);
  if (!raw) return json({ error: "not_found" }, 404);
  return json(JSON.parse(raw));
}

export function apiNotFound() {
  return json({ error: "not_found" }, 404);
}
