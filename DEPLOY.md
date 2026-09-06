# Deploying

One Render web service builds and serves both halves of this repo: the
Node/Express API in `api/` and the Vite bundle in `web/`, on a single origin.

## Why one service and not two

The auth tokens ride in `httpOnly` cookies. A cookie is first-party only when
the API answers on the same site as the page that called it — and browsers
decide "same site" by the registrable domain, not by the host.

`onrender.com` and `vercel.app` are both on the [Public Suffix List], so
`web-abc.onrender.com` and `api-xyz.onrender.com` are as different to a browser
as two unrelated companies. Splitting the deploy across two Render services
buys nothing over Render + Vercel: the cookie is third-party either way, and
Safari, Brave and most blocker extensions discard it outright. The symptom is
distinctive — login returns `200`, and the very next request is a `401`.

Served from one origin the question disappears. There is no CORS preflight, no
`SameSite=None`, nothing for a privacy setting to object to.

[Public Suffix List]: https://publicsuffix.org/list/

## 1. Create the service

A **Web Service** pointing at this repo, with the repository root as the root
directory — not `api`, because the build needs `web/` too.

| Setting | Value |
| --- | --- |
| Root Directory | *(blank — the repo root)* |
| Runtime | Node |
| Build Command | `npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

The root `package.json` exists only to orchestrate those two commands: `build`
installs and builds `web`, then installs and builds `api`; `start` runs the API,
which finds `web/dist` next to itself and serves it.

Both `.npmrc` files carry `include=dev`. Render sets `NODE_ENV=production` in
the build environment and npm reads that as `--omit=dev`, which would skip
`vite` and `typescript` — the build then dies on `vite: not found` or:

```
error TS2688: Cannot find type definition file for 'node'.
```

`include` overrides the implied omit, so any build command works. If a stale
cache still reports "up to date" without installing them, use **Manual Deploy >
Clear build cache & deploy** once.

## 2. Environment

Import `api/.env.render` under **Environment** (Render: *Add from .env*). Three
things about it:

- **Do not add `PORT`.** Render injects its own; the app binds `0.0.0.0` on
  whatever it is given and falls back to 8080 only for local runs.
- `NODE_ENV=production` flips the auth cookies to `Secure`. Keep it set.
- `CORS_ORIGIN` no longer matters for the deployed app — same-origin requests
  carry no `Origin` header — but leave it covering `http://localhost:5173` and
  `http://localhost:3000` so local dev against the deployed API still works.

The web side needs no dashboard variables. `web/.env.production` is committed
and holds the only value that matters:

```
VITE_API_URL=
```

Empty means "the origin this page came from". It is not an oversight, and it is
the one line that makes the cookies first-party. Vite inlines `VITE_*` values at
**build** time, so changing any of them needs a redeploy, not a reload — and a
variable set in Render's dashboard overrides the file.

On boot the log states everything it resolved, which is the fastest way to
confirm the deploy landed:

```
[api] listening on port 10000 (production)
[api] web bundle: serving /opt/render/project/src/web/dist
[api] google sign-in: enabled
```

If the second line says `not built (API only)` the web build did not run or did
not land — the service will answer `/api/*` correctly and 404 everything else.
If the first line says `(development)`, `NODE_ENV` is unset.

Verify from your machine once it is up:

```bash
curl -s https://YOUR-SERVICE.onrender.com/api/health
```

That must return JSON. The root must return HTML — the app shell.

## 3. Google sign-in

There is no client secret. The browser gets an ID token from Google Identity
Services and this API only verifies its signature against Google's public
certs — no authorization-code exchange, so nothing to keep secret.
`GOOGLE_CLIENT_SECRET` is no longer read; delete it from your Render
environment if it is still there.

Three things must agree, and all three are public:

| | Where | Value |
| --- | --- | --- |
| 1 | `GOOGLE_CLIENT_ID` on Render | the client id |
| 2 | `VITE_GOOGLE_CLIENT_ID` in `web/.env.production` | the **same** client id |
| 3 | Google Cloud Console > Credentials > that client | the serving origin under **Authorized JavaScript origins** |

**Moving to a single service changes (3).** The app is now served from the
Render URL, not the Vercel one, and Google refuses to render its button on an
origin it has not been told about. Add it before you cut over:

```
https://YOUR-SERVICE.onrender.com
http://localhost:5173
http://localhost:3000
```

The boot log prints the id it loaded, so (1) versus (2) is a glance:

```
[api] google sign-in: enabled (6284...apps.googleusercontent.com)
```

Mismatched ids fail closed. Verification throws `Wrong recipient`, the API
answers `401 INVALID_GOOGLE_TOKEN`, and the log names the audience it checked
against.

An address Google has not confirmed is rejected outright, because a Google
sign-in whose email matches an existing password account is linked to that
account — accepting an unconfirmed address would hand the account to whoever
registered it with Google.

Leave `VITE_GOOGLE_CLIENT_ID` blank to hide the button; leave `GOOGLE_CLIENT_ID`
blank and `POST /api/auth/google` reports itself disabled.

## 4. Supabase

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security — it belongs only on the
API, never in a `VITE_*` variable. Check that the bucket named by
`SUPABASE_STORAGE_BUCKET` exists and that its own file size limit (Storage >
bucket > settings) is at least `MAX_DIRECT_UPLOAD_BYTES`, or large uploads are
rejected by storage after the API has already handed out a signed URL.

The two upload paths split at `MAX_FILE_SIZE_BYTES` (50 MB): at or under it the
file is buffered in API memory through `POST /api/files/upload`; above it the
browser uploads straight to Supabase via `POST /api/files/upload-url`. Keep that
ceiling modest on a small instance — the whole file sits in RAM.

Note the free instance sleeps after ~15 minutes idle and the next request takes
about a minute to wake it. That is not a bug in the health check.

## Local development

Unchanged, and still two processes. Vite proxies nothing — it talks
cross-origin to `http://localhost:8080`, which `CORS_ORIGIN` allows and which
`SameSite=Lax` cookies survive because both sides are `localhost`:

```bash
npm --prefix api run dev
```

```bash
npm --prefix web run dev
```

`api/.env` and `web/.env` hold local values and stay out of git. To rehearse the
production shape instead, build both and run the API alone — it serves the
bundle at `http://localhost:8080`:

```bash
npm run build && npm start
```

## Running the frontend somewhere else

Still supported, and the reason the CORS allow-list and the `VITE_API_URL`
override survive. Point a static host at `web/` as its root directory, set
`VITE_API_URL` to the API's full URL with no trailing slash, and add that host's
origin to `CORS_ORIGIN` on Render. `web/vercel.json` already rewrites unmatched
paths to `index.html` for Vercel specifically.

Understand what you are accepting: the cookies become third-party again, and
some of your users will not be able to stay logged in. `CORS_ORIGIN` takes a
comma-separated list and accepts `*` as a wildcard segment
(`https://*.vercel.app`) — but a wildcard on a shared domain lets any site under
it call this API with your users' cookies, so prefer exact origins.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Every route but `/api/*` 404s | The web build did not reach the server; the boot log's `web bundle:` line says `not built`. Confirm the Build Command is `npm run build` from the repo **root**, not from `api`. |
| Login returns 200, next request is 401 | Cookies are being dropped. On a single-origin deploy, check `NODE_ENV=production`. If the frontend is hosted separately, this is third-party cookie blocking and the fix is to stop hosting it separately. |
| Requests still go to `http://localhost:8080` | The bundle was built with `VITE_API_URL` unset. Empty means same-origin; *unset* falls back to localhost. Check that `web/.env.production` reached the deployed commit. |
| ...even though the build looks right | A stale manual override in the browser. The API Config modal writes `csa_api_base_url` to `localStorage`; clear it in DevTools > Application. |
| `blocked by CORS policy` | Only possible when the frontend is hosted separately. The origin is missing from `CORS_ORIGIN`, or the entry has a trailing slash. Compare against the exact origin in the error. |
| Build fails on `vite: not found` or `TS2688` | devDependencies were skipped because `NODE_ENV=production`. `api/.npmrc` and `web/.npmrc` (`include=dev`) fix this; make sure both reached the deployed commit, then clear the build cache. |
| `Missing required environment variables: ...` | Exactly what it says — the log names every missing one at once, so you redeploy once. |
| `ERR_BLOCKED_BY_CLIENT` on `play.google.com/log` | An ad blocker eating Google Identity Services' telemetry beacon. Harmless; sign-in still works. |
| The Google button never appears | `VITE_GOOGLE_CLIENT_ID` was empty at build time. The card in its place says so. |
| Google button appears but the popup errors with `origin_mismatch` | The serving origin is not under **Authorized JavaScript origins** on that OAuth client. Add the exact origin, scheme included. |
| Google sign-in returns `401 INVALID_GOOGLE_TOKEN` | The API and the bundle are configured with different client ids. Compare the boot log's `google sign-in:` line against the id in the bundle. |
| Google sign-in returns `501 GOOGLE_SIGNIN_DISABLED` | `GOOGLE_CLIENT_ID` is unset on the API. |
| A 401 on `/api/auth/me` and `/api/auth/refresh` at page load | Normal when nobody is signed in yet. The app asks who you are, the refresh retry finds no cookie either, and the sign-in screen renders. Only a problem if it continues *after* a successful login. |

## Variables that used to be here and are not

- `DATABASE_URL` — never read by the app; every query goes through the Supabase
  JS client. Kept in `api/.env` only for running `infra/migrations/*.sql` by hand.
- `SUPABASE_ANON_KEY` — unused by the API, which authenticates with the service
  role key.
- `GEMINI_API_KEY`, `APP_URL` — AI Studio scaffolding leftovers, referenced
  nowhere in `web/src`.
