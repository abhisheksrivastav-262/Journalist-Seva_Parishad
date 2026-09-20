"use strict";
// GET /api/data — panel bootstrap. EXACT same contract as admin/server.js:
// {fields, globals, seo, lists, settings, fieldDefs, globalDefs}
// Values come from Supabase; labels/structure from committed config + static HTML chips.
const fs = require("fs");
const path = require("path");
const { loadEnv, sbReq, sendJson } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");
const { FIELDS, GLOBALS, bareTag } = require("./_lib/fields");
const M = require("./_lib/map");

function chipVals(html, attr) {
  const s = new Set();
  const re = new RegExp("data-" + attr + "=\"([^\"]+)\"", "g");
  let m; while ((m = re.exec(html))) { if (m[1] !== "all") s.add(m[1]); }
  return [...s];
}
function chipLabel(html, attr, v) {
  const m = html.match(new RegExp('<button class="chip" data-' + attr + '="' + v + '">([^<]*)<'));
  return m ? m[1] : v;
}
function readStatic(rel) {
  try { return fs.readFileSync(path.join(process.cwd(), rel), "utf8"); } catch (e) { return ""; }
}

module.exports = async (request, response) => {
  try {
    const env = loadEnv();
    const me = needRole(getSession(request, env.SESSION_SECRET || ""), "viewer");
    if (!me) return sendJson(response, 401, { error: "login required" });

    const get = async (p) => sbReq(env, "GET", "/rest/v1/" + p, undefined, false);
    const [sc, leaders, news, acts, gal, members, notices, donors, objectives, consumer, ads, donation, social] = await Promise.all([
      get("site_content?select=key,value"), get("leaders?select=*&order=sort_order"), get("news?select=*&order=sort_order"),
      get("activities?select=*&order=sort_order"), get("gallery?select=*&order=sort_order"), get("members?select=*&order=created_at"),
      get("notices?select=*&order=created_at"), get("donors?select=*&order=created_at"), get("objectives?select=*&order=sort_order"),
      get("awareness_pages?select=*&order=created_at"), get("ads?select=*&order=sort_order"), get("donation_settings?select=*&limit=1"),
      get("social_links?select=platform,url"),
    ]);
    const site = {};
    if (sc.ok && Array.isArray(sc.json)) sc.json.forEach((x) => { site[x.key] = x.value; });

    const fields = {};
    for (const f of FIELDS) fields[f.id] = f.id in site ? site[f.id] : f.old;
    const globals = {};
    for (const g of GLOBALS) globals[g.key] = ("global:" + g.key) in site ? site["global:" + g.key] : g.value;
    const seo = {};
    for (const k of Object.keys(site)) {
      const m = k.match(/^seo:(.+):(title|desc)$/);
      if (m) { seo[m[1]] = seo[m[1]] || {}; seo[m[1]][m[2]] = site[k]; }
    }
    const nwH = readStatic("news.html"), acH = readStatic("activities.html"), glH = readStatic("gallery.html");
    const mkCats = (html, attr, rows, catOf) => {
      const map = {};
      chipVals(html, attr).forEach((v) => { map[v] = chipLabel(html, attr, v); });
      (rows || []).forEach((r) => { const c = catOf(r); if (c && !(c in map)) map[c] = c; });
      return Object.keys(map).map((value) => ({ value, label: map[value] }));
    };
    const newsRows = news.ok && Array.isArray(news.json) ? news.json : [];
    const actRows = acts.ok && Array.isArray(acts.json) ? acts.json : [];
    const galRows = gal.ok && Array.isArray(gal.json) ? gal.json : [];
    const L = (r) => (r.ok && Array.isArray(r.json) ? r.json : []);
    const lists = {
      leaders: L(leaders).map(M.leaderToPanel),
      news: newsRows.map(M.newsToPanel),
      activities: actRows.map(M.actToPanel),
      gallery: galRows.map(M.galToPanel),
      newsCats: mkCats(nwH, "filter", newsRows, (r) => r.category),
      actCats: mkCats(acH, "filter", actRows, (r) => r.category),
      galCats: mkCats(glH, "gfilter", galRows, (r) => r.category),
      ads: L(ads).map(M.adToPanel),
      members: L(members).map(M.memberToPanel),
      notices: L(notices).map(M.noticeToPanel),
      donors: L(donors).map(M.donorToPanel),
      objectives: L(objectives).map(M.objectiveToPanel),
      consumer: L(consumer).map(M.consumerToPanel),
    };
    const drow = (donation.ok && Array.isArray(donation.json) && donation.json[0]) ? donation.json[0] : null;
    const settings = {
      slideSecs: site["global:slideSecs"] !== undefined ? (+site["global:slideSecs"] || 5) : 5,
      bank: drow ? M.bankToPanel(drow) : {},
      social: M.socialRowsToPanel(social.ok && Array.isArray(social.json) ? social.json : []),
    };
    const fieldDefs = FIELDS.map((f) => ({
      id: f.id, page: f.page, section: f.section, file: f.file, label: f.label,
      type: f.type || "input", bare: bareTag(f.old),
      current: fields[f.id] !== undefined && fields[f.id] !== "" ? fields[f.id] : f.old,
    }));
    return sendJson(response, 200, { fields, globals, seo, lists, settings, fieldDefs, globalDefs: GLOBALS });
  } catch (e) { return sendJson(response, 500, { error: "server error" }); }
};
