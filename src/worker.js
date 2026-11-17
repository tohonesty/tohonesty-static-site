import { EmailMessage } from "cloudflare:email";
import { validateEnvelope } from "./protocol.js";

const MAX_BODY_BYTES = 16_384;

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function buildEmail(ciphertext) {
  const body = [
    "-----BEGIN TOHONESTY CIPHERTEXT-----",
    ciphertext,
    "-----END TOHONESTY CIPHERTEXT-----"
  ].join("\r\n");

  return new EmailMessage(
    "tohonesty@tohonesty.com",
    "tohonesty@tohonesty.com",
    `From: Tohonesty Intake <tohonesty@tohonesty.com>\r\n` +
      `To: tohonesty@tohonesty.com\r\n` +
      `Subject: Encrypted Tohonesty intake [2026-11-r1]\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n` +
      `Auto-Submitted: auto-generated\r\n\r\n${body}\r\n`
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/contact") return env.ASSETS.fetch(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "allow": "POST, OPTIONS", "cache-control": "no-store" } });
    }
    if (request.method !== "POST") return jsonResponse({ ok: false }, 405, { "allow": "POST, OPTIONS" });
    if ((request.headers.get("content-type") || "").split(";", 1)[0].trim() !== "application/json") return jsonResponse({ ok: false }, 415);

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_BODY_BYTES) return jsonResponse({ ok: false }, 413);

    const rawBody = await request.text();
    if (!rawBody || new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return jsonResponse({ ok: false }, 413);

    let envelope;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ ok: false }, 400);
    }
    if (!validateEnvelope(envelope)) return jsonResponse({ ok: false }, 400);

    const ciphertext = btoa(String.fromCharCode(...new TextEncoder().encode(rawBody)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

    await env.CONTACT_EMAIL.send(buildEmail(ciphertext));
    return jsonResponse({ ok: true }, 202);
  }
};
