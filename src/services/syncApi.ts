// 同步码云同步 I/O（design「后端·同步码云同步」）：与 /api/sync 通信。任何失败（网络/超量/未配置）
// 一律返回失败态，调用方保持本机数据不变——后端从不是同步功能的前提（同 shareApi.ts 哲学）。
export interface SyncMarks { favs: string[]; visited: string[]; }
export interface SyncSnapshot extends SyncMarks { updatedAt: string; }

const apiUrl = (path: string) => `${import.meta.env.BASE_URL}api/${path}`;

function toSnapshot(data: any): SyncSnapshot | null {
  if (!Array.isArray(data?.favs) || !Array.isArray(data?.visited)) return null;
  return { favs: data.favs, visited: data.visited, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "" };
}

export async function createSyncCode(payload: SyncMarks): Promise<string | null> {
  try {
    const res = await fetch(apiUrl("sync"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.code === "string" ? data.code : null;
  } catch (e) { return null; }
}

// F50（2026-07-19 codex 复核）：同步码是严格 POST-only 的——过期/输错的码不能靠 PUT 复活，UI 需要
// 区分「码确实不存在/已过期」和「单纯网络抖动」，才能引导用户正确解绑重开，而不是让人反复重试一个
// 死码。区分 404 与其它失败态，供 syncNow() 据此给出更明确的提示、并在必要时自动清掉本机指针。
export type PullResult = { ok: true; data: SyncSnapshot } | { ok: false; reason: "not_found" | "error" };
export async function pullSync(code: string): Promise<PullResult> {
  try {
    const res = await fetch(apiUrl(`sync/${encodeURIComponent(code)}`));
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "error" };
    const snap = toSnapshot(await res.json());
    return snap ? { ok: true, data: snap } : { ok: false, reason: "error" };
  } catch (e) { return { ok: false, reason: "error" }; }
}

// PUT 现在服务器端做并集合并（F48），响应体带回真正落盘的合并结果——可能比本机知道的更全（另一台
// 设备在本机 GET 之后、PUT 之前也推送过），调用方应以此结果为准更新本机状态，而不是自己那份局部并集。
export async function pushSync(code: string, payload: SyncMarks): Promise<SyncSnapshot | null> {
  try {
    const res = await fetch(apiUrl(`sync/${encodeURIComponent(code)}`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return toSnapshot(await res.json());
  } catch (e) { return null; }
}
