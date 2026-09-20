"use strict";
// GET /api/public/content — public bundle (Supabase-first, static fallback).
// Same response contract as admin/server.js buildPublicBundle.
const { loadEnv, sbReq } = require("./_lib/sb");
const { buildBundle } = require("./_lib/bundle");

let cache = { at: 0, data: null };
const TTL = 60 * 1000;

module.exports = async (request, response) => {
  try {
    if (request.method !== "GET") {
      response.writeHead(405, { "Content-Type": "application/json" });
      response.end('{"error":"method not allowed"}');
      return;
    }
    const now = Date.now();
    let out = cache.data && now - cache.at < TTL ? cache.data : null;
    if (!out) {
      const env = loadEnv();
      out = await buildBundle(env, sbReq);
      cache = { at: Date.now(), data: out };
    }
    const body = JSON.stringify(out);
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": Buffer.byteLength(body),
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    });
    response.end(body);
  } catch (e) {
    const fb = JSON.stringify({ source: "local" });
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(fb), "Cache-Control": "no-store" });
    response.end(fb);
  }
};
