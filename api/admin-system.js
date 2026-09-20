"use strict";
// Publish / backups / preview stubs (production-disabled by design).
// Content goes live instantly via Supabase; Git history + Supabase cover recovery.
const { sendJson, loadEnv } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");

module.exports = async (request, response) => {
  const url = new URL(request.url, "http://x");
  const pathn = url.pathname;
  if (pathn === "/api/publish" && request.method === "POST") {
    const me = needRole(getSession(request, (loadEnv().SESSION_SECRET || "")), "editor");
    if (!me) return sendJson(response, 401, { error: "login required" });
    return sendJson(response, 200, {
      ok: true,
      changed: [],
      warnings: ["Vercel production me content Supabase se turant live hota hai — publish ki zaroorat nahi."],
    });
  }
  if (pathn === "/api/backups" && request.method === "GET") {
    const me = needRole(getSession(request, (loadEnv().SESSION_SECRET || "")), "editor");
    if (!me) return sendJson(response, 401, { error: "login required" });
    return sendJson(response, 200, { backups: [], activity: [] });
  }
  if (pathn === "/api/rollback" && request.method === "POST") {
    const me = needRole(getSession(request, (loadEnv().SESSION_SECRET || "")), "editor");
    if (!me) return sendJson(response, 401, { error: "login required" });
    return sendJson(response, 400, { error: "Rollback production me disabled hai — Git history / Supabase use karein" });
  }
  if (pathn === "/api/preview") {
    const me = needRole(getSession(request, (loadEnv().SESSION_SECRET || "")), "editor");
    if (!me) return sendJson(response, 401, { error: "login required" });
    const html = "<!DOCTYPE html><html lang=\"hi\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Preview</title></head><body style=\"font-family:sans-serif;padding:40px;text-align:center\"><h2>Preview ki zaroorat nahi</h2><p>Vercel production me har Save turant live hota hai — website kholkar dekhein.</p><p><a href=\"/\" target=\"_blank\">Website kholein →</a></p></body></html>";
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html), "Cache-Control": "no-store" });
    response.end(html);
    return;
  }
  return sendJson(response, 404, { error: "not found" });
};
