"use strict";
// Users: GET /api/users, POST /api/user-save, /api/user-delete, /api/password
// Backed by Supabase admin_users. Hashes/salts NEVER leave the server.
const { loadEnv, sbReq, readJson, sendJson } = require("./_lib/sb");
const { getSession, needRole, checkPw } = require("./_lib/auth");
const crypto = require("crypto");

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: crypto.scryptSync(String(pw || ""), salt, 64).toString("hex") };
}

module.exports = async (request, response) => {
  try {
    const env = loadEnv();
    const url = new URL(request.url, "http://x");
    const pathn = url.pathname;
    const me = needRole(getSession(request, env.SESSION_SECRET || ""), "admin");
    const findUser = async (username) => {
      const r = await sbReq(env, "GET", "/rest/v1/admin_users?username=eq." + encodeURIComponent(username) + "&select=username,role,salt,password_hash,must_change", true);
      return r.ok && Array.isArray(r.json) && r.json[0] ? r.json[0] : null;
    };
    if (pathn === "/api/users" && request.method === "GET") {
      if (!me) return sendJson(response, 401, { error: "login required" });
      const r = await sbReq(env, "GET", "/rest/v1/admin_users?select=username,role&order=username", true);
      if (!r.ok) return sendJson(response, 502, { error: "users read failed" });
      return sendJson(response, 200, { users: (r.json || []).map((u) => ({ user: u.username, role: u.role })) });
    }
    if (pathn === "/api/user-save" && request.method === "POST") {
      if (!me) return sendJson(response, 401, { error: "login required" });
      const b = (await readJson(request)) || {};
      const username = String(b.user || "").trim();
      if (!username) return sendJson(response, 400, { error: "username required" });
      const ex = await findUser(username);
      if (!ex) {
        if (!b.pass) return sendJson(response, 400, { error: "password required" });
        const h = hashPw(b.pass);
        const r = await sbReq(env, "POST", "/rest/v1/admin_users", { username, role: b.role || "editor", salt: h.salt, password_hash: h.hash, must_change: true }, true);
        if (!r.ok) return sendJson(response, 502, { error: "user create failed" });
      } else {
        const patch = { role: b.role || ex.role };
        if (b.pass) { const h = hashPw(b.pass); patch.salt = h.salt; patch.password_hash = h.hash; patch.must_change = true; }
        const r = await sbReq(env, "PATCH", "/rest/v1/admin_users?username=eq." + encodeURIComponent(username), patch, true);
        if (!r.ok) return sendJson(response, 502, { error: "user update failed" });
      }
      return sendJson(response, 200, { ok: true });
    }
    if (pathn === "/api/user-delete" && request.method === "POST") {
      if (!me) return sendJson(response, 401, { error: "login required" });
      const b = (await readJson(request)) || {};
      if (b.user === me.user) return sendJson(response, 400, { error: "khud ko delete nahi" });
      const r = await sbReq(env, "DELETE", "/rest/v1/admin_users?username=eq." + encodeURIComponent(b.user || ""), true);
      if (!r.ok) return sendJson(response, 502, { error: "delete failed" });
      return sendJson(response, 200, { ok: true });
    }
    if (pathn === "/api/password" && request.method === "POST") {
      const s = getSession(request, env.SESSION_SECRET || "");
      if (!s) return sendJson(response, 401, { error: "login required" });
      const b = (await readJson(request)) || {};
      const u = await findUser(s.user);
      if (!u || !checkPw(String(b.old || ""), u.salt, u.password_hash)) return sendJson(response, 401, { error: "purana password galat" });
      const h = hashPw(String(b.new || "x"));
      const r = await sbReq(env, "PATCH", "/rest/v1/admin_users?username=eq." + encodeURIComponent(s.user), { salt: h.salt, password_hash: h.hash, must_change: false }, true);
      if (!r.ok) return sendJson(response, 502, { error: "password change failed" });
      return sendJson(response, 200, { ok: true });
    }
    return sendJson(response, 404, { error: "not found" });
  } catch (e) { return sendJson(response, 500, { error: "server error" }); }
};
