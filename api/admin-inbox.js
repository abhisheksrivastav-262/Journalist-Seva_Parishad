"use strict";
// Inbox: GET /api/inbox, GET /api/inbox.csv, PATCH/DELETE /api/inbox/:id
// Merges contact_messages + membership_applications into the panel shape.
const { loadEnv, sbReq, readJson, sendJson } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");

function sbStatus(s) {
  const m = { new: "unread", contacted: "replied", done: "archived", read: "read", replied: "replied", archived: "archived", unread: "unread" };
  return m[String(s || "new")] || "unread";
}
function panelStatus(s) {
  const m = { unread: "new", read: "read", replied: "contacted", archived: "done" };
  return m[String(s || "unread")] || "new";
}
function toPanel(type, r) {
  const d = type === "contact"
    ? { name: r.name || "", mobile: r.mobile || "", email: r.email || "", subject: r.subject || "", message: r.message || "" }
    : { name: r.name || "", mobile: r.mobile || "", email: r.email || "", city: r.city || "", district: r.district || "", state: r.state || "", org: r.media_organization || "", role: r.designation || "", exp: r.journalism_experience || "", message: r.message || "" };
  return { id: type + ":" + r.id, t: r.created_at ? Date.parse(r.created_at) : Date.now(), type, status: panelStatus(r.status), data: d };
}
function parseId(id) {
  const m = String(id || "").match(/^(contact|member):(.+)$/);
  return m ? { table: m[1] === "contact" ? "contact_messages" : "membership_applications", uuid: m[2] } : null;
}

module.exports = async (request, response) => {
  try {
    const env = loadEnv();
    const url = new URL(request.url, "http://x");
    const pathn = url.pathname;
    // CSV download (auth via session cookie on same request)
    if (pathn === "/api/inbox.csv") {
      const me = needRole(getSession(request, env.SESSION_SECRET || ""), "editor");
      if (!me) return sendJson(response, 401, { error: "login required" });
      const c = await sbReq(env, "GET", "/rest/v1/contact_messages?select=*&order=created_at.desc", true);
      const m = await sbReq(env, "GET", "/rest/v1/membership_applications?select=*&order=created_at.desc", true);
      const rows = [["id", "date", "type", "status", "data"]];
      const push = (type, arr) => (arr || []).forEach((r) => rows.push([r.id, r.created_at || "", type, r.status || "", JSON.stringify(r)]));
      if (c.ok) push("contact", c.json);
      if (m.ok) push("member", m.json);
      const csv = rows.map((r) => r.map((cc) => '"' + String(cc).replace(/"/g, '""') + '"').join(",")).join("\n");
      response.writeHead(200, { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=inbox.csv", "Cache-Control": "no-store" });
      response.end(csv);
      return;
    }
    // PATCH / DELETE /api/inbox/:id
    if (pathn.startsWith("/api/inbox/")) {
      const me = needRole(getSession(request, env.SESSION_SECRET || ""), "editor");
      if (!me) return sendJson(response, 401, { error: "login required" });
      const target = parseId(decodeURIComponent(pathn.slice("/api/inbox/".length)));
      if (!target) return sendJson(response, 400, { error: "invalid id" });
      if (request.method === "PATCH") {
        const b = (await readJson(request)) || {};
        const r = await sbReq(env, "PATCH", "/rest/v1/" + target.table + "?id=eq." + target.uuid, { status: sbStatus(b.status) }, true);
        if (!r.ok) return sendJson(response, 502, { error: "update failed" });
        return sendJson(response, 200, { ok: true });
      }
      if (request.method === "DELETE") {
        const r = await sbReq(env, "DELETE", "/rest/v1/" + target.table + "?id=eq." + target.uuid, true);
        if (!r.ok) return sendJson(response, 502, { error: "delete failed" });
        return sendJson(response, 200, { ok: true });
      }
      return sendJson(response, 405, { error: "method not allowed" });
    }
    // GET /api/inbox
    if (pathn === "/api/inbox" && request.method === "GET") {
      const me = needRole(getSession(request, env.SESSION_SECRET || ""), "editor");
      if (!me) return sendJson(response, 401, { error: "login required" });
      const c = await sbReq(env, "GET", "/rest/v1/contact_messages?select=*&order=created_at.desc", true);
      const m = await sbReq(env, "GET", "/rest/v1/membership_applications?select=*&order=created_at.desc", true);
      const inbox = [];
      if (c.ok && Array.isArray(c.json)) c.json.forEach((r) => inbox.push(toPanel("contact", r)));
      if (m.ok && Array.isArray(m.json)) m.json.forEach((r) => inbox.push(toPanel("member", r)));
      inbox.sort((a, b) => b.t - a.t);
      return sendJson(response, 200, { inbox });
    }
    return sendJson(response, 404, { error: "not found" });
  } catch (e) { return sendJson(response, 500, { error: "server error" }); }
};
