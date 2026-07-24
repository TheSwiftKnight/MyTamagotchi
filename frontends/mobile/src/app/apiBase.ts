/** 共享后端（backend/ 的 FastAPI）根地址。
 *
 * 默认从当前页面的 hostname 推导，**不要写死 127.0.0.1**：
 * - 手机扫码打开页面时，127.0.0.1 指向手机自己，所有请求必然失败；
 * - 场馆 WiFi 会不定期重新分配 IP（2026-07-25 凌晨就换过一次），
 *   写死局域网 IP 同样会失效。
 * 用 location.hostname 则桌面（localhost）和手机（局域网 IP）都自动正确。
 *
 * 后端部署到别处时用 VITE_WORLD_API_URL 覆盖（生产走 .env.production 的 /api）。
 */
const BACKEND_PORT = 8000;

export const API_BASE = (
  import.meta.env.VITE_WORLD_API_URL ||
  (typeof window === "undefined"
    ? `http://127.0.0.1:${BACKEND_PORT}/api`
    : `${window.location.protocol}//${window.location.hostname}:${BACKEND_PORT}/api`)
).replace(/\/$/, "");

/** 去掉 /api 后缀的源站地址，用于拼静态资源（如 agent 形象图）。 */
export const API_ORIGIN = API_BASE.replace(/\/api$/, "");
