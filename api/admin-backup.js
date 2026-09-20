"use strict";
// Backups: filesystem backups don't exist in production (Git history + Supabase cover it).
// GET /api/backups -> empty lists (panel-compatible shape). POST /api/rollback -> disabled message.
const { sendJson, loadEnv } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");

module.exports = async (request, response) => {
  const me = needRole(getSession(request, (loadEnv().SESSION_SECRET || "")), "editor");
  if (!me) return sendJson(response, 401, { error: "login required" });
  const url = new URL(request.url, "http://x");
  if (url.pathname === "/api/backups" && request.method === "GET") {
    return sendJson(response, 200, { backups: [], activity: [] });
  }
  if (url.pathname === "/api/rollback" && request.method === "POST") {
    return sendJson(response, 400, { error: "Rollback production me disabled hai — Git history / Supabase use karein" });
  }
  return sendJson(response, 404, { error: "not found" });
};
