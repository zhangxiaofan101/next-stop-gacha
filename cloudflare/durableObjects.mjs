// F47/F48（2026-07-19 codex 复核第二轮）：plain KV 既没有跨请求原子 read-modify-write，也有「同一个
// key 每秒最多写 1 次」的硬限制——用 KV 实现的限流计数器和「读旧值→并集→整份写回」在真实并发/高频
// 请求下都不成立（codex 用受限频约束的 fake KV 与并发 barrier fake 都复现了）。Durable Object 的存储
// 操作天然带 input/output gate：同一个实例上，即使两个 RPC 调用并发到达，运行时也会把它们的存储读写
// 串行化，方法体内部（哪怕跨 await）不会被另一个调用的存储操作插队——这正是 KV 给不了的原子性。
// Workers 免费计划可以用 Durable Object，只是仅限 SQLite storage backend（旧版 KV backend 才要付费）。
import { DurableObject } from "cloudflare:workers";

// 一个实例对应一个 (bucket, ip, day) 维度，天級别用不同实例名天然隔离，无需显式重置计数。
// 24 小时后自毁存储，避免长期攒下大量早已过期、没人会再查的小计数器 DO 占用免费额度里的存储写配额。
const RATE_LIMIT_TTL_MS = 25 * 60 * 60 * 1000;

export class RateLimiter extends DurableObject {
  async checkAndIncrement(limit) {
    const cur = (await this.ctx.storage.get("count")) ?? 0;
    if (cur >= limit) return false;
    await this.ctx.storage.put("count", cur + 1);
    if (!(await this.ctx.storage.getAlarm())) {
      await this.ctx.storage.setAlarm(Date.now() + RATE_LIMIT_TTL_MS);
    }
    return true;
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

// 一个实例对应一个同步码。DO 存储没有 KV 那种 expirationTtl，用 alarm 自己实现「闲置过期」：每次
// create/merge（POST/PUT）都把 alarm 往后挪，alarm 真触发说明这期间没人再同步过，直接清空存储——
// 之后 read/merge 都会因为 provisioned 标记消失而判定为「未创建」，与 KV 版本的过期行为一致（严格
// POST-only，过期不可用同码 PUT 复活，见 F50）。
const SYNC_TTL_MS = 400 * 24 * 60 * 60 * 1000;

export class SyncCodeStore extends DurableObject {
  // POST：调用方已经生成好候选码并路由到这个实例——如果已经 provisioned 说明码撞了，返回 null
  // 让调用方重掷；否则原子建档。同一个实例上两个并发 create() 调用会被 input gate 串行化，先到的
  // 那个建档成功，后到的看见 provisioned=true 直接返回 null，不会双写。
  async create(favs, visited) {
    if (await this.ctx.storage.get("provisioned")) return null;
    const updatedAt = new Date().toISOString();
    await this.ctx.storage.put({ provisioned: true, favs, visited, updatedAt });
    await this.ctx.storage.setAlarm(Date.now() + SYNC_TTL_MS);
    return { favs, visited, updatedAt };
  }

  async read() {
    if (!(await this.ctx.storage.get("provisioned"))) return null;
    const [favs, visited, updatedAt] = await Promise.all([
      this.ctx.storage.get("favs"),
      this.ctx.storage.get("visited"),
      this.ctx.storage.get("updatedAt"),
    ]);
    return { favs, visited, updatedAt };
  }

  // PUT：未 provisioned（从未 create 过，或已过期自毁）一律 null，调用方据此返回 404——码严格
  // POST-only，PUT 不能凭空生造/复活。已存在时做服务器端并集合并：读现值、取并集、整份写回，全程
  // 没有 await 外部 I/O，input gate 保证这整段对同一实例的其它并发调用是原子的——两个设备真的同时
  // PUT 同一个码，也不会有「后写的整体覆盖前写的独占新增项」，因为它们的 get→put 根本不会交错执行。
  // maxBytes 由调用方传入（client 提交的单份 payload 在 handler 里已经查过一次，但合并后可能超标，
  // 这里判断超标就直接不落盘、返回 tooLarge，不写「一半」也不悄悄截断）。
  async merge(favs, visited, maxBytes) {
    if (!(await this.ctx.storage.get("provisioned"))) return null;
    const [curFavs, curVisited] = await Promise.all([
      this.ctx.storage.get("favs"),
      this.ctx.storage.get("visited"),
    ]);
    const mergedFavs = [...new Set([...(curFavs || []), ...favs])];
    const mergedVisited = [...new Set([...(curVisited || []), ...visited])];
    const updatedAt = new Date().toISOString();
    const merged = { favs: mergedFavs, visited: mergedVisited, updatedAt };
    if (maxBytes && new TextEncoder().encode(JSON.stringify(merged)).length > maxBytes) {
      return { tooLarge: true };
    }
    await this.ctx.storage.put(merged);
    await this.ctx.storage.setAlarm(Date.now() + SYNC_TTL_MS);
    return merged;
  }

  async alarm() {
    await this.ctx.storage.deleteAll(); // 闲置过期：清空后 read()/merge() 都判定为未创建
  }
}
