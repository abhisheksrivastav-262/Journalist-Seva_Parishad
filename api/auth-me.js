"use strict";
// GET /api/me — session status (includes must_change from admin_users).
const { loadEnv, sbReq, sendJson } = require("./_lib/sb");
const { getSession } = require("./_lib/auth");

module.exports = async (request, response) => {
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
};
