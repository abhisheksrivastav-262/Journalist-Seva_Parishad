"use strict";
// POST /api/inbox — public form submissions (contact + membership/donate).
// Mirrors admin/server.js mirrorInboxEntry incl. sbStatus mapping. No auth needed.
const { loadEnv, sbReq, readJson, sendJson } = require("./_lib/sb");

function sbStatus(s) {
  const m = { new: "unread", contacted: "replied", done: "archived", read: "read", replied: "replied", archived: "archived", unread: "unread" };
  return m[String(s || "new")] || "unread";
}

module.exports = async (request, response) => {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method not allowed" });
  try {
    const b = (await readJson(request)) || {};
    const d = (b && b.data) || {};
    const type = b.type || "form";
    let table, row;
    if (type === "contact") {
      table = "contact_messages";
      row = { name: d.name || "", mobile: d.mobile || "", email: d.email || "", subject: d.subject || "", message: d.message || "", status: sbStatus("new") };
    } else {
      table = "membership_applications";
      row = { name: d.name || "", mobile: d.mobile || "", email: d.email || "", city: d.city || "", district: d.district || "", state: d.state || "", media_organization: d.org || "", designation: d.role || "", journalism_experience: d.exp || "", message: d.message || "", status: sbStatus("new") };
    }
    const env = loadEnv();
    const r = await sbReq(env, "POST", "/rest/v1/" + table, row, true);
    if (!r.ok) return sendJson(response, 502, { error: "submission failed, please try WhatsApp" });
    return sendJson(response, 200, { ok: true });
  } catch (e) { return sendJson(response, 500, { error: "server error" }); }
};
