"use strict";
// Media (auth: editor+). Supabase Storage bucket: website-media.
// Routes (via vercel.json rewrites): GET /api/media, GET /api/media-usage,
// POST /api/media/sign, POST /api/media/register, POST /api/media-delete,
// POST /api/upload (legacy base64, ≤3MB only).
const { loadEnv, sbReq, readJson, sendJson } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");

const BUCKET = "website-media";
const ALLOWED = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".mp4": "video/mp4" };

function sanitize(name, folder) {
  let base = String(name || "file").replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase().slice(0, 60) || "file";
  folder = String(folder || "misc").replace(/[^a-z]/g, "") || "misc";
  return { folder, base };
}
function pubUrl(env, key) {
  return env.SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + key.split("/").map(encodeURIComponent).join("/");
}
function keyOf(p) {
  let s = String(p || "");
  const i = s.indexOf(BUCKET + "/");
  if (i >= 0) s = decodeURIComponent(s.slice(i + BUCKET.length + 1));
  s = s.replace(/^assets\//, "").replace(/^\//, "").split("?")[0];
  return s;
}
async function signKey(env, key, expiresIn) {
  // Upload-sign endpoint (for NEW objects) returns {url, token}; PUT goes to url?token=...
  const r = await sbReq(env, "POST", "/storage/v1/object/upload/sign/" + BUCKET + "/" + key.split("/").map(encodeURIComponent).join("/"), { expiresIn: expiresIn || 600 }, true);
  if (!r.ok || !r.json || !r.json.token) return r;
  const base = env.SUPABASE_URL.replace(/\/$/, "");
  // NOTE: response `url` lacks the /storage/v1 prefix — build PUT target explicitly from key+token
  r.json.signedUrl = base + "/storage/v1/object/upload/sign/" + BUCKET + "/" + key.split("/").map(encodeURIComponent).join("/") + "?token=" + r.json.token;
  return r;
}

module.exports = async (request, response) => {
  try {
    const env = loadEnv();
    const url = new URL(request.url, "http://x");
    const pathn = url.pathname;
    const me = needRole(getSession(request, env.SESSION_SECRET || ""), "editor");
    if (!me) return sendJson(response, 401, { error: "login required" });

    // GET /api/media — Storage listing
    if (pathn === "/api/media" && request.method === "GET") {
      const r = await sbReq(env, "POST", "/storage/v1/object/list/" + BUCKET, { prefix: "", limit: 1000 }, true);
      if (!r.ok || !Array.isArray(r.json)) return sendJson(response, 502, { error: "media list failed" });
      return sendJson(response, 200, {
        files: r.json.filter((f) => f.name && !f.name.endsWith("/")).map((f) => ({
          path: pubUrl(env, f.name), key: f.name,
          size: (f.metadata && f.metadata.size) || 0,
        })),
      });
    }
    // GET /api/media-usage?path=
    if (pathn === "/api/media-usage") {
      const p = url.searchParams.get("path") || "";
      const uses = [];
      try {
        const fs = require("fs"), path = require("path");
        const files = ["index.html", "about.html", "journalist-welfare.html", "membership.html", "activities.html", "news.html", "gallery.html", "contact.html", "consumer.html", "js/main.js", "css/style.css"];
        const needle = String(p).split("/").pop();
        for (const f of files) {
          try {
            const h = fs.readFileSync(path.join(process.cwd(), f), "utf8");
            if (needle && h.includes(needle)) uses.push(f);
          } catch (e) {}
        }
      } catch (e) {}
      try {
        for (const t of ["news", "activities", "gallery", "leaders"]) {
          const rr = await sbReq(env, "GET", "/rest/v1/" + t + "?select=id&limit=1", undefined, true);
          void rr;
        }
      } catch (e) {}
      return sendJson(response, 200, { uses });
    }
    const b = (await readJson(request)) || {};
    // POST /api/media/sign {name,mime,folder} -> {uploadUrl,path,key}
    if (pathn === "/api/media/sign" && request.method === "POST") {
      const mime = String(b.mime || "image/jpeg");
      const extMap = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/svg+xml": ".svg", "video/mp4": ".mp4" };
      const ext = extMap[mime];
      if (!ext) return sendJson(response, 400, { error: "sirf jpg/png/webp/svg/mp4" });
      if (mime.startsWith("video") && (b.folder || "") !== "video") return sendJson(response, 400, { error: "video sirf video folder me" });
      const s = sanitize(b.name, b.folder);
      const key = s.folder + "/" + s.base + "-" + Date.now().toString(36) + ext;
      const r = await signKey(env, key, 600);
      if (!r.ok || !r.json || !r.json.signedUrl) {
        const detail = r.json && (r.json.message || r.json.error) ? " - " + (r.json.message || r.json.error) : "";
        const why = r.skipped ? "Vercel me SUPABASE_SECRET_KEY set nahi hai" : ("storage status " + (r.status || r.error || "unknown") + detail);
        return sendJson(response, 502, { error: "sign failed (" + why + ")" });
      }
      const base = env.SUPABASE_URL.replace(/\/$/, "");
      const uploadUrl = r.json.signedUrl.startsWith("http") ? r.json.signedUrl : base + r.json.signedUrl;
      return sendJson(response, 200, { uploadUrl, path: pubUrl(env, key), key });
    }
    // POST /api/media/register {path,key,name,mime,size,folder}
    if (pathn === "/api/media/register" && request.method === "POST") {
      const key = b.key || keyOf(b.path);
      if (!key || key.includes("..")) return sendJson(response, 400, { error: "invalid" });
      const row = {
        file_url: b.path || pubUrl(env, key), file_name: String(b.name || key.split("/").pop() || ""),
        mime_type: b.mime || "", size_bytes: +b.size || 0,
        folder: b.folder || key.split("/")[0] || "", uploaded_by: me.user || "",
      };
      const r = await sbReq(env, "POST", "/rest/v1/media", row, true);
      if (!r.ok) return sendJson(response, 502, { error: "register failed" });
      return sendJson(response, 200, { ok: true, path: row.file_url });
    }
    // POST /api/media-delete {path}
    if (pathn === "/api/media-delete" && request.method === "POST") {
      const key = keyOf(b.path);
      if (!key || key.includes("..")) return sendJson(response, 400, { error: "invalid" });
      await fetch(env.SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + key.split("/").map(encodeURIComponent).join("/"), {
        method: "DELETE", headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: "Bearer " + env.SUPABASE_SECRET_KEY },
      }).catch(() => {});
      const rows = await sbReq(env, "GET", "/rest/v1/media?select=id,file_url", undefined, true);
      if (rows.ok && Array.isArray(rows.json)) {
        for (const m of rows.json) {
          if (m.file_url === b.path || String(m.file_url || "").endsWith("/" + key.split("/").pop())) {
            await sbReq(env, "DELETE", "/rest/v1/media?id=eq." + m.id, undefined, true);
          }
        }
      }
      return sendJson(response, 200, { ok: true });
    }
    // POST /api/upload (legacy base64, ≤3MB only — larger files must use signed flow)
    if (pathn === "/api/upload" && request.method === "POST") {
      const m = String(b.data || "").match(/^data:(image\/(?:jpeg|png|webp|svg\+xml)|video\/mp4);base64,(.+)$/);
      if (!m) return sendJson(response, 400, { error: "sirf jpg/png/webp/svg/mp4" });
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 3 * 1024 * 1024) return sendJson(response, 413, { error: "file bahut badi hai — signed upload use karein" });
      const ext = m[1].includes("jpeg") ? ".jpg" : m[1].includes("png") ? ".png" : m[1].includes("webp") ? ".webp" : m[1].includes("svg") ? ".svg" : ".mp4";
      if (m[1].startsWith("video") && (b.folder || "") !== "video") return sendJson(response, 400, { error: "video sirf video folder me" });
      const s = sanitize(b.name, b.folder);
      const key = s.folder + "/" + s.base + ext;
      const ctl = new AbortController(); const to = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, 20000);
      const up = await fetch(env.SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + key.split("/").map(encodeURIComponent).join("/"), {
        method: "POST", headers: { apikey: env.SUPABASE_SECRET_KEY, Authorization: "Bearer " + env.SUPABASE_SECRET_KEY, "Content-Type": m[1], "x-upsert": "true" }, body: buf, signal: ctl.signal,
      }).catch(() => null);
      clearTimeout(to);
      if (!up || !up.ok) return sendJson(response, 502, { error: "upload failed" });
      const pub = pubUrl(env, key);
      await sbReq(env, "POST", "/rest/v1/media", { file_url: pub, file_name: s.base + ext, mime_type: m[1], size_bytes: buf.length, folder: s.folder, uploaded_by: me.user || "" }, true);
      return sendJson(response, 200, { ok: true, path: pub });
    }
    return sendJson(response, 404, { error: "not found" });
  } catch (e) { return sendJson(response, 500, { error: "server error" }); }
};
