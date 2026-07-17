const GAME_PREFIX = "/next-stop-gacha";

export function isGamePath(pathname) {
  return pathname === GAME_PREFIX || pathname.startsWith(`${GAME_PREFIX}/`);
}

// F42：设计要求「HTML/JS 与数据分别长缓存，改数据不失效代码缓存」。Vite 的
// assets/* 文件名自带内容 hash，数据 chunk 也已改名为内容 hash（见 tools/build.py）——
// 两者都可安全 immutable 长缓存。manifest.json/index.html 是唯一会变but文件名不变
// 的入口，必须短缓存+revalidate，否则客户端会长期看着旧 manifest 指向的旧 chunk。
const HASHED_ASSET = /^\/(assets\/|data\/chunk-\d+-[0-9a-f]+\.json$)/;

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (!isGamePath(url.pathname)) {
    return new Response("Not Found", { status: 404 });
  }

  if (url.pathname === GAME_PREFIX) {
    url.pathname = `${GAME_PREFIX}/`;
    return Response.redirect(url.toString(), 308);
  }

  const strippedPath = url.pathname.slice(GAME_PREFIX.length) || "/";
  url.pathname = strippedPath;
  const response = await env.ASSETS.fetch(new Request(url, request));
  const headers = new Headers(response.headers);
  headers.set("x-content-owner", "next-stop-gacha-repo");
  headers.set(
    "cache-control",
    HASHED_ASSET.test(strippedPath)
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  fetch: handleRequest,
};
