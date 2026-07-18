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
// 闲置超一年的同步码任其自然过期。**码严格 POST-only**：PUT 只能覆盖已存在的码（未知/已过期码
// 一律 404），不支持「过期后用同一个码 PUT 复活」——这条与旧注释矛盾的说法已删（F50，2026-07-19
// codex 复核指出：handleSyncPut 对不存在的 key 直接 404，从未创建，两条不变式不能同时成立）。
// 过期后用户需解绑本机指针、重新走 POST 生成新码；本机 localStorage 恒为真相源，数据不丢。
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

// F47（2026-07-19 codex 复核）：这是简单的按天计数器，非原子 read-modify-write。Cloudflare KV
// 同一个 key 每秒最多写 1 次——一次 syncNow() 必然紧跟着 GET 后又 PUT，两个 handler 共用
// `sync-rw` bucket，会在不到一秒内对同一个限流计数 key 写两次，真实 KV 上可能拒绝第二次写。
// 限流本身只是「劝退随手滥用」的辅助层，不是核心功能的前提——所以这里整体 fail-open：计数读写
// 出任何问题（含撞上同 key 每秒 1 次的写频限）都放行而不是把异常炸给调用方，与本项目「后端从不
// 是可用性前提」的一贯哲学一致。代价是高并发下计数会不准（可能漏计），接受：这是防滥用而非防护
// 核心资产的安全边界，且本项目实际量级远够不上触发这个边界。
async function checkRateLimit(kv, ip, bucket, limit) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `ratelimit:${bucket}:${ip}:${day}`;
    const cur = Number(await kv.get(key)) || 0;
    if (cur >= limit) return false;
    await kv.put(key, String(cur + 1), { expirationTtl: 86400 });
    return true;
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

  const read = await readBoundedJson(request, MAX_PAYLOAD_BYTES);
  if (!read.ok) return json({ error: read.reason }, read.reason === "too_large" ? 413 : 400);
  const body = read.json;
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

// PUT /api/sync/:code——码必须已由 POST 创建过（未知码 404，不允许客户端凭空指定码建记录，否则
// 退化成任意 key 的免费无限存储）。限流检查提到 KV 存在性读之前（F47：未知码原本能绕开限流白嫖
// KV 读配额）。**服务器端做加法合并而非信任客户端整份覆盖**（F48，2026-07-19 codex 复核）：两台
// 设备各自 GET 旧快照→本地合并→PUT 回去，如果两次 PUT 在客户端往返的秒级窗口内相互重叠，
// plain KV 没有 compare-and-swap，后落地的写会 last-write-wins 吞掉前一台设备独占的新增项。
// 改成服务器收到 PUT 时先读现有值、与请求 payload 取并集再写回，把竞态窗口从「一次完整客户端
// 往返（用户点按钮到网络返回，可能数秒）」收窄到「这次请求内部 GET→PUT 的间隔（毫秒级、单个
// Worker 调用内)」——多设备同好从不会移除（只增不减，这条从建站就是全项目分享机制统一的合并
// 语义），故服务器端加法合并对正常时序完全透明，行为不变；真发生了竞态，落败的那次写也已经是
// 「旧值∪自己」的并集而非被整体替换，只会丢当轮两台设备互相都还没看到对方的那一小撮增量，下次
// 任一方再次同步即可自愈。剩余的竞态窗口在纯 KV（无 Durable Object/无 CAS）上无法做到 100%
// 原子闭合；这个功能是用户手动点按钮触发（非后台自动轮询），两台物理设备真的在同一个毫秒级窗口
// 内点同一个同步按钮的概率可忽略——引入 Durable Object 换取这后一段收益，超出这个功能实际需要
// 的复杂度，故未做（免费额度内也够用，Durable Object 在 Workers 免费计划仅限 SQLite backend，
// 并非不可行，只是判断不值得为这个残余风险再加一层绑定/迁移复杂度）。
export async function handleSyncPut(request, env, code) {
  if (!env.APP_KV) return json({ error: "unavailable" }, 503);
  if (!SYNC_CODE_RE.test(code)) return json({ error: "not_found" }, 404);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await checkRateLimit(env.APP_KV, ip, "sync-rw", SYNC_RW_LIMIT_PER_DAY))) return json({ error: "rate_limited" }, 429);

  const key = `sync:${code}`;
  const existing = await env.APP_KV.get(key);
  if (!existing) return json({ error: "not_found" }, 404);

  const read = await readBoundedJson(request, MAX_PAYLOAD_BYTES);
  if (!read.ok) return json({ error: read.reason }, read.reason === "too_large" ? 413 : 400);
  const body = read.json;
  if (!validateMarksPayload(body)) return json({ error: "bad_payload" }, 400);

  let existingData;
  try { existingData = JSON.parse(existing); } catch (e) { existingData = { favs: [], visited: [] }; }
  const merged = {
    favs: [...new Set([...(Array.isArray(existingData.favs) ? existingData.favs : []), ...body.favs])],
    visited: [...new Set([...(Array.isArray(existingData.visited) ? existingData.visited : []), ...body.visited])],
    updatedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(merged);
  if (byteLength(raw) > MAX_PAYLOAD_BYTES) return json({ error: "too_large" }, 413);

  await env.APP_KV.put(key, raw, { expirationTtl: SYNC_TTL_SECONDS });
  // 把服务器端合并后的真实结果回传——调用方 GET 时的快照可能已经过时（这次 PUT 之间另一台设备
  // 也写过），让客户端拿真正落盘的并集去更新本机状态，而不是继续以为自己那份就是全部。
  return json({ ok: true, ...merged });
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
