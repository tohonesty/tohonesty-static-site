# Tohonesty static site

A clean, dependency-light Cloudflare Workers Static Assets site. It does not contain WordPress, Elementor, jQuery, a client framework, or a production build pipeline.

## Structure

- `public/` — deploy-ready static HTML, CSS, JavaScript and the public encryption key
- `src/worker.js` — `/api/contact` ciphertext validator and Cloudflare Email sender
- `tests/` — content, security-boundary and Worker validation checks
- `wrangler.jsonc` — local, staging and production configuration
- `scripts/rotate-key.mjs` — key-rotation helper (optional)

## Safe release sequence

1. `npm install`
2. `npm test`
3. `npm run dev` and manually verify every page and the contact UI
4. `npm run deploy:staging`
5. Test the staging site, including a real encrypted submission and offline decryption
6. Commit only after staging passes
7. `npm run deploy:production` only when production cutover is authorised

The production routes are included for review but production deployment must not be run before staging acceptance. The `CONTACT_EMAIL` Email Routing binding is restricted to `tohonesty@tohonesty.com`.

## Key rotation

Key rotations are air-gapped. Generate the new RSA-3072 key pair offline, then use the helper script (or update the files manually).

### Using the script (recommended)

Place the new public-key JSON somewhere outside the repo (or in a temporary location), then from the repo root:

```bash
# Preview changes (no files modified)
node scripts/rotate-key.mjs --dry-run 2026-11-r1 /path/to/new-public-key.json

# Perform the rotation (creates a timestamped backup first)
node scripts/rotate-key.mjs 2026-11-r1 /path/to/new-public-key.json