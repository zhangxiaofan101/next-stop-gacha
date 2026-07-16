const GAME_PREFIX = "/next-stop-gacha";

export function isGamePath(pathname) {
  return pathname === GAME_PREFIX || pathname.startsWith(`${GAME_PREFIX}/`);
}

export async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (!isGamePath(url.pathname)) {
    return new Response("Not Found", { status: 404 });
  }

  if (url.pathname === GAME_PREFIX) {
    url.pathname = `${GAME_PREFIX}/`;
    return Response.redirect(url.toString(), 308);
  }

  url.pathname = url.pathname.slice(GAME_PREFIX.length) || "/";
  const response = await env.ASSETS.fetch(new Request(url, request));
  const headers = new Headers(response.headers);
  headers.set("x-content-owner", "next-stop-gacha-repo");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  fetch: handleRequest,
};
