"use strict";
// POST /api/publish — disabled in production (content goes live instantly via Supabase).
// Response contract matches what admin/panel.html expects (changed[], warnings[]).
const { sendJson } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");

module.exports = async (request, response) => {
  if (request.method !== "POST") return sendJson(response, 405, { error: "method not allowed" });
  const { loadEnv } = require("./_lib/sb");
  const me = needRole(getSession(request, (loadEnv().SESSION_SECRET || "")), "editor");
  if (!me) return sendJson(response, 401, { error: "login required" });
  return sendJson(response, 200, {
    ok: true,
    changed: [],
    warnings: ["Vercel production me content Supabase se turant live hota hai — publish ki zaroorat nahi."],
  });
};
