"use strict";
// POST /api/logout — clear session cookie.
const { clearSidCookie } = require("./_lib/auth");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end('{"error":"method not allowed"}');
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": clearSidCookie(), "Cache-Control": "no-store" });
  response.end('{"ok":true}');
};
