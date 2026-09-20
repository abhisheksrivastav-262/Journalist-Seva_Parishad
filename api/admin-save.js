"use strict";
// POST /api/save — admin writes straight to Supabase (live immediately).
// Same request contract as admin/server.js: {kind, id, value}.
// kinds: field | globals | seo | list | bank | social | slideSecs
const { loadEnv, sbReq, readJson, sendJson } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");
const M = require("./_lib/map");

const LIST_TABLE = { leaders: "leaders", news: "news", activities: "activities", gallery: "gallery", members: "members", notices: "notices", donors: "donors", objectives: "objectives", consumer: "awareness_pages", ads: "ads" };
const LIST_FN = { leaders: "leaderToRow", news: "newsToRow", activities: "actToRow", gallery: "galToRow", members: "memberToRow", notices: "noticeToRow", donors: "donorToRow", objectives: "objectiveToRow", consumer: "consumerToRow", ads: "adToRow" };

async function upsertSite(env, pairs) {
  if (!pairs.length) return { ok: true };
  return sbReq(env, "POST", "/rest/v1/site_content",
    pairs.map(([key, value]) => ({ key, value: String(value ?? "") })),
    true, 8000, "resolution=merge-duplicates,return=minimal");
}

async function replaceList(env, table, rows) {
  const ex = await sbReq(env, "GET", "/rest/v1/" + table + "?select=id", true);
  if (!ex.ok) return ex;
  const ids = (Array.isArray(ex.json) ? ex.json : []).map((r) => r.id).filter(Boolean);
  if (ids.length) {
    const del = await sbReq(env, "DELETE", "/rest/v1/" + table + "?id=in.(" + ids.join(",") + ")", true);
    if (!del.ok) return del;
  }
  if (rows.length) {
    const ins = await sbReq(env, "POST", "/rest/v1/" + table, rows, true);
    if (!ins.ok) return ins;
  }
  return { ok: true, count: rows.length };
}

async function saveBank(env, b) {
  b = b || {};
  const row = {
    bank_name: b.bankName || "", account_holder: b.holder || "", account_number: b.accNo || "",
    ifsc: b.ifsc || "", branch: b.branch || "", upi_id: b.upiId || "",
  };
  const ex = await sbReq(env, "GET", "/rest/v1/donation_settings?select=id,qr_image_url&limit=1", true);
  if (ex.ok && Array.isArray(ex.json) && ex.json.length && ex.json[0].id) {
    row.qr_image_url = ex.json[0].qr_image_url || "";
    return sbReq(env, "PATCH", "/rest/v1/donation_settings?id=eq." + ex.json[0].id, row, true);
  }
  row.qr_image_url = "";
  return sbReq(env, "POST", "/rest/v1/donation_settings", row, true);
}

async function saveSocial(env, s) {
  s = s || {};
  const ex = await sbReq(env, "GET", "/rest/v1/social_links?select=platform", true);
  const plats = (ex.ok && Array.isArray(ex.json) ? ex.json : []).map((r) => r.platform).filter(Boolean);
  if (plats.length) {
    const del = await sbReq(env, "DELETE", "/rest/v1/social_links?platform=in.(" + plats.join(",") + ")", true);
    if (!del.ok) return del;
  }
  const rows = M.socialToRows(s);
  if (!rows.length) return { ok: true, count: 0 };
  return sbReq(env, "POST", "/rest/v1/social_links", rows, true);
}

module.exports = async (request, response) => {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method not allowed" });
  try {
    const env = loadEnv();
    const me = needRole(getSession(request, env.SESSION_SECRET || ""), "editor");
    if (!me) return sendJson(response, 401, { error: "login required" });
    const b = (await readJson(request)) || {};
    let r = { ok: true };
    if (b.kind === "field") {
      r = await upsertSite(env, [[b.id, b.value]]);
      if (r.ok && b.id === "mem_qr") {
        const m = String(b.value || "").match(/src="([^"]+)"/);
        const qr = m ? m[1] : String(b.value || "");
        const ex = await sbReq(env, "GET", "/rest/v1/donation_settings?select=id&limit=1", true);
        if (ex.ok && Array.isArray(ex.json) && ex.json.length && ex.json[0].id) {
          r = await sbReq(env, "PATCH", "/rest/v1/donation_settings?id=eq." + ex.json[0].id, { qr_image_url: qr }, true);
        } else {
          r = await sbReq(env, "POST", "/rest/v1/donation_settings", { bank_name: "", account_holder: "", account_number: "", ifsc: "", branch: "", upi_id: "", qr_image_url: qr }, true);
        }
      }
    }
    else if (b.kind === "globals") r = await upsertSite(env, [["global:" + b.id, b.value]]);
    else if (b.kind === "slideSecs") r = await upsertSite(env, [["global:slideSecs", String(+b.value || 5)]]);
    else if (b.kind === "seo" && b.value) r = await upsertSite(env, [["seo:" + b.id + ":title", b.value.title || ""], ["seo:" + b.id + ":desc", b.value.desc || ""]]);
    else if (b.kind === "list" && LIST_TABLE[b.id]) {
      const fn = M[LIST_FN[b.id]];
      r = await replaceList(env, LIST_TABLE[b.id], (b.value || []).map((o, i) => fn(o, i)));
    }
    else if (b.kind === "bank") r = await saveBank(env, b.value);
    else if (b.kind === "social") { await saveSocial(env, b.value); r = { ok: true }; }
    else r = { ok: true };
    if (!r.ok) return sendJson(response, 502, { error: "save failed, please retry" });
    return sendJson(response, 200, { ok: true });
  } catch (e) { return sendJson(response, 500, { error: "server error" }); }
};
