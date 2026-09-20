// Dev-time generator: snapshots static repo content into api/_lib/defaults.json
// (used by Vercel functions as the "local fallback" baseline).
// Run manually when committed HTML/JS changes:  node api/_lib/gen-defaults.js
// Reads repo files only. Writes only api/_lib/defaults.json. Zero deps.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const readF = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const MAIN_JS = "js/main.js";
const HTML_FILES = ["index.html", "about.html", "journalist-welfare.html", "membership.html", "activities.html", "news.html", "gallery.html", "contact.html", "privacy-policy.html", "terms.html"];

const idx = readF("index.html");
const figs = idx.match(/<figure class="leader-card[\s\S]*?<\/figure>/g) || [];
const leaders = figs.map((f) => {
  const src = (f.match(/src="([^"]+)"/) || [])[1] || "";
  const alt = (f.match(/alt="([^"]*)"/) || [])[1] || "";
  const cap = (f.match(/<figcaption>([^<]*)<\/figcaption>/) || [])[1] || "";
  const full = /leader-card--full/.test(f);
  const w = (f.match(/width="(\d+)"/) || [])[1] || "480";
  const h = (f.match(/height="(\d+)"/) || [])[1] || "544";
  return { img: src, alt: alt || cap, cap, full, w, h, active: true };
});

const nw = readF("news.html");
const arts = nw.match(/<article class="news-card[\s\S]*?<\/article>/g) || [];
const news = arts.map((a) => {
  const g = (n) => (a.match(n) || [])[1] || "";
  const ps = [...a.matchAll(/<p>([^<]*)<\/p>/g)].map((m) => m[1]);
  return { cat: g(/data-category="([^"]+)"/), img: g(/src="([^"]+)"/), alt: g(/alt="([^"]*)"/), tag: g(/<span class="tag">([^<]*)<\/span>/), date: g(/<p class="meta">([^<]*)<\/p>/), title: g(/<h3>([^<]*)<\/h3>/), share: g(/data-share="wa" data-title="([^"]*)"/), desc: ps[ps.length - 1] || "", active: true };
});

const ac = readF("activities.html");
const tis = ac.match(/<article class="t-item[\s\S]*?<\/article>/g) || [];
const activities = tis.map((a) => {
  const g = (n) => (a.match(n) || [])[1] || "";
  const ps = [...a.matchAll(/<p class="meta">([^<]*)<\/p>|<p>([^<]*)<\/p>/g)].map((m) => m[1] || m[2]);
  return { cat: g(/data-category="([^"]+)"/), date: g(/<div class="t-date"><b>([^<]*)<\/b>/), place: g(/<span>([^<]*)<\/span>/), tag: g(/<span class="tag">([^<]*)<\/span>/), title: g(/<h3[^>]*>([^<]*)<\/h3>/), meta: ps[0] || "", desc: ps[ps.length - 1] || "", active: true };
});

const gl = readF("gallery.html");
const gis = gl.match(/<figure class="g-item[\s\S]*?<\/figure>/g) || [];
const gallery = gis.map((a) => {
  const g = (n) => (a.match(n) || [])[1] || "";
  return { cat: g(/data-gcat="([^"]+)"/), img: g(/src="([^"]+)"/), alt: g(/alt="([^"]*)"/), cap: g(/<figcaption>([^<]*)<\/figcaption>/), tall: /g-item--tall/.test(a), active: true };
});

const chipVals = (html, attr) => { const s = new Set(); const re = new RegExp("data-" + attr + "=\"([^\"]+)\"", "g"); let m; while ((m = re.exec(html))) { if (m[1] !== "all") s.add(m[1]); } return [...s]; };
const chipLabel = (html, attr, v) => { const m = html.match(new RegExp('<button class="chip" data-' + attr + '="' + v + '">([^<]*)<')); return m ? m[1] : v; };
const actCats = chipVals(ac, "filter").map((v) => ({ value: v, label: chipLabel(ac, "filter", v) }));
const newsCats = chipVals(nw, "filter").map((v) => ({ value: v, label: chipLabel(nw, "filter", v) }));
const galCats = chipVals(gl, "gfilter").map((v) => ({ value: v, label: chipLabel(gl, "gfilter", v) }));

const objectives = ["पत्रकारों के हितों की रक्षा के लिए प्रयास", "पत्रकार समुदाय में एकता और सहयोग", "पत्रकारों की समस्याओं को उचित मंच तक पहुंचाने का प्रयास", "पत्रकारिता के सम्मान और गरिमा को बढ़ावा देना", "पत्रकारों के कल्याण से जुड़े प्रयास"].map((t) => ({ text: t, active: true }));

const js = readF(MAIN_JS);
const mAds = js.match(/const ADS = (\[[\s\S]*?\n  \]);/);
let ads = [];
try { ads = (new Function("return " + mAds[1]))(); } catch (e) { ads = []; }

const seo = {};
for (const f of [...HTML_FILES, "consumer.html"]) {
  const h = readF(f);
  seo[f] = { title: (h.match(/<title>([^<]*)<\/title>/) || [])[1] || "", desc: (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "" };
}

const out = { leaders, news, activities, gallery, actCats, newsCats, galCats, objectives, ads, seo };
fs.writeFileSync(path.join(__dirname, "defaults.json"), JSON.stringify(out, null, 1));
console.log("defaults.json written:",
  `leaders=${leaders.length} news=${news.length} activities=${activities.length} gallery=${gallery.length} objectives=${objectives.length} ads=${ads.length}`);
