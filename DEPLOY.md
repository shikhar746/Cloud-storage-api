# Deploying: API on Render, web on Vercel

| | URL |
| --- | --- |
| Web (Vercel) | https://cloud-storage-api-six.vercel.app |
| API (Render) | https://cloud-storage-api-hquw.onrender.com |

Two services, one repo. The API is a Node/Express server in `api/`; the web app
is a static Vite bundle in `web/`. They talk cross-origin over cookies, which is
what makes the environment wiring fussy — get `CORS_ORIGIN`, `VITE_API_URL` and
`NODE_ENV` right and everything else follows.

## What is broken right now

Probed against the live services:

- **The frontend is fine.** `VITE_API_BASE_URL` is set on Vercel and the deployed
  bundle already resolves to the Render URL. The client still honours that name,
  so nothing there needs to change.
- **The backend rejects the frontend.** A request carrying
  `Origin: https://cloud-storage-api-six.vercel.app` comes back with
  `access-control-allow-credentials: true` but **no**
  `access-control-allow-origin`, so the browser blocks every call. The deployed
  build is the old `app.ts`, which hardcodes an allow-list containing a
  placeholder domain and ignores `CORS_ORIGIN` entirely.

Setting the env var alone will not fix it — the running code never reads it.
**Push this branch and redeploy the API**, then import `api/.env.render`. The new
boot log confirms both halves in one glance:

```
[api] listening on port 10000 (production)
[api] allowed origins: https://cloud-storage-api-six.vercel.app, https://*.vercel.app, ...
[api] google sign-in: enabled
```

If that first line says `(development)` instead of `(production)`, the auth
cookies will lack `SameSite=None; Secure` and login will appear to succeed and
then drop you straight back to the sign-in page.

Verify from your machine once it is up — the second command must print an
`Access-Control-Allow-Origin` line:

```bash
curl -s https://cloud-storage-api-hquw.onrender.com/
curl -si -H "Origin: https://cloud-storage-api-six.vercel.app" https://cloud-storage-api-hquw.onrender.com/ | grep -i access-control
```

## Files you import

Two gitignored files hold the real values, ready to paste or upload:

| File | Import into | Contains |
| --- | --- | --- |
| `api/.env.render` | Render > Environment > **Add from .env** | server secrets, Supabase, Google, CORS |
| `web/.env.vercel` | Vercel > Settings > Environment Variables (drag the file in) | API URL, mode, Google client id |

`api/.env.example` and `web/.env.example` are the documented templates and stay
in git. `api/.env` and `web/.env` are your local dev values.

---

## 1. API on Render

Create a **Web Service** pointing at this repo, then:

| Setting | Value |
| --- | --- |
| Root Directory | `api` |
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/` |

The build runs `tsc`, which lives in devDependencies, and `NODE_ENV=production`
makes npm read that as `--omit=dev`. Left alone, the install brings down 142
packages with no `@types` directory at all and the build dies on:

```
error TS2688: Cannot find type definition file for 'node'.
```

`api/.npmrc` sets `include=dev`, which overrides the implied omit, so **any**
build command works — you do not have to remember `--include=dev` in the
dashboard. If a stale Render cache still reports "up to date" without installing
them, use **Manual Deploy > Clear build cache & deploy** once.

Import `api/.env.render` under **Environment**. Two things about it:

- **Do not add `PORT`.** Render injects its own; the app binds to `0.0.0.0` on
  whatever it is given and falls back to 8080 only for local runs.
- `NODE_ENV=production` is what flips the auth cookies to `SameSite=None; Secure`.
  Without it the browser silently drops them on every cross-site request and
  login appears to succeed while leaving you logged out.

On boot the log states what it read, which is the fastest way to confirm the
import landed:

```
[api] listening on port 10000 (production)
[api] allowed origins: https://*.vercel.app, http://localhost:5173
[api] google sign-in: enabled
```

If a required variable is missing the process refuses to start and names **all**
of them in one line, so you only redeploy once.

Note the free instance sleeps after ~15 minutes idle; the next request takes
about a minute to wake it. That is not a bug in the frontend's health check.

## 2. Web on Vercel

Import the repo as a new project:

| Setting | Value |
| --- | --- |
| Root Directory | `web` |
| Framework Preset | Vite (auto-detected) |
| Build / Output | from `web/vercel.json` — `npm run build` into `dist` |

Import `web/.env.vercel` under **Settings > Environment Variables**, applied to
Production, Preview and Development.

These are **build-time** values. Vite inlines them into the JavaScript bundle, so
editing one in the Vercel dashboard changes nothing until you **redeploy**. They
also ship to the browser in plain text — never put a secret in a `VITE_*` var.

`web/vercel.json` also rewrites unmatched paths to `index.html`, so refreshing on
a deep link does not 404.

## 3. Wire the two together

Order matters, because each side needs the other's URL:

1. Deploy the API. Copy its URL — here `https://cloud-storage-api-hquw.onrender.com`.
2. Set `VITE_API_URL` on Vercel to that URL — **no trailing slash** — and deploy
   the web app. Copy its URL.
3. Back on Render, make sure `CORS_ORIGIN` covers the web URL, then redeploy.

`CORS_ORIGIN` is a comma-separated list and accepts `*` as a wildcard segment,
so one value covers the production domain *and* every preview deploy. The value
already in `api/.env.render`:

```
CORS_ORIGIN=https://cloud-storage-api-six.vercel.app,https://*.vercel.app,http://localhost:5173,http://localhost:3000
```

A custom domain is not covered by the `*.vercel.app` wildcard — add it
explicitly if you attach one.

Note that `VITE_API_BASE_URL` is currently set on Vercel and is what the live
bundle reads. It still works — the client prefers `VITE_API_URL` and falls back
to it — so you can either add `VITE_API_URL` alongside it or leave it as is.

## 4. Google sign-in

The same OAuth client is used on both sides, and the two values must match:
`GOOGLE_CLIENT_ID` on Render, `VITE_GOOGLE_CLIENT_ID` on Vercel. In Google Cloud
Console > Credentials, open that client and add the frontend origin under
**Authorized JavaScript origins**:

```
https://cloud-storage-api-six.vercel.app
http://localhost:5173
http://localhost:3000
```

Leave `VITE_GOOGLE_CLIENT_ID` blank to hide the button; leave `GOOGLE_CLIENT_ID`
blank and `POST /api/auth/google` returns disabled.

## 5. Supabase

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security — it belongs only on the
API, never in the web bundle. Also check that the bucket named by
`SUPABASE_STORAGE_BUCKET` exists and that its own file size limit (Storage >
bucket > settings) is at least `MAX_DIRECT_UPLOAD_BYTES`, or large uploads are
rejected by storage after the API has already handed out a signed URL.

The two upload paths are split by `MAX_FILE_SIZE_BYTES` (50 MB): at or under it,
the file is buffered in API memory through `POST /api/files/upload`; above it,
the browser uploads straight to Supabase via `POST /api/files/upload-url`. Keep
that ceiling modest on a small instance — the whole file sits in RAM.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `blocked by CORS policy` in the console | The frontend origin is not in `CORS_ORIGIN`, or the entry has a trailing slash. Compare against the exact origin in the error. |
| Login returns 200 but you are immediately signed out | `NODE_ENV` is not `production` on Render, so the cookie lacks `SameSite=None; Secure` and the browser discards it. |
| Requests still go to `http://localhost:8080` | `VITE_API_URL` was not set at build time, or the app was not redeployed after setting it. |
| ...even though `VITE_API_URL` is correct | A stale manual override in the browser. The API Config modal saves to `localStorage`; clear `csa_api_base_url` (and `csa_api_mode`) in DevTools > Application. |
| Build fails with `tsc: not found` or `TS2688: Cannot find type definition file for 'node'` | devDependencies were skipped because `NODE_ENV=production`. `api/.npmrc` (`include=dev`) fixes this; make sure that file reached the deployed commit, and clear the Render build cache if it persists. |
| `Missing required environment variables: ...` | Exactly what it says — the log lists every missing name at once. |
| Login works in Chrome, not in Safari/Brave | Third-party cookie blocking. The API and web app are on different registrable domains, so the auth cookie is cross-site. Fix by hosting both under one domain (`api.example.com` + `app.example.com`). |

## Variables that used to be here and are not

- `DATABASE_URL` — never read by the app; every query goes through the Supabase
  JS client. Kept in `api/.env` only for running `infra/migrations/*.sql` by hand.
- `SUPABASE_ANON_KEY` — unused by the API, which authenticates with the service
  role key.
- `GEMINI_API_KEY`, `APP_URL` — AI Studio scaffolding leftovers, referenced
  nowhere in `web/src`.
