# Tohonesty static site

A clean, dependency-light Cloudflare Workers Static Assets site. It does not contain WordPress, Elementor, jQuery, a client framework, or a production build pipeline.

## Structure

- `public/` — deploy-ready static HTML, CSS, JavaScript and the public encryption key
- `src/worker.js` — `/api/contact` ciphertext validator and Cloudflare Email sender
- `tests/` — content, security-boundary and Worker validation checks
- `wrangler.jsonc` — local, staging and production configuration

## Safe release sequence

1. `npm install`
2. `npm test`
3. `npm run dev` and manually verify every page and the contact UI
4. `npm run deploy:staging`
5. Test the staging site, including a real encrypted submission and offline decryption
6. Commit only after staging passes
7. `npm run deploy:production` only when production cutover is authorised

The production routes are included for review but production deployment must not be run before staging acceptance. The `CONTACT_EMAIL` Email Routing binding is restricted to `tohonesty@tohonesty.com`.

## Monthly public-key rotation

Replace `public/assets/crypto/public-key.json`, update `EXPECTED_KEY_ID` in `public/assets/js/contact.js` and `src/worker.js`, then run the full release sequence. Never place a private key in this repository.

## Deliberately deferred hardening

CSP and advanced headers are not included yet, per the staged hardening plan. Add them only after the site and encrypted contact workflow are frozen, one tested change at a time.
