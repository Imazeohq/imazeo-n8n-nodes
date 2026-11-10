# @imazeo/n8n-nodes-imazeo

n8n community node for [Imazeo](https://imazeo.com) — upload and transform images, run PDF tools, and generate QR codes and barcodes via the Imazeo API (`https://api.imazeo.com`).

## Install

1. In n8n: **Settings → Community Nodes → Install**
2. Enter `@imazeo/n8n-nodes-imazeo`
3. Restart n8n if prompted

Requires a self-hosted n8n instance with community nodes enabled. Use this node in **server-side** workflows only — never put a project API key in a browser workflow.

## Credentials

Create **Imazeo API** credentials in n8n:

| Field | Notes |
| --- | --- |
| **API Key** | Project API key from the [Imazeo Customer portal](https://app.imazeo.com). Sent as `X-API-Key` only (do not also send `Authorization`). |
| **API Origin** | Default `https://api.imazeo.com` (origin only; do not append `/v1`). |
| **Project ID** | Optional. If empty, the node resolves it with `GET /v1/api-key/context`. |

## Resources and operations

| Resource | Operations |
| --- | --- |
| **Image** | Upload, Get, Get Many, Download, Delete |
| **Transform** | Create (owned image ID or public URL), Get, Get Many, Download, Delete |
| **QR Code** | Generate (PNG or SVG) |
| **Barcode** | Generate (`code128`, `code39`, `ean13`, `ean8`, `upca`, `itf14`) |
| **PDF** | Info, Render, Merge, Extract |

Binary inputs and outputs use n8n binary properties. Multi-page PDF renders that return JSON with base64 pages are expanded into one item per page.

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
