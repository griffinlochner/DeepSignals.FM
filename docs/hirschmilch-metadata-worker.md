# Hirschmilch Metadata Worker

Hirschmilch metadata is fetched server-to-server because the metadata endpoint does not support direct browser clients. The Worker validates and briefly caches track metadata, then serves the small normalized response to DeepSignals.FM.

```text
Browser ── metadata poll ──> Cloudflare Worker ── cached REST fetch ──> Hirschmilch
Browser ── audio stream directly ────────────────────────────────────> Hirschmilch
```

**The Worker is not an audio proxy and is not required for playback.** It only handles public track metadata; audio, artwork binaries, user data, credentials, and persistent storage are not involved.

The Worker accepts only the `psytrance`, `progressive`, and `chillout` channel IDs. It validates the upstream channel snapshot and caches that shared snapshot at the Cloudflare edge for 20 seconds. The requested channel is selected and normalized from the cached snapshot locally. Browser responses use `Cache-Control: no-store`, so browser polls reach the Worker while requests for any approved channel can reuse a fresh upstream snapshot.

Metadata polling runs independently from playback. Temporary blank data or a Worker/network error leaves the last valid track in place; before metadata arrives, the configured station name and local Hirschmilch station artwork remain the fallbacks. Channel changes discard metadata from the previous channel. None of these paths modifies audio playback, analysis, reactive visuals, CHROMA, MOTION, environments, volume, or controls.

## Files and configuration

- Worker implementation and API: `workers/hirschmilch-metadata/src/index.ts`
- Wrangler config and local scripts: `workers/hirschmilch-metadata/wrangler.jsonc` and `workers/hirschmilch-metadata/package.json`
- Browser polling and normalization: `src/app/useHirschmilchNowPlaying.ts`
- Approved station IDs, direct streams, and local artwork: `src/app/externalSignals.ts`
- Worker tests: `workers/hirschmilch-metadata/tests/index.test.ts`
- Frontend metadata lifecycle tests: `scripts/test-hirschmilch-metadata.ts`

Set `VITE_HIRSCHMILCH_METADATA_URL` to the Worker base URL, for example `https://hirschmilch-metadata.<your-workers-dev-subdomain>.workers.dev`. It is public build configuration, not a secret. The GitHub Pages workflow reads the repository Actions variable with that name. Add it after the first Worker deployment reveals the account's `workers.dev` subdomain. Without it, production track metadata stays on its station fallback; playback is unaffected.

## Local development

From the repository root, install the Worker's isolated development dependency once and run the local Worker:

```powershell
cd workers\hirschmilch-metadata
npm install
npm run dev
```

In a separate terminal, create the ignored root `.env.local` file with:

```text
VITE_HIRSCHMILCH_METADATA_URL=http://localhost:8787
```

Then run `npm run dev` from the repository root. The Worker allows the Vite development origins `localhost:5173` and `127.0.0.1:5173`. Worker tests run with `npm run test:hirschmilch-worker` from the root; frontend lifecycle tests run with `npm run test:hirschmilch-metadata`.

## Deployment and maintenance

The first deployment requires a Cloudflare account login and a configured `workers.dev` subdomain if the account does not already have one:

```powershell
cd workers\hirschmilch-metadata
npm install
npx wrangler login
npm run deploy
```

Wrangler reports the deployed URL. Set the repository Actions variable `VITE_HIRSCHMILCH_METADATA_URL` to that base URL so future GitHub Pages builds call the Worker. Deployment remains separate from the site's GitHub Pages workflow.

To update the upstream adapter, inspect the public response, then adjust the fixed upstream parser, allowlisted channel IDs, normalization, and tests in the Worker. Keep caller-controlled URLs, artwork/audio proxying, and credentials out of this service. If another approved station needs server-side metadata for the same browser-CORS reason, add a separate small adapter/package following this pattern; do not turn the Hirschmilch Worker into a generic proxy prematurely.
