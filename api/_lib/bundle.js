// Public bundle builder for Vercel (port of buildPublicBundle in admin/server.js).
// Difference: local baseline comes from committed api/_lib/defaults.json
// (static site content) instead of live admin/data.json. Same changed-flag semantics.
"use strict";
const { FIELDS, GLOBALS } = require("./fields");
const D = require("./defaults.json");

function splitCap(cap) {
  const ms = ["जर्नलिस्ट सेवा परिषद्", "जर्नलिस्ट सेवा परिषद", "जनरल सेवा परिषद"];
  cap = String(cap || "");
  for (const m of ms) { const i = cap.indexOf(m); if (i !== -1) return { designation: cap.slice(0, i).trim(), name: cap.slice(i + m.length).trim() }; }
  return { designation: "", name: cap };
}
function catLabel(cats, val) { const c = (cats || []).find((x) => x.value === val); return c ? c.label : (val || ""); }
function stripTags(s) { return String(s || "").replace(/<[^>]*>/g, "").trim(); }
function jstr(o) { try { return JSON.stringify(o); } catch (e) { return ""; } }

function staticADS() {
  try {
    const fs = require("fs"), path = require("path");
    const js = fs.readFileSync(path.join(process.cwd(), "js", "main.js"), "utf8");
    const m = js.match(/const ADS = (\[[\s\S]*?\n  \]);/);
    return (new Function("return " + m[1]))();
  } catch (e) { return null; }
}

async function sbTable(env, sbReq, table, order) {
  const r = await sbReq(env, "GET", "/rest/v1/" + table + "?select=*" + (order ? ("&order=" + order) : ""), undefined, false);
  if (r.ok && Array.isArray(r.json)) return { ok: true, rows: r.json };
  return { ok: false, rows: null, status: r.status, error: r.error, skipped: r.skipped };
}

async function buildBundle(env, sbReq) {
  const L = D, out = { source: "supabase", res: {} }, R = {};
  const setR = (n, v) => { R[n] = v; };
  const fldOld = (id) => { const f = FIELDS.find((x) => x.id === id); return f ? f.old : ""; };
  const globDef = (k) => { const g = GLOBALS.find((x) => x.key === k); return g ? g.value : ""; };
  // — leaders —
  try {
    const r = await sbTable(env, sbReq, "leaders", "sort_order");
    const loc = (L.leaders || []).filter((l) => l.active !== false);
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((l) => l.status === "live").map((l) => {
        const locOne = (loc || []).find((x) => { const s = splitCap(x.cap); return (s.name || x.alt || "") === l.name; });
        return { img: l.photo_url || "", alt: (locOne && (locOne.alt || locOne.cap)) || l.name || "", cap: (locOne && locOne.cap) || ((l.designation ? l.designation + " " : "") + (l.name || "")).trim(), full: !!(locOne && locOne.full), w: (locOne && locOne.w) || "480", h: (locOne && locOne.h) || "544", active: true };
      });
      const sS = items.map((x) => x.img + "|" + x.cap).join(";;");
      const sL = loc.map((l) => { const s = splitCap(l.cap); return l.img + "|" + ((s.designation ? s.designation + " " : "") + (s.name || l.alt || "")).trim(); }).join(";;");
      out.leaders = { changed: sS !== sL, items }; setR("leaders", "supabase");
    } else { out.leaders = { changed: false, items: [] }; setR("leaders", "local"); }
  } catch (e) { out.leaders = { changed: false, items: [] }; setR("leaders", "local"); }
  // — welfare —
  try {
    const r = await sbTable(env, sbReq, "welfare_cards", "slot");
    const eff = (i) => {
      const F = FIELDS.find((f) => f.id === "home_wt" + i), Dd = FIELDS.find((f) => f.id === "home_wd" + i);
      return { t: stripTags(F ? F.old : ""), d: stripTags(Dd ? Dd.old : "") };
    };
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((w) => w.active !== false).map((w) => ({ slot: w.slot, title: stripTags(w.title || ""), body: stripTags(w.body || "") }));
      const sS = items.map((x) => x.slot + ":" + x.title + ":" + x.body).join(";;");
      const loc = []; for (let i = 1; i <= 6; i++) { const e = eff(i); loc.push(i + ":" + e.t + ":" + e.d); }
      out.welfare = { changed: sS !== loc.join(";;"), items }; setR("welfare", "supabase");
    } else { out.welfare = { changed: false, items: [] }; setR("welfare", "local"); }
  } catch (e) { out.welfare = { changed: false, items: [] }; setR("welfare", "local"); }
  // — news —
  try {
    const r = await sbTable(env, sbReq, "news", "sort_order");
    const loc = (L.news || []).filter((n) => n.active !== false);
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((n) => n.published !== false).map((n) => ({ cat: n.category || "", img: n.featured_image || "", alt: n.title || "", tag: catLabel(L.newsCats, n.category), date: n.date_text || "", title: n.title || "", share: n.title || "", desc: n.description || "", active: true }));
      const sS = items.map((x) => [x.title, x.desc, x.img, x.cat, x.date].join("|")).join(";;");
      const sL = loc.map((n) => [n.title, n.desc, n.img, n.cat, n.date].join("|")).join(";;");
      out.news = { changed: sS !== sL, items, cats: L.newsCats || [] }; setR("news", "supabase");
    } else { out.news = { changed: false, items: [], cats: L.newsCats || [] }; setR("news", "local"); }
  } catch (e) { out.news = { changed: false, items: [], cats: L.newsCats || [] }; setR("news", "local"); }
  // — activities —
  try {
    const r = await sbTable(env, sbReq, "activities", "sort_order");
    const loc = (L.activities || []).filter((a) => a.active !== false);
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((a) => a.published !== false).map((a) => ({ cat: a.category || "", date: a.date_text || "", place: "", tag: catLabel(L.actCats, a.category), title: a.title || "", meta: "", desc: a.description || "", img: a.image_url || "", active: true }));
      const sS = items.map((x) => [x.title, x.desc, x.img, x.cat, x.date].join("|")).join(";;");
      const sL = loc.map((a) => [a.title, a.desc, a.img || "", a.cat, a.date].join("|")).join(";;");
      out.activities = { changed: sS !== sL, items, cats: L.actCats || [] }; setR("activities", "supabase");
    } else { out.activities = { changed: false, items: [], cats: L.actCats || [] }; setR("activities", "local"); }
  } catch (e) { out.activities = { changed: false, items: [], cats: L.actCats || [] }; setR("activities", "local"); }
  // — gallery (empty table → always local fallback) —
  try {
    const r = await sbTable(env, sbReq, "gallery", "sort_order");
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((g) => g.active !== false).map((g) => ({ cat: g.category || "", img: g.image_url || "", cap: g.caption || g.title || "", title: g.title || "", tall: false, active: true }));
      out.gallery = { changed: true, items, cats: L.galCats || [] }; setR("gallery", "supabase");
    } else { out.gallery = { changed: false, items: [], cats: L.galCats || [] }; setR("gallery", "local"); }
  } catch (e) { out.gallery = { changed: false, items: [], cats: L.galCats || [] }; setR("gallery", "local"); }
  // — objectives —
  try {
    const r = await sbTable(env, sbReq, "objectives", "sort_order");
    const loc = (L.objectives || []).filter((t) => t.active !== false).map((t) => t.text || t.title || "");
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((t) => t.active !== false).map((t) => ({ text: t.title || t.text || "" }));
      out.objectives = { changed: jstr(items.map((x) => x.text)) !== jstr(loc), items }; setR("objectives", "supabase");
    } else { out.objectives = { changed: false, items: [] }; setR("objectives", "local"); }
  } catch (e) { out.objectives = { changed: false, items: [] }; setR("objectives", "local"); }
  // — notices —
  try {
    const r = await sbTable(env, sbReq, "notices", "created_at");
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((n) => n.published !== false).map((n) => ({ title: n.title || "", desc: n.description || "", date: n.date_text || "", place: "", kind: "" }));
      out.notices = { changed: true, items }; setR("notices", "supabase");
    } else { out.notices = { changed: false, items: [] }; setR("notices", "local"); }
  } catch (e) { out.notices = { changed: false, items: [] }; setR("notices", "local"); }
  // — consumer (awareness_pages) —
  try {
    const r = await sbTable(env, sbReq, "awareness_pages", "created_at");
    if (r.ok && r.rows.length) {
      const items = r.rows.filter((c) => c.published !== false).map((c) => ({ title: c.page_title || c.title || "", date: "", desc: c.content || "" }));
      out.consumer = { changed: true, items }; setR("consumer", "supabase");
    } else { out.consumer = { changed: false, items: [] }; setR("consumer", "local"); }
  } catch (e) { out.consumer = { changed: false, items: [] }; setR("consumer", "local"); }
  // — donors —
  try {
    const r = await sbTable(env, sbReq, "donors", "created_at");
    if (r.ok && r.rows.length) {
      const items = r.rows.map((d) => ({ name: d.name || "", amount: d.amount || "", note: d.message || d.purpose || "", date: "" }));
      out.donors = { changed: true, items }; setR("donors", "supabase");
    } else { out.donors = { changed: false, items: [] }; setR("donors", "local"); }
  } catch (e) { out.donors = { changed: false, items: [] }; setR("donors", "local"); }
  // — ads (merge over static file array) —
  try {
    const st = staticADS();
    const r = await sbTable(env, sbReq, "ads", "sort_order");
    if (r.ok && r.rows.length && st) {
      const merged = r.rows.filter((a) => a.active !== false).map((a, i) => {
        const b = st[i] || { label: "विज्ञापन", title: "", text: "", cta: "", href: "#", theme: "house" };
        return { label: b.label, title: (a.title || b.title), text: b.text, cta: b.cta, href: (a.link_url || b.href), theme: b.theme, img: (a.image_url || b.img) };
      });
      out.ads = { changed: jstr(merged) !== jstr(st), items: merged }; setR("ads", "supabase");
    } else { out.ads = { changed: false, items: [] }; setR("ads", "local"); }
  } catch (e) { out.ads = { changed: false, items: [] }; setR("ads", "local"); }
  // — donation —
  try {
    const r = await sbTable(env, sbReq, "donation_settings", null);
    const mf = FIELDS.find((f) => f.id === "mem_qr");
    const locQR = mf ? (((mf.old.match(/src="([^"]+)"/) || [])[1]) || "") : "assets/donate-qr-placeholder.svg";
    if (r.ok && r.rows.length) {
      const d = r.rows[0];
      const bank = { bankName: d.bank_name || "", accNo: d.account_number || "", ifsc: d.ifsc || "", holder: d.account_holder || "", upiId: d.upi_id || "" };
      const locSig = locQR + "|||||";
      const supSig = (d.qr_image_url || "") + "|" + [d.bank_name, d.account_number, d.ifsc, d.account_holder, d.upi_id].map((x) => x || "").join("|");
      out.donation = { changed: supSig !== locSig, qr: d.qr_image_url || "", bank }; setR("donation", "supabase");
    } else { out.donation = { changed: false, qr: "", bank: {} }; setR("donation", "local"); }
  } catch (e) { out.donation = { changed: false, qr: "", bank: {} }; setR("donation", "local"); }
  // — social —
  try {
    const r = await sbTable(env, sbReq, "social_links", null);
    if (r.ok && r.rows.length) {
      const links = {};
      for (const s of r.rows) {
        const p = String(s.platform || "").toLowerCase();
        const k = p.includes("face") ? "fb" : p.includes("insta") ? "ig" : (/^(x\b|twitter)/.test(p)) ? "x" : p.includes("youtu") ? "yt" : (p.includes("whatsapp") ? "wa" : null);
        if (k && s.url) links[k] = s.url;
      }
      out.social = { changed: Object.keys(links).length > 0, links }; setR("social", "supabase");
    } else { out.social = { changed: false, links: {} }; setR("social", "local"); }
  } catch (e) { out.social = { changed: false, links: {} }; setR("social", "local"); }
  // — texts (only differing keys) —
  try {
    const r = await sbTable(env, sbReq, "site_content", null);
    const texts = [];
    if (r.ok && r.rows.length) {
      const m = {}; r.rows.forEach((x) => { m[x.key] = x.value; });
      for (const f of FIELDS) {
        if (!(f.id in m)) continue;
        if (m[f.id] !== f.old && texts.length < 300) texts.push({ old: f.old, new: m[f.id] });
      }
      for (const g of GLOBALS) {
        if (("global:" + g.key) in m && m["global:" + g.key] !== g.value && texts.length < 300) texts.push({ old: g.value, new: m["global:" + g.key] });
      }
      setR("texts", "supabase");
    } else setR("texts", "local");
    out.texts = texts;
  } catch (e) { setR("texts", "local"); out.texts = []; }
  const vals = Object.values(R);
  out.source = vals.length && vals.every((v) => v === "supabase") ? "supabase" : (vals.some((v) => v === "supabase") ? "mixed" : "local");
  out.res = R;
  return out;
}

module.exports = { buildBundle, splitCap, catLabel, stripTags, jstr };
