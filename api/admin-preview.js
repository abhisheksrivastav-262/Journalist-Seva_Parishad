"use strict";
// GET /api/preview?page= — production me content turant live hota hai,
// isliye preview ek notice page hai (koi filesystem transform nahi).
const { sendJson, loadEnv } = require("./_lib/sb");
const { getSession, needRole } = require("./_lib/auth");

module.exports = async (request, response) => {
  const me = needRole(getSession(request, (loadEnv().SESSION_SECRET || "")), "editor");
  if (!me) return sendJson(response, 401, { error: "login required" });
  const html = "<!DOCTYPE html><html lang=\"hi\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Preview</title></head><body style=\"font-family:sans-serif;padding:40px;text-align:center\"><h2>Preview ki zaroorat nahi</h2><p>Vercel production me har Save turant live hota hai — website kholkar dekhein.</p><p><a href=\"/\" target=\"_blank\">Website kholein →</a></p></body></html>";
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html), "Cache-Control": "no-store" });
  response.end(html);
};
