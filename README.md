# 4ofl.dev

Personal site for 4ofl. Static HTML/CSS/JS on Cloudflare, plus a small edge worker.

## layout
- `index.html`, `css/style.css`, `js/app.js` (home), `js/common.js` (cursor, toast, offline, smooth scroll, reveals)
- `work/<slug>/index.html` case studies (cross-document view transition from the home rows)
- `sw.js` service worker. bump `V` to drop every visitor's cache
- `js/vendor/sql-wasm.*` sql.js (SQLite 3 compiled to WASM), used by the johns fitness demo
- `worker/worker.js` edge worker: `/` last push, `/commits`, `/status`, `/ping`

## worker secrets
- `GITHUB_TOKEN`: classic PAT with `read:user` (+ `repo` if private commit counts should show)
- `JUNE_STATUS_URL` (optional): june's status json. without it `/status` returns `{state:"unknown"}`
