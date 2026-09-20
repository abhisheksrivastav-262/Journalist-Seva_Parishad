// Shared Supabase + env helpers for Vercel Functions. Zero dependencies.
// Secrets are NEVER logged, NEVER returned, NEVER sent to the browser.
"use strict";

function loadEnv() {
  const env = {};
  for (const k of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SESSION_SECRET"]) {
    if (process.env[k]) env[k] = process.env[k];
  }
  if (!env.SUPABASE_URL) {
    try {
      const fs = require("fs"), path = require("path");
      const f = path.join(__dirname, "..", "..", "admin", ".env");
      for (const line of fs.readFileSync(f, "utf8").split("\n")) {
        const t = line.trim(); if (!t || t.startsWith("#") || !t.includes("=")) continue;
        const i = t.indexOf("="); const kk = t.slice(0, i).trim();
        if (!env[kk]) env[kk] = t.slice(i + 1).trim();
      }
    } catch (e) { /* no local .env on Vercel — process.env only */ }
  }
  return env;
}

// useSecret=true → service-role key (server-side writes). Otherwise publishable key (RLS applies).
async function sbReq(env, method, p, body, useSecret, timeoutMs, prefer) {
  const key = useSecret ? env.SUPABASE_SECRET_KEY : env.SUPABASE_PUBLISHABLE_KEY;
  if (!env.SUPABASE_URL || !key) return { ok: false, skipped: true };
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, timeoutMs || 8000);
    const r = await fetch(env.SUPABASE_URL + p, {
      method,
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: prefer || "return=representation",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    clearTimeout(to);
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch (e) {}
    return { ok: r.ok, status: r.status, json: j };
  } catch (e) { return { ok: false, error: String((e && e.message) || e).slice(0, 120) }; }
}

module.exports = { loadEnv, sbReq };

async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") return req.body;
    try { return JSON.parse(String(req.body)); } catch (e) { return {}; }
  }
  return new Promise((resolve) => {
    let s = "";
    try {
      req.on("data", (c) => { s += c; });
      req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { resolve({}); } });
      req.on("error", () => resolve({}));
    } catch (e) { resolve({}); }
  });
}

function sendJson(response, code, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  response.writeHead(code, Object.assign(
    { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" },
    extraHeaders || {}
  ));
  response.end(body);
}

module.exports.readJson = readJson;
module.exports.sendJson = sendJson;
