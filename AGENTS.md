# @imazeo/n8n-nodes-imazeo — agent notes

Independent public n8n community node for the Imazeo API-key surface.

- GitHub: `https://github.com/Imazeohq/imazeo-n8n-nodes`
- npm: `@imazeo/n8n-nodes-imazeo`
- Contract: published API `v1` (same public surface as `@imazeo/sdk`)
- Auth: `X-API-Key` only; no runtime dependency on `@imazeo/sdk`
- Icons: official Imazeo mark PNGs in `nodes/Imazeo/` and `credentials/`
- Do not invent endpoints outside the published public API
- Do not publish without maintainer approval — use GitHub Actions Publish

```bash
npm install
npm run lint
npm test
npm run build
npm run dev
```
