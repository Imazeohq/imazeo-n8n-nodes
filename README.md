# @imazeo/n8n-nodes-imazeo

n8n community node for [Imazeo](https://imazeo.com) — upload and transform images, run PDF tools, and generate QR codes and barcodes via the Imazeo API (`https://api.imazeo.com`).

## Install

1. In n8n: **Settings → Community Nodes → Install**
2. Enter `@imazeo/n8n-nodes-imazeo`
3. Restart n8n if prompted

Requires a self-hosted n8n instance with community nodes enabled. Use this node in **server-side** workflows only — never put a project API key in a browser workflow.

## Credentials

Create **Imazeo API** credentials in n8n:

| Field          | Notes                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **API Key**    | Project API key from the [Imazeo Customer portal](https://app.imazeo.com). Sent as `X-API-Key` only (do not also send `Authorization`). |
| **API Origin** | Default `https://api.imazeo.com` (origin only; do not append `/v1`).                                                                    |
| **Project ID** | Optional. If empty, the node resolves it with `GET /v1/api-key/context`.                                                                |

## Resources and operations

| Resource                 | Operations                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **Image**                | Upload, Get, Get Many, Download, Delete                                                      |
| **Transform**            | Create (owned image ID or public URL), Get, Get Many, Download, Delete                       |
| **QR Code**              | Generate (PNG or SVG)                                                                        |
| **Barcode**              | Generate (`code128`, `code39`, `ean13`, `ean8`, `upca`, `itf14`)                             |
| **PDF**                  | Info, Render, Merge, Extract                                                                 |
| **Conversion**           | Capabilities, Create (DOCX/XLSX/PPTX/website), Get, Get Many, Lookup, Cancel, Download, Save |
| **Dynamic QR**           | Capabilities, Create, Get, Get Many, Update, Analytics, Export Analytics                     |
| **Saved Artifact**       | Save, Get, Get Many, Download, Delete                                                        |
| **Output**               | Get Many, Summary                                                                            |
| **Credit**               | Quote                                                                                        |
| **Processing Operation** | Get, Lookup, Result                                                                          |

Binary inputs and outputs use n8n binary properties. Multi-page PDF renders that return JSON with base64 pages are expanded into one item per page.

## Conversion workflow

1. Use **Credit → Quote** with Request Body
   `{"kind":"website.capture","units":1}`.
2. Use **Conversion → Create**, choose **Website**, and enter a public HTTP(S)
   URL. Set Quote ID from the preceding item's `data.id` and supply a UUID v4
   Idempotency Key. Keep the key for recovery of that request.
3. Create returns the job in `data`. Use an n8n Wait node between bounded
   **Conversion → Get** checks. Stop on `failed` or `cancelled`; download or
   save only after `data.status` is `completed`.
4. **Download** returns binary property `data`. **Save** creates a private artifact.

DOCX, XLSX and PPTX creation uses an input binary property. Quote with
`docx.render`, `xlsx.render` or `pptx.render` and `units: 1`. Query Options
contains rendering fields such as `page`, `format` and `scale`, plus engine-specific
options. Capabilities reports enabled engines and limits. Get Many returns at
most 50 conversion jobs for the chosen engine. Lookup takes the original key.

## Dynamic QR and saved outputs

Dynamic QR creation takes `name`, `destination` and optional `analyticsEnabled`
in Request Body. Updates require `expectedRevision` and an idempotency key; they
can change the destination, analytics preference, QR options or status
(`active`, `paused`, `deleted`). Generate a QR using the returned `redirectUrl`
as content. Analytics and CSV export accept `days`, `device`, `browser`,
`country` and `bot` in Query Options. Counts cover retained scans. Keep scan
details and exports private.

QR and barcode generation support Transparent Background and a Design object.
Design fields include `schemaVersion: 1`, `templateVersion: 1` and `template`;
QR allows `classic`, `rounded`, `dots`, `label`, while barcode allows `classic`
and `label`. QR logos reference an owned project image using `logoImageId`.

Saved Artifact → Save takes binary media and Request Body fields `kind`,
`displayName`, `contentType`, and optional `requestSnapshot`/`sourceImageId`.
Kinds are `qr`, `barcode`, `pdf_render`, `pdf_merge`, `pdf_extract` and
`image_transform`. Save completed document/website jobs through Conversion → Save.
Get Many on artifacts, outputs and dynamic links returns `data` and pagination
`meta`; set `page` and `limit` explicitly. Filter artifacts with `q`/`kind`,
outputs with `q`/`type`, and links with `search`/`status`.

Synchronous media operations accept optional Idempotency Key and Quote ID fields.
Inspect `replayEnabled` on a quote before relying on durable replay. Processing
Operation → Lookup takes `kind` and the original `key`; Result recovers retained
binary or structured JSON output. No mutation is retried automatically. Requests
refuse redirects so project credentials stay on the configured origin.

## Sample workflows

Importable examples in [`workflows/`](./workflows/):

1. [`01-qr-code.json`](./workflows/01-qr-code.json) — generate a PNG QR code
2. [`02-transform-url.json`](./workflows/02-transform-url.json) — transform a public image URL to WebP
3. [`03-upload-and-barcode.json`](./workflows/03-upload-and-barcode.json) — upload an image, then barcode the image ID

After import, attach your **Imazeo API** credentials on each Imazeo node.

## Errors and rate limits

API failures surface in n8n with the Imazeo error message when available, plus hints for common cases (`401`, `403`, `429`). The node does not auto-retry mutations. If you hit a rate limit, wait and retry; honor `Retry-After` when the API returns it.

## Documentation

- Product / API docs: [https://imazeo.com/docs/](https://imazeo.com/docs/)
- Authentication: [https://imazeo.com/docs/authentication/](https://imazeo.com/docs/authentication/)
- Source: [github.com/Imazeohq/imazeo-n8n-nodes](https://github.com/Imazeohq/imazeo-n8n-nodes)
- npm: [@imazeo/n8n-nodes-imazeo](https://www.npmjs.com/package/@imazeo/n8n-nodes-imazeo)

## Development

```bash
npm install
npm run build
npm run lint
npm test
npm run dev
```

## License

[MIT](./LICENSE.md)
