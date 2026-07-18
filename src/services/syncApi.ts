// 同步码云同步 I/O（design「后端·同步码云同步」）：与 /api/sync 通信。任何失败（网络/超量/未配置/
// 未知码）一律返回 null/false，调用方保持本机数据不变——后端从不是同步功能的前提（同 shareApi.ts 哲学）。
export interface SyncMarks { favs: string[]; visited: string[]; }
export interface SyncSnapshot extends SyncMarks { updatedAt: string; }

const apiUrl = (path: string) => `${import.meta.env.BASE_URL}api/${path}`;

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

export async function pullSync(code: string): Promise<SyncSnapshot | null> {
  try {
    const res = await fetch(apiUrl(`sync/${encodeURIComponent(code)}`));
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.favs) || !Array.isArray(data.visited)) return null;
    return { favs: data.favs, visited: data.visited, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "" };
  } catch (e) { return null; }
}

export async function pushSync(code: string, payload: SyncMarks): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`sync/${encodeURIComponent(code)}`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) { return false; }
}
