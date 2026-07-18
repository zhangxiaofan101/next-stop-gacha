// M40 短链分享（design「后端·短链分享」）：POST /api/share 生成只读短码，GET /api/share/:code 取回。
// M41 同步码云同步（design「后端·同步码云同步」）：POST /api/sync 生成同步码（码即凭证，无账号），
// PUT /api/sync/:code 全量覆盖 {favs,visited,updatedAt}，GET 取回供前端走并集合并（合并语义在前端
// logic/share.ts，与链接/JSON 导入同源；行程不同步——行程是短命工作台，打卡/收藏才是长命资产）。
// KV 未绑定（namespace 尚未创建）或读写故障时一律返回非 2xx——前端据此静默回退到既有链接/QR/JSON
// 通道，与天气接入同一条「后端从不是可用性前提」的哲学（design「实时天气」「后端·总纲」）。

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // 无 0/1/I/O/L 歧义字符，6 位 31^6≈8.9亿种
const CODE_LEN = 6;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`);
const MAX_PAYLOAD_BYTES = 8 * 1024;
const SHARE_TTL_SECONDS = 180 * 24 * 60 * 60; // write-once，180 天
const RATE_LIMIT_PER_DAY = 20; // 按 IP 简单限流；读侧天然只读不设限（design「后端·API 与静态资产同 Worker」）
const MAX_CODE_ATTEMPTS = 5;

// 同步码用纯数字（口述/手抄比字母数字混排更顺手），12 位=10^12 种，碰撞概率可忽略。
const SYNC_CODE_LEN = 12;
const SYNC_CODE_RE = /^[0-9]{12}$/;
// 同步码本身不像短链有天然的一次性 TTL 语义——implementer 拍定给一个较长且每次 PUT 续期的存活期
// （非「永久」），呼应 design「存储与精确性」把同步快照列为「可再生」资产：免费额度卫生优先，
// 闲置超一年的同步码任其自然过期，本机 localStorage 仍是真相源，随时可用同一个码重新 PUT 复活。
const SYNC_TTL_SECONDS = 400 * 24 * 60 * 60;
// 读写（GET/PUT）限额比创建宽松——两台设备一天互相同步几次都算正常使用。
const SYNC_RW_LIMIT_PER_DAY = 60;

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

function randomSyncCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(SYNC_CODE_LEN));
  let s = "";
  for (const b of bytes) s += String(b % 10);
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

async function checkRateLimit(kv, ip, bucket, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `ratelimit:${bucket}:${ip}:${day}`;
  const cur = Number(await kv.get(key)) || 0;
  if (cur >= limit) return false;
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
  if (!(await checkRateLimit(env.APP_KV, ip, "share", RATE_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

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

// M41：POST /api/sync 生成一个新同步码，种子数据即调用方当前本机 favs/visited。
export async function handleSyncCreate(request, env) {
  if (!env.APP_KV) return json({ error: "unavailable" }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400); }
  if (!validateMarksPayload(body)) return json({ error: "bad_payload" }, 400);

  const raw = JSON.stringify({ favs: body.favs, visited: body.visited, updatedAt: new Date().toISOString() });
  if (byteLength(raw) > MAX_PAYLOAD_BYTES) return json({ error: "too_large" }, 413);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(env.APP_KV, ip, "sync-create", RATE_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomSyncCode();
    const key = `sync:${code}`;
    const existing = await env.APP_KV.get(key);
    if (existing) continue; // 碰撞重掷，同短链分享
    await env.APP_KV.put(key, raw, { expirationTtl: SYNC_TTL_SECONDS });
    return json({ code });
  }
  return json({ error: "collision" }, 500);
}

// PUT /api/sync/:code 全量覆盖——码必须已由 POST 创建过（未知码 404，不允许客户端凭空指定码建记录，
// 否则退化成任意 key 的免费无限存储）。每次成功写入都续期 TTL。
export async function handleSyncPut(request, env, code) {
  if (!env.APP_KV) return json({ error: "unavailable" }, 503);
  if (!SYNC_CODE_RE.test(code)) return json({ error: "not_found" }, 404);

  const key = `sync:${code}`;
  const existing = await env.APP_KV.get(key);
  if (!existing) return json({ error: "not_found" }, 404);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "bad_json" }, 400); }
  if (!validateMarksPayload(body)) return json({ error: "bad_payload" }, 400);

  const raw = JSON.stringify({ favs: body.favs, visited: body.visited, updatedAt: new Date().toISOString() });
  if (byteLength(raw) > MAX_PAYLOAD_BYTES) return json({ error: "too_large" }, 413);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(env.APP_KV, ip, "sync-rw", SYNC_RW_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

  await env.APP_KV.put(key, raw, { expirationTtl: SYNC_TTL_SECONDS });
  return json({ ok: true });
}

// GET /api/sync/:code 供前端拉取后走本地并集合并——码即凭证，猜码即读到他人收藏/打卡，读侧也限流
// （不同于短链分享的只读语义：短链是用户主动生成公开的一次性分享，同步码是长期私有凭证）。
export async function handleSyncGet(env, code, ip) {
  if (!env.APP_KV) return json({ error: "unavailable" }, 503);
  if (!SYNC_CODE_RE.test(code)) return json({ error: "not_found" }, 404);

  if (!(await checkRateLimit(env.APP_KV, ip || "unknown", "sync-rw", SYNC_RW_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

  const raw = await env.APP_KV.get(`sync:${code}`);
  if (!raw) return json({ error: "not_found" }, 404);
  return json(JSON.parse(raw));
}

export function apiNotFound() {
  return json({ error: "not_found" }, 404);
}
