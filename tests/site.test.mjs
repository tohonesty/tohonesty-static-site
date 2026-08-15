import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateEnvelope } from "../src/protocol.js";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public");
const read = (relative) => fs.readFileSync(path.join(publicDir, relative), "utf8");
const htmlFiles = [
  "index.html", "about/index.html", "faqs/index.html", "contact/index.html",
  "privacy-policy/index.html", "client-terms/index.html", "website-terms/index.html",
  "legal-disclosure/index.html", "404.html"
];

test("all required static routes exist and are standalone HTML", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    assert.match(html, /^<!doctype html>/);
    assert.match(html, /<meta name="viewport"/);
    assert.match(html, /\/assets\/css\/site\.css/);
  }
});

test("there are no WordPress, Elementor or jQuery references", () => {
  for (const file of htmlFiles) {
    const html = read(file);
    assert.doesNotMatch(html, /(?:href|src)="\/?(?:wp-content|wp-includes)|wordpress|elementor|jquery|admin-ajax|wp-json/i, file);
  }
});

test("legal wording and dates are preserved", () => {
  const privacy = read("privacy-policy/index.html");
  const client = read("client-terms/index.html");
  const website = read("website-terms/index.html");
  const disclosure = read("legal-disclosure/index.html");

  assert.match(privacy, /Last updated: 15 August 2026/);
  assert.match(
    privacy,
    /The Old School Rooms, The Street, North Stoke, Wallingford, United Kingdom, OX10 6BL/
  );

  assert.match(client, /Last updated:<\/strong> 15 August 2026/);
  assert.match(
    client,
    /Never send Tohonesty private keys, seed phrases, passwords, PINs, passphrases, recovery codes or direct access to a wallet, account, device or asset\./
  );

  assert.match(website, /Last updated:<\/strong> 01 August 2026/);
  assert.match(website, /Contracts \(Rights of Third Parties\) Act 1999/);

  assert.match(disclosure, /Last updated: 26 July 2026/);
  assert.match(
    disclosure,
    /We are not a law firm, certified financial advisory firm, asset recovery contractor, or asset custodian\./
  );
});

test("FAQ is readable HTML with anchor links and no accordions", () => {
  const faq = read("faqs/index.html");
  assert.match(faq, /href="#evidence"/);
  assert.match(faq, /id="evidence"/);
  assert.doesNotMatch(faq, /class="[^"]*accordion|aria-expanded|<details/i);
});

test("contact cannot submit without the encryption handler", () => {
  const contact = read("contact/index.html");
  assert.match(contact, /id="secure-contact"/);
  assert.doesNotMatch(contact, /<form[^>]+(?:action|method)=/i);
  assert.match(contact, /\/assets\/js\/contact\.js/);
  assert.doesNotMatch(contact, /name="(?:message|asset|wallet|value|private)/i);
});

test("browser handler sends only the envelope to the API", () => {
  const script = read("assets/js/contact.js");
  assert.match(script, /const envelope = await encryptPayload\(payload\)/);
  assert.match(script, /body: JSON\.stringify\(envelope\)/);
  assert.doesNotMatch(script, /body: JSON\.stringify\(payload\)/);
  assert.match(script, /RSA-OAEP/);
  assert.match(script, /AES-GCM/);
  assert.match(script, /2026-08-r2/);
});

test("public key is the expected RSA-3072 encryption key", () => {
  const key = JSON.parse(read("assets/crypto/public-key.json"));
  assert.equal(key.kid, "2026-08-r2");
  assert.equal(key.jwk.kty, "RSA");
  assert.equal(key.jwk.e, "AQAB");
  assert.equal(key.jwk.n.length, 512);
  assert.deepEqual(key.jwk.key_ops, ["encrypt"]);
  assert.equal("d" in key.jwk, false);
});

test("Worker envelope validation accepts only the exact protocol shape", () => {
  const bytes = (size) => Buffer.alloc(size, 1).toString("base64url");
  const valid = { v: 1, alg: "RSA-OAEP-256+A256GCM", kid: "2026-08-r2", ek: bytes(384), iv: bytes(12), ct: bytes(32) };
  assert.equal(validateEnvelope(valid), true);
  assert.equal(validateEnvelope({ ...valid, name: "plaintext" }), false);
  assert.equal(validateEnvelope({ ...valid, kid: "2026-09" }), false);
  assert.equal(validateEnvelope({ ...valid, iv: bytes(16) }), false);
});

test("staging and production both have restricted email bindings", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8"));
  for (const environment of ["staging", "production"]) {
    const binding = config.env[environment].send_email?.find((item) => item.name === "CONTACT_EMAIL");
    assert.ok(binding, `${environment} CONTACT_EMAIL binding`);
    assert.equal(binding.destination_address, "tohonesty@tohonesty.com");
    assert.deepEqual(binding.allowed_sender_addresses, ["tohonesty@tohonesty.com"]);
  }
  assert.equal(config.env.staging.name, "tohonesty-static-staging");
  assert.equal(config.env.production.name, "tohonesty-static-production");
});

test("no private-key material or common secret files are deployed", () => {
  const files = fs.readdirSync(publicDir, { recursive: true }).map(String);
  for (const file of files) assert.doesNotMatch(file, /(?:private|\.pem$|\.p12$|\.pfx$|\.key$|\.env$|wp-config|\.sql$)/i);
  for (const file of files.filter((file) => file.endsWith(".json"))) {
    const value = JSON.parse(read(file));
    assert.equal(Boolean(value?.jwk?.d), false);
  }
});
