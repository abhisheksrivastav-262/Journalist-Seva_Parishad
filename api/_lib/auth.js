// Stateless admin sessions for serverless: HMAC-signed cookies (no storage).
// Same cookie name/attrs/behavior as the file-based server (sid, HttpOnly, Path=/, SameSite=Lax).
// Password verification reuses the EXACT scrypt params from admin/server.js.
"use strict";
const crypto = require("crypto");

function b64u(s) {
  return Buffer.from(String(s), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s) {
  s = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf8");
}

function signSession(user, role, secret) {
  const p = b64u(JSON.stringify({ u: user, r: role, exp: Date.now() + 30 * 864e5 }));
  const sig = crypto.createHmac("sha256", secret).update(p).digest("hex");
  return p + "." + sig;
}

function verifySession(token, secret) {
  try {
    if (!token || !secret) return null;
    const i = String(token).lastIndexOf(".");
    if (i < 0) return null;
    const p = String(token).slice(0, i), sig = String(token).slice(i + 1);
    const good = crypto.createHmac("sha256", secret).update(p).digest("hex");
    if (sig.length !== good.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
    const d = JSON.parse(unb64u(p));
    if (!d.exp || d.exp < Date.now()) return null;
    if (!d.u) return null;
    return { user: d.u, role: d.r || "viewer" };
  } catch (e) { return null; }
}

function getSession(req, secret) {
  const c = (req.cookies && req.cookies.sid) || "";
  return verifySession(c, secret);
}

function needRole(session, role) {
  const rank = { viewer: 0, editor: 1, admin: 2 };
  if (!session) return null;
  if ((rank[session.role] ?? -1) < (rank[role] ?? 99)) return null;
  return session;
}

// EXACT same params as admin/server.js checkPw: scryptSync(pass, salt, 64) hex, timingSafeEqual.
function checkPw(pw, salt, hash) {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(crypto.scryptSync(String(pw || ""), salt, 64).toString("hex")),
      Buffer.from(String(hash || ""))
    );
  } catch (e) { return false; }
}

function sidCookie(token, maxAge) {
  return `sid=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
}
function clearSidCookie() {
  return "sid=; HttpOnly; Path=/; Max-Age=0";
}

module.exports = { signSession, verifySession, getSession, needRole, checkPw, sidCookie, clearSidCookie };
