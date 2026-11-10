# @imazeo/n8n-nodes-imazeo

Standalone n8n community node for the public Imazeo API.

- **Git remote:** `https://github.com/Imazeohq/imazeo-n8n-nodes.git`
- **npm name:** `@imazeo/n8n-nodes-imazeo` (scoped under the `imazeo` npm org)
- **Icons:** copy from `brand/assets/favicon/imazeo-icon-master.png` into `nodes/Imazeo/` and `credentials/` (do not invent marks)

## Contract source of truth

- Published `@imazeo/sdk@1.0.0` types and public docs — not unreleased local backend routes
- Auth: `X-API-Key` only
- Paths under `/v1/projects/:projectId/...` plus `GET /v1/api-key/context`
- No runtime dependency on `@imazeo/sdk` (verified community nodes must ship with zero runtime `dependencies`)

## Local commands

```bash
npm install
npm run lint
npm test
npm run build
npm run dev
```

Do not publish to npm or push tags until the maintainer asks.
