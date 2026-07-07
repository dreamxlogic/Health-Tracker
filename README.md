# Health Command Center — V6

A private, on-device health tracker (meds, symptoms, daily check-ins, insights).
This build ships **empty** — no data is loaded, and there is no sample-data button in the UI.
All data lives in the browser's IndexedDB on the visitor's own device.

## Run locally

Because the app loads `db.js` / `seed.js` as ES modules, open it through a local
web server (not `file://`):

```bash
cd github-build
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a **new repository** and upload the entire contents of this `github-build/`
   folder to the repo root (`index.html` must be at the root).
2. Repo → **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`, then **Save**.
5. Wait ~1 minute. Your page URL appears at the top of the Pages settings:
   `https://<your-username>.github.io/<repo-name>/`

The included `.nojekyll` file ensures GitHub Pages serves all assets as-is.

## Hidden sample data

There is intentionally no sample-data option in the interface. To load the demo
dataset for a walkthrough, open the browser console and run:

```js
window.__hccLoadSample()
```

Clear everything again from **Settings → Data → Clear all data**.

## Files

- `index.html` — the app
- `support.js` — component runtime
- `db.js` — IndexedDB storage layer
- `seed.js` — symptom library + hidden sample-data generator
- `uploads/` — icons and category art
