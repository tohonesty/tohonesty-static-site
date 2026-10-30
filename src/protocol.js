const BASE64URL = /^[A-Za-z0-9_-]+$/;
const ENVELOPE_KEYS = ["alg", "ct", "ek", "iv", "kid", "v"];

function decodeBase64Url(value) {
  if (typeof value !== "string" || !BASE64URL.test(value)) throw new Error("invalid encoding");
  let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = base64.length % 4;
  if (remainder === 2) base64 += "==";
  else if (remainder === 3) base64 += "=";
  else if (remainder !== 0) throw new Error("invalid encoding");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function validateEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== ENVELOPE_KEYS.length || !keys.every((key, i) => key === [...ENVELOPE_KEYS].sort()[i])) return false;
  if (value.v !== 1 || value.alg !== "RSA-OAEP-256+A256GCM" || value.kid !== "2026-10-r1") return false;
  try {
    return decodeBase64Url(value.iv).byteLength === 12 &&
      decodeBase64Url(value.ek).byteLength === 384 &&
      decodeBase64Url(value.ct).byteLength >= 17;
  } catch {
    return false;
  }
}
