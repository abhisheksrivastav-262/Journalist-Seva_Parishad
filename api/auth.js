"use strict";
// Auth: POST /api/login, POST /api/logout, GET /api/me
// Same contracts as before (merged to stay under Hobby function limits).
const { loadEnv, sbReq, readJson, sendJson } = require("./_lib/sb");
const { checkPw, signSession, getSession, sidCookie, clearSidCookie } = require("./_lib/auth");

async function login(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method not allowed" });
  try {
    const env = loadEnv();
    if (!env.SESSION_SECRET) return sendJson(response, 500, { error: "server misconfigured" });
    const b = (await readJson(request)) || {};
    const username = String(b.user || "").trim();
    const r = await sbReq(env, "GET", "/rest/v1/admin_users?username=eq." + encodeURIComponent(username) + "&select=username,role,salt,password_hash,must_change", undefined, true);
    const u = r.ok && Array.isArray(r.json) && r.json[0] ? r.json[0] : null;
    if (!u || !checkPw(String(b.pass || ""), u.salt, u.password_hash)) {
      await new Promise((res) => setTimeout(res, 600));
      return sendJson(response, 401, { error: "गलत username/password" });
    }
    const token = signSession(u.username, u.role, env.SESSION_SECRET);
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": sidCookie(token, 2592000),
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify({ ok: true, user: u.username, role: u.role, mustChange: !!u.must_change }));
  } catch (e) { return sendJson(response, 500, { error: "server error" }); }
}

async function logout(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method not allowed" });
  response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": clearSidCookie(), "Cache-Control": "no-store" });
  response.end('{"ok":true}');
}

async function me(request, response) {
  try {
    const env = loadEnv();
    const s = getSession(request, env.SESSION_SECRET || "");
    if (!s) return sendJson(response, 200, { user: null });
    let mustChange = false;
    try {
      const r = await sbReq(env, "GET", "/rest/v1/admin_users?username=eq." + encodeURIComponent(s.user) + "&select=must_change", undefined, true);
      if (r.ok && Array.isArray(r.json) && r.json[0]) mustChange = !!r.json[0].must_change;
    } catch (e) {}
    return sendJson(response, 200, { user: s.user, role: s.role, mustChange });
  } catch (e) { return sendJson(response, 200, { user: null }); }
}

module.exports = async (request, response) => {
  const url = new URL(request.url, "http://x");
  if (url.pathname === "/api/login") return login(request, response);
  if (url.pathname === "/api/logout") return logout(request, response);
  return me(request, response);
};
