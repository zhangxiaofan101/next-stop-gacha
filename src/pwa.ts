/* M70：Service Worker 注册。PROD 门控——dev 服务器（5173）绝不注册，否则一份陈年 SW
   会按 scope 劫持本机整个 localhost:5173（vite preview 的 4173 是独立 origin，注册无碍且
   正好用于上线前真浏览器核验）。load 后才注册，不与启动期的数据/插画请求抢带宽；失败
   静默——SW 从不是可用性前提（同「后端从不是可用性前提」哲学），注册失败=退回今天的
   纯在线形态。sw.js 由 tools/build_sw.mjs 生成，dev 下压根不存在，门控同时避免 404 噪音。 */
export function registerSW() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
