"use strict";
// GET /health (also served at /api/health) — no auth, no secrets, no I/O.
module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end('{"error":"method not allowed"}');
    return;
  }
  const body = '{"ok":true}';
  response.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
  response.end(body);
};
