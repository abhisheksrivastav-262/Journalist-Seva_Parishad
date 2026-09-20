"use strict";
// POST /api/login — verify against Supabase admin_users (same scrypt params),
// issue HMAC-signed session cookie. Same contract + messages as admin/server.js.
const { loadEnv, sbReq, readJson, sendJson } = require("./_lib/sb");
const { checkPw, signSession, sidCookie } = require("./_lib/auth");

module.exports = async (request, response) => {
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
};
