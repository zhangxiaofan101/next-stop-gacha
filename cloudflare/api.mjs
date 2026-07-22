// M40 短链分享（design「后端·短链分享」）：POST /api/share 生成只读短码，GET /api/share/:code 取回。
// M41 同步码云同步（design「后端·同步码云同步」）：POST /api/sync 生成同步码（码即凭证，无账号），
// PUT /api/sync/:code 在服务器端做并集合并（见 F48 注），GET 取回供前端再走一次并集合并（合并语义
// 在前端 logic/share.ts，与链接/JSON 导入同源；行程不同步——行程是短命工作台，打卡/收藏才是长命
// 资产）。KV/Durable Object 未绑定或读写故障时一律返回非 2xx——前端据此静默回退到既有链接/QR/JSON
// 通道，与天气接入同一条「后端从不是可用性前提」的哲学（design「实时天气」「后端·总纲」）。
//
// F47/F48（2026-07-19 codex 复核第二轮）：限流计数与同步码的「读旧值→并集→写回」最初都建在 KV 上，
// 但 KV 既没有跨请求的原子 read-modify-write，同一个 key 每秒也最多写 1 次——用受限频约束的 fake KV
// 和并发 barrier fake 复现出「限流在真实 KV 上完全失效」「并发 PUT 会 last-write-wins 丢数据」两个
// 真问题，fail-open/服务器端合并等 KV-only 的缓解都堵不住。两者都改成 Durable Object（`durableObjects.mjs`
// 的 `RateLimiter`/`SyncCodeStore`）——DO 存储操作天然有 input/output gate，同一实例上的并发调用会被
// 串行化，给了 KV 给不了的原子性；Workers 免费计划可以用 DO（仅限 SQLite storage backend）。
// `share:` 短链保留在 KV：write-once、从不 PUT/合并，没有 F47/F48 那类竞态可言。

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
  // F78 originId（分享者出发地）：只做结构校验（出发地 id 的合法字符形状），**不硬编码城市枚举**——
  // 可选城市是数据驱动的（tools/build.py 产出的 origins 索引才是权威城市表），worker 侧无数据集可查、
  // 也不该背一份会漂移的城市表。undefined 允许（历史短链无此字段）；否则须是匹配该模式的字符串。
  if (payload.originId !== undefined &&
    !(typeof payload.originId === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(payload.originId))) return false;
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

// F49（2026-07-19 codex 复核）：旧版本先 `await request.json()`（无界，整份缓冲进内存解析）
// 再对重新序列化后的 payload 测字节数——攻击者可以塞一个不影响存储投影的巨大多余字段，全程绕过
// 大小闸门白嫖 Worker CPU/内存。这里改为在解析 JSON **之前**对原始请求体做流式计数，超限立即中止，
// 从不把整份大 body 读进内存。Content-Length 头只做快速路径，不可信（可缺失/可为 chunked），
// 真正的闸门是边读边累加的字节计数器。
async function readBoundedJson(request, maxBytes) {
  const cl = request.headers.get("content-length");
  if (cl !== null && Number(cl) > maxBytes) return { ok: false, reason: "too_large" };
  if (!request.body) return { ok: false, reason: "bad_json" };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    let step;
    try { step = await reader.read(); } catch (e) { return { ok: false, reason: "bad_json" }; }
    if (step.done) break;
    total += step.value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch (e) {}
      return { ok: false, reason: "too_large" };
    }
    chunks.push(step.value);
  }

  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.byteLength; }
  try { return { ok: true, json: JSON.parse(new TextDecoder().decode(buf)) }; }
  catch (e) { return { ok: false, reason: "bad_json" }; }
}

// F47（2026-07-19 codex 复核）：改用 Durable Object 做限流计数（见文件头注）——每个 (bucket, ip, day)
// 对应一个 DO 实例，`checkAndIncrement` 内部的 get→put 由 input gate 保证原子，不再有 KV 版本「同 key
// 每秒限写 1 次」把计数写失败、进而被 fail-open 无限绕过的问题。DO 调用本身极少失败，但仍包一层
// try/catch fail-open 兜底（网络抖动/运行时故障不该连累正常请求——同项目一贯的「后端从不是可用性
// 前提」哲学，只是这次真正意义上只是兜底，不是限流机制本身的漏洞）。
async function checkRateLimit(rateLimiter, ip, bucket, limit) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const stub = rateLimiter.getByName(`${bucket}:${ip}:${day}`);
    return await stub.checkAndIncrement(limit);
  } catch (e) {
    return true; // fail-open：限流子系统故障不能挡掉正常请求
  }
}

export async function handleShareCreate(request, env) {
  if (!env.APP_KV) return json({ error: "unavailable" }, 503);

  const read = await readBoundedJson(request, MAX_PAYLOAD_BYTES);
  if (!read.ok) return json({ error: read.reason }, read.reason === "too_large" ? 413 : 400);
  const { type, payload } = read.json || {};
  if (!validateSharePayload(type, payload)) return json({ error: "bad_payload" }, 400);

  const raw = JSON.stringify(payload);
  if (byteLength(raw) > MAX_PAYLOAD_BYTES) return json({ error: "too_large" }, 413);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(env.RATE_LIMITER, ip, "share", RATE_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

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

// M41：POST /api/sync 生成一个新同步码，种子数据即调用方当前本机 favs/visited。碰撞重掷靠
// SyncCodeStore.create() 的原子 provisioned 检查——同一个候选码真被两个并发请求同时抽中，也只有
// 先到的那个建档成功，后到的会看见 provisioned=true 拿到 null 走重掷，不会双写。
export async function handleSyncCreate(request, env) {
  if (!env.SYNC_CODE_STORE) return json({ error: "unavailable" }, 503);

  const read = await readBoundedJson(request, MAX_PAYLOAD_BYTES);
  if (!read.ok) return json({ error: read.reason }, read.reason === "too_large" ? 413 : 400);
  const body = read.json;
  if (!validateMarksPayload(body)) return json({ error: "bad_payload" }, 400);

  const raw = JSON.stringify({ favs: body.favs, visited: body.visited });
  if (byteLength(raw) > MAX_PAYLOAD_BYTES) return json({ error: "too_large" }, 413);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(env.RATE_LIMITER, ip, "sync-create", RATE_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomSyncCode();
    const stub = env.SYNC_CODE_STORE.getByName(code);
    const result = await stub.create(body.favs, body.visited);
    if (!result) continue; // 该码已 provisioned（碰撞），重掷
    return json({ code });
  }
  return json({ error: "collision" }, 500);
}

// PUT /api/sync/:code——码必须已由 POST 创建过（未 provisioned 一律 404，不允许客户端凭空指定码建
// 记录）。**服务器端做加法合并**（F48）：SyncCodeStore.merge() 内部读现值、与请求 payload 取并集、
// 写回全过程没有 await 外部 I/O，DO 的 input gate 保证对同一实例的其它并发调用原子——两台设备真的
// 同时 PUT 同一个码，也不会有「后写的整体覆盖前写的独占新增项」，因为它们的 get→put 根本不会交错
// 执行（这是 F48 第一轮 KV-only 缓解做不到、被 codex 用并发 barrier fake 实测戳穿的地方）。
export async function handleSyncPut(request, env, code) {
  if (!env.SYNC_CODE_STORE) return json({ error: "unavailable" }, 503);
  if (!SYNC_CODE_RE.test(code)) return json({ error: "not_found" }, 404);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(env.RATE_LIMITER, ip, "sync-rw", SYNC_RW_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

  const read = await readBoundedJson(request, MAX_PAYLOAD_BYTES);
  if (!read.ok) return json({ error: read.reason }, read.reason === "too_large" ? 413 : 400);
  const body = read.json;
  if (!validateMarksPayload(body)) return json({ error: "bad_payload" }, 400);

  const stub = env.SYNC_CODE_STORE.getByName(code);
  const result = await stub.merge(body.favs, body.visited, MAX_PAYLOAD_BYTES);
  if (!result) return json({ error: "not_found" }, 404); // 未 provisioned/已过期——POST-only，PUT 不能复活
  if (result.tooLarge) return json({ error: "too_large" }, 413); // 合并后超标，不落盘

  // 把服务器端合并后的真实结果回传——调用方 GET 时的快照可能已经过时（这次 PUT 之间另一台设备
  // 也写过），让客户端拿真正落盘的并集去更新本机状态，而不是继续以为自己那份就是全部。
  return json({ ok: true, ...result });
}

// GET /api/sync/:code 供前端拉取后走本地并集合并——码即凭证，猜码即读到他人收藏/打卡，读侧也限流
// （不同于短链分享的只读语义：短链是用户主动生成公开的一次性分享，同步码是长期私有凭证）。
export async function handleSyncGet(env, code, ip) {
  if (!env.SYNC_CODE_STORE) return json({ error: "unavailable" }, 503);
  if (!SYNC_CODE_RE.test(code)) return json({ error: "not_found" }, 404);

  if (!(await checkRateLimit(env.RATE_LIMITER, ip || "unknown", "sync-rw", SYNC_RW_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

  const stub = env.SYNC_CODE_STORE.getByName(code);
  const data = await stub.read();
  if (!data) return json({ error: "not_found" }, 404);
  return json(data);
}

export function apiNotFound() {
  return json({ error: "not_found" }, 404);
}
