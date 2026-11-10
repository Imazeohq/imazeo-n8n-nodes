# n8n-nodes-imazeo

Community node for [Imazeo](https://imazeo.com) — image uploads and transforms, PDF tools, QR codes, and barcodes against the public Imazeo API (`https://api.imazeo.com`).

Built with the official [`@n8n/node-cli`](https://docs.n8n.io/integrations/creating-nodes/build/n8n-node/) toolchain for verified community-node packaging. MIT licensed. **No runtime npm dependencies** (API calls use n8n helpers only; `@imazeo/sdk` is a contract reference, not a dependency).

## Install

### Community nodes (self-hosted)

1. Settings → Community Nodes → Install
2. Enter `n8n-nodes-imazeo`
3. Restart n8n if prompted

### Manual / local development

```bash
npm install
npm run build
npm run dev
```

`npm run dev` loads the node in a local n8n instance (from n8n 3.0 this may use Docker/Podman; use `n8n-node dev --external-n8n` if you run n8n yourself with `N8N_DEV_RELOAD=true`).

## Credentials

Create **Imazeo API** credentials:

| Field | Notes |
| --- | --- |
| **API Key** | Project key from the Customer portal (`imz_…`). Sent as `X-API-Key` only — never with `Authorization`. Server-side workflows only. |
| **API Origin** | Default `https://api.imazeo.com` (origin only; no `/v1` suffix). |
| **Project ID** | Optional. If empty, resolved via `GET /v1/api-key/context`. |

## Resources and operations

Aligned with public API surface documented for `@imazeo/sdk@1.0.0`:

| Resource | Operations |
| --- | --- |
| **Image** | Upload, Get, Get Many, Download, Delete |
| **Transform** | Create (image ID or public URL), Get, Get Many, Download, Delete |
| **QR Code** | Generate (PNG / SVG) |
| **Barcode** | Generate (code128, code39, ean13, ean8, upca, itf14) |
| **PDF** | Info, Render, Merge, Extract |

Binary inputs use n8n binary properties. Binary responses (transforms, downloads, QR/barcode, PDF bytes) are written to a configurable binary property. Multi-page PDF renders that return JSON with base64 pages are expanded into one item per page.

## Sample workflows

Importable JSON under [`workflows/`](./workflows/):

1. [`01-qr-code.json`](./workflows/01-qr-code.json) — generate a PNG QR code
2. [`02-transform-url.json`](./workflows/02-transform-url.json) — transform a public image URL to WebP
3. [`03-upload-and-barcode.json`](./workflows/03-upload-and-barcode.json) — upload an image, then barcode the image ID

After import, attach **Imazeo API** credentials on each Imazeo node before running.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript and assets |
| `npm run lint` | n8n community lint rules |
| `npm test` | Unit tests for helpers |
| `npm run dev` | Live-reload n8n with this node |
| `npm run release` | Version, tag, and publish (CI/OIDC) |

## Errors and rate limits

API error envelopes are mapped to n8n `NodeApiError` with code, request ID, and hints for `401` / `403` / `429`. There is **no automatic retry** on mutations (matches Imazeo SDK guidance). Honor `Retry-After` manually when rate limited.

## Repository

- GitHub: [Imazeohq/imazeo-n8n-nodes](https://github.com/Imazeohq/imazeo-n8n-nodes)
- npm package name (required community-node prefix): `n8n-nodes-imazeo`
- Node / credential icons: official Imazeo mark from the shared brand favicon master (`brand/assets/favicon/imazeo-icon-master.png`)

## Publishing / verification

1. Commit and push `main` to `https://github.com/Imazeohq/imazeo-n8n-nodes.git`
2. Make the GitHub repo **public** (required for community-node verification)
3. On npmjs.com, add a Trusted Publisher (OIDC) for workflow `publish.yml`, or set repo secret `NPM_TOKEN`
4. Run `npm run release` locally (tags/pushes) **or** push a SemVer tag `*.*.*` to trigger Publish with provenance
5. Confirm npm shows provenance for the published version
6. Run `npx @n8n/scan-community-package n8n-nodes-imazeo` against the published package
7. Submit via the [n8n Creator Portal / verification guidelines](https://docs.n8n.io/integrations/creating-nodes/build/reference/verification-guidelines/)

Do not publish until sample workflows have been exercised against a real project API key.

## License

[MIT](./LICENSE.md)
