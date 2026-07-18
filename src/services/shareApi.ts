// 短链分享 I/O（design「后端·短链分享」）：与 /api/share 通信。任何失败（网络/超量/未配置）一律
// 返回 null，调用方回退到既有链接/QR/JSON 通道——后端从不是分享功能的前提（同天气接入哲学）。
import type { TripItem } from "../logic/types";

export interface MarksPayload { favs: string[]; visited: string[]; }
export interface TripPayload { trip: TripItem[]; tripStart?: string; }

const apiUrl = (path: string) => `${import.meta.env.BASE_URL}api/${path}`;

async function postShare(type: "marks" | "trip", payload: MarksPayload | TripPayload): Promise<string | null> {
  try {
    const res = await fetch(apiUrl("share"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.code === "string" ? data.code : null;
  } catch (e) { return null; }
}

export const createMarksShareLink = (payload: MarksPayload) => postShare("marks", payload);
export const createTripShareLink = (payload: TripPayload) => postShare("trip", payload);

export type FetchedShare = { type: "marks"; payload: MarksPayload } | { type: "trip"; payload: TripPayload };

export async function fetchShare(code: string): Promise<FetchedShare | null> {
  try {
    const res = await fetch(apiUrl(`share/${encodeURIComponent(code)}`));
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "marks" && data.payload) return { type: "marks", payload: data.payload };
    if (data.type === "trip" && data.payload) return { type: "trip", payload: data.payload };
    return null;
  } catch (e) { return null; }
}
