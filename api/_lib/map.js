// Row mappers: Supabase rows <-> admin-panel shapes. Pure functions, zero deps.
// Mirrors the derivations in admin/panel.html saveItem (cap from pad+naam, share from title).
"use strict";

function escQ(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

// ---- Supabase row -> panel shape (for /api/data bootstrap) ----
function leaderToPanel(l, i) {
  return {
    img: l.photo_url || "", naam: l.name || "",
    pad: l.designation || "",
    cap: ((l.designation ? l.designation + " " : "") + (l.name || "")).trim(),
    alt: l.name || "", full: false, w: "480", h: "544",
    active: l.status !== "draft",
  };
}
function newsToPanel(n) {
  return {
    cat: n.category || "event", img: n.featured_image || "", alt: n.title || "",
    tag: n.category || "event", date: n.date_text || "", title: n.title || "",
    share: n.title || "", desc: n.description || n.content || "", active: n.published !== false,
  };
}
function actToPanel(a) {
  return {
    img: a.image_url || "", title: a.title || "", cat: a.category || "event",
    tag: a.category || "कार्यक्रम", date: a.date_text || "", place: a.location || "",
    meta: "", desc: a.description || "", active: a.published !== false,
  };
}
function galToPanel(g) {
  return {
    img: g.image_url || "", cap: g.caption || g.title || "", alt: g.caption || g.title || "",
    cat: g.category || "event", tall: false, active: g.active !== false,
  };
}

// ---- panel shape -> Supabase row (for /api/save writes) ----
function slugify(s, i) {
  const t = String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return "news-" + (i + 1) + (t ? "-" + t : "");
}
function leaderToRow(o, i) {
  const cap = ((o.pad || "").trim() + " " + (o.naam || "").trim()).trim() || o.cap || "";
  return {
    name: (o.naam || "").trim() || cap, designation: (o.pad || "").trim(),
    photo_url: o.img || "", status: o.active === false ? "draft" : "live", sort_order: i,
  };
}
function newsToRow(o, i) {
  return {
    slug: slugify(o.title || o.share, i), title: o.title || "", category: o.cat || "",
    description: o.desc || "", content: o.desc || "", featured_image: o.img || null,
    date_text: o.date || "", published: o.active !== false, sort_order: i,
  };
}
function actToRow(o, i) {
  return {
    title: o.title || "", description: o.desc || "", image_url: o.img || null,
    date_text: o.date || "", location: o.place || "", category: o.cat || "",
    published: o.active !== false, sort_order: i,
  };
}
function galToRow(o, i) {
  return {
    title: o.cap || o.title || "", image_url: o.img || "", category: o.cat || "",
    caption: o.cap || "", active: o.active !== false, sort_order: i,
  };
}
function memberToRow(o) {
  return {
    name: o.name || "", mobile: o.phone || o.mobile || "", email: o.email || "",
    organization: o.newspaper || o.organization || "", designation: o.role || o.designation || "",
    city: o.city || "", district: o.district || "", state: o.state || "",
    membership_id: o.memberId || o.membership_id || "", photo_url: o.img || o.photo || "",
    status: o.active === false ? "draft" : "active",
    join_date: o.joinDate || o.join_date || null, notes: o.address || o.notes || "",
  };
}
function noticeToRow(o) {
  return {
    title: o.title || "", description: o.desc || o.description || "",
    date_text: o.date || "", published: o.active !== false,
  };
}
function donorToRow(o) {
  return {
    name: o.name || "", amount: o.amount || "",
    message: o.note || o.message || "", purpose: o.purpose || "",
  };
}
function objectiveToRow(o, i) {
  return { title: o.text || o.title || "", description: o.desc || o.description || "", active: o.active !== false, sort_order: i };
}
function consumerToRow(o, i) {
  const t = o.title || "";
  const slug = ("awareness-" + (i + 1) + "-" + String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40)).replace(/-+$/, "");
  return {
    page_title: t, slug, content: o.desc || "", featured_image: o.img || null,
    published: o.active !== false, seo_title: t, seo_description: String(o.desc || "").slice(0, 160),
  };
}
function adToRow(o, i) {
  return {
    title: o.title || "", image_url: o.img || null, link_url: o.href || null,
    placement: "home", active: true, sort_order: i,
  };
}

function memberToPanel(m) {
  return {
    img: m.photo_url || "", name: m.name || "", phone: m.mobile || "",
    memberId: m.membership_id || "", address: m.notes || "",
    newspaper: m.organization || "", role: m.designation || "",
    city: m.city || "", district: m.district || "", state: m.state || "",
    email: m.email || "", active: m.status !== "draft",
  };
}
function noticeToPanel(n) {
  return {
    kind: "event", title: n.title || "", date: n.date_text || "", place: "",
    desc: n.description || "", active: n.published !== false,
  };
}
function donorToPanel(d) {
  return {
    name: d.name || "", amount: d.amount || "", date: "",
    note: d.message || d.purpose || "", purpose: d.purpose || "", active: true,
  };
}
function objectiveToPanel(t) {
  return { text: t.title || t.text || "", desc: t.description || "", active: t.active !== false };
}
function consumerToPanel(c) {
  return { title: c.page_title || c.title || "", date: "", desc: c.content || "", img: c.featured_image || "", active: c.published !== false };
}
function adToPanel(a) {
  return {
    img: a.image_url || null, label: "विज्ञापन", title: a.title || "", text: "",
    cta: "संपर्क करें →", href: a.link_url || "", theme: "house", active: a.active !== false,
  };
}
function bankToPanel(d) {
  d = d || {};
  return { upiId: d.upi_id || "", bankName: d.bank_name || "", accNo: d.account_number || "", ifsc: d.ifsc || "", holder: d.account_holder || "", branch: d.branch || "" };
}
function bankToRow(b) {
  b = b || {};
  return { bank_name: b.bankName || "", account_holder: b.holder || "", account_number: b.accNo || "", ifsc: b.ifsc || "", branch: b.branch || "", upi_id: b.upiId || "" };
}
function socialRowsToPanel(rows) {
  const s = { fb: "", ig: "", x: "", yt: "" };
  for (const r of rows || []) {
    const p = String(r.platform || "").toLowerCase();
    const k = p.includes("face") ? "fb" : p.includes("insta") ? "ig" : (/^(x\b|twitter)/.test(p)) ? "x" : p.includes("youtu") ? "yt" : null;
    if (k && r.url) s[k] = r.url;
  }
  return s;
}
function socialToRows(s) {
  s = s || {};
  const rows = [];
  if (s.fb) rows.push({ platform: "facebook", url: s.fb, active: true });
  if (s.ig) rows.push({ platform: "instagram", url: s.ig, active: true });
  if (s.x) rows.push({ platform: "x", url: s.x, active: true });
  if (s.yt) rows.push({ platform: "youtube", url: s.yt, active: true });
  return rows;
}

module.exports = {
  escQ,
  leaderToPanel, newsToPanel, actToPanel, galToPanel,
  memberToPanel, noticeToPanel, donorToPanel, objectiveToPanel, consumerToPanel, adToPanel,
  bankToPanel, bankToRow, socialRowsToPanel, socialToRows,
  leaderToRow, newsToRow, actToRow, galToRow,
  memberToRow, noticeToRow, donorToRow, objectiveToRow, consumerToRow, adToRow,
  slugify,
};
