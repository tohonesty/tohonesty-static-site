"use strict";

(() => {
  const PROTOCOL = "TOHONESTY-INTAKE-V1";
  const EXPECTED_KEY_ID = "2026-08-r2";
  const EXPECTED_ALGORITHM = "RSA-OAEP-256+A256GCM";
  const form = document.getElementById("secure-contact");
  if (!form) return;

  const submitButton = document.getElementById("submit-contact");
  const status = document.getElementById("contact-status");

  function setStatus(message, type = "") {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function base64Url(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function loadPublicKey() {
    const response = await fetch("/assets/crypto/public-key.json", { cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error("The secure submission key is unavailable.");
    const keyPackage = await response.json();
    if (keyPackage.kid !== EXPECTED_KEY_ID || keyPackage.jwk?.kty !== "RSA" || keyPackage.jwk?.e !== "AQAB" || keyPackage.jwk?.n?.length !== 512) {
      throw new Error("The secure submission key failed validation.");
    }
    const key = await crypto.subtle.importKey(
      "jwk",
      keyPackage.jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    if (key.algorithm.modulusLength !== 3072) throw new Error("The secure submission key has an invalid size.");
    return { key, kid: keyPackage.kid };
  }

  async function encryptPayload(payload) {
    const { key: publicKey, kid } = await loadPublicKey();
    const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const rawAesKey = new Uint8Array(await crypto.subtle.exportKey("raw", aesKey));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = new TextEncoder().encode(`${PROTOCOL}|${kid}`);
    const plaintext = new TextEncoder().encode(
      `${PROTOCOL}\nKEY-ID: ${kid}\n${JSON.stringify(payload, null, 2)}`
    );

    try {
      const [encryptedKey, encryptedPayload] = await Promise.all([
        crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawAesKey),
        crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad, tagLength: 128 }, aesKey, plaintext)
      ]);
      return {
        v: 1,
        alg: EXPECTED_ALGORITHM,
        kid,
        ek: base64Url(new Uint8Array(encryptedKey)),
        iv: base64Url(iv),
        ct: base64Url(new Uint8Array(encryptedPayload))
      };
    } finally {
      rawAesKey.fill(0);
      iv.fill(0);
      aad.fill(0);
      plaintext.fill(0);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    submitButton.disabled = true;
    setStatus("Encrypting securely in your browser…");

    const payload = {
      fullName: form.elements.fullName.value.trim(),
      emailAddress: form.elements.emailAddress.value.trim(),
      ownershipStatus: form.elements.ownershipStatus.value,
      consentConfirmed: form.elements.consent.checked
    };

    try {
      const envelope = await encryptPayload(payload);
      payload.fullName = "";
      payload.emailAddress = "";
      payload.ownershipStatus = "";
      payload.consentConfirmed = false;

      setStatus("Sending encrypted submission…");
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(envelope),
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store"
      });
      if (!response.ok) throw new Error("The encrypted submission was not accepted.");
      form.reset();
      setStatus("Your encrypted enquiry has been received successfully. We will review the information provided and, if it meets our initial criteria, contact you at the email address supplied to explain the next step, normally within two business days. Please check your inbox and spam folder. We will never ask for private keys, seed phrases, passwords, PINs or recovery codes.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Secure submission failed. Please try again.", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
})();
