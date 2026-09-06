# CloudStorage Explorer

**A full-stack cloud file storage platform — nested folders, granular sharing, public links, and a dual-path upload pipeline that keeps large files out of server memory.**

| | |
| --- | --- |
| **Live application** | https://cloud-storage-api-hquw.onrender.com |
| **Repository** | https://github.com/shikhar746/Cloud-storage-api |
| **Author** | /*your name goes here*/ |

[SCREENSHOT: /*The main file explorer — sidebar, breadcrumbs, folder and file grid, fully loaded. This is the hero image for the whole project*/]

---

## Contents

1. [Introduction](#1-introduction) · 2. [Overview](#2-overview) · 3. [Features](#3-features) · 4. [Tech Stack](#4-tech-stack) · 5. [Frontend](#5-frontend) · 6. [Backend](#6-backend) · 7. [Database](#7-database) · 8. [APIs and Integrations](#8-apis-and-integrations) · 9. [System Workflow](#9-system-workflow) · 10. [Use Cases](#10-use-cases) · 11. [Challenges](#11-challenges) · 12. [Skills Learned](#12-skills-learned) · 13. [Security](#13-security) · 14. [Performance](#14-performance) · 15. [Testing](#15-testing) · 16. [Future Improvements](#16-future-improvements) · 17. [Conclusion](#17-conclusion)

---

## 1. Introduction

### Problem

Cloud storage looks trivial and is not. The naive build — accept an upload, write it somewhere, record a row — collapses under three pressures that arrive almost immediately:

- **Memory.** A server buffering uploads in RAM has a hard concurrency ceiling. Exceed it and the process is killed, taking every unrelated request with it.
- **Authorization.** Once folders nest and resources are shared, "may this user read this file?" stops being one comparison and becomes a graph traversal.
- **Session integrity.** Cookie auth behaves differently depending on whether the API and frontend are on the same *site* — invisible in development, silently broken in production for a subset of users.

Each has a correct answer that differs from the obvious one. Building the system is the only reliable way to meet them.

### What it does

Users store files, organise them into arbitrarily nested folders, star what matters, recover deletions from a trash bin that empties itself on a retention schedule, search, share with named users at two permission levels, and publish public links with optional expiry and password.

### Objectives

| Goal | Approach |
| --- | --- |
| Handle files of any size without destabilising the server | Two upload paths, split by a server-declared threshold |
| Organise files the way people think | Nested folders with move, rename, breadcrumbs |
| Make deletion recoverable, but not forever | Soft delete, restore, and a scheduled purge |
| Share safely and granularly | Per-resource `viewer`/`editor` grants, inherited down folder trees |
| Share with people who have no account | Tokenised public links, optionally expiring and password-gated |
| Keep sessions secure and persistent | Short-lived access tokens with silent refresh, both `httpOnly` |
| Reduce sign-up friction | Google Sign-In, verified server-side |

---

## 2. Overview

A monorepo with two packages built together and deployed as **one Render web service**:

```
Cloud-storage-api/
├── api/          Express REST API (TypeScript)
│   ├── src/      app, routes, controllers, middleware, lib, schemas
│   └── infra/    ordered SQL migrations
└── web/          React SPA (Vite)
    └── src/      context, services, components, utils, types
```

### The defining decision: one origin

The API also serves the compiled SPA. On boot it resolves `web/dist` relative to its own module path; if a build is present it mounts it as static files with a single-page fallback — any `GET` that matches no file and does not start with `/api/` returns `index.html`.

The browser therefore sees **one origin**. The auth cookies are first-party, so browsers that block third-party cookies (Safari, Brave, most blocker extensions) do not discard them. There is no CORS preflight in normal operation, and the client's base URL needs no configuration.

This was not the original topology. It replaced a Vercel + Render split where login returned `200` and the very next request returned `401` — see [§11](#11-challenges).

### Data flow

```
┌─────────────┐   credentialed fetch   ┌──────────────┐
│  React SPA  │ ─────────────────────► │  Express API │
│             │ ◄───────────────────── │              │
└─────────────┘   JSON + Set-Cookie    └──────┬───────┘
      │                                       │ service-role client
      │  direct PUT (large files only)        ▼
      │                              ┌──────────────────┐
      └─────────────────────────────►│ Supabase         │
                                     │  • PostgreSQL    │
                                     │  • Object Storage│
                                     └──────────────────┘
```

Note the asymmetry: most traffic takes the top path, but **large file bytes never pass through the API at all**.

[SCREENSHOT: /*An architecture diagram showing SPA, API, Supabase Postgres, Supabase Storage, Google Identity Services, and the two distinct upload routes*/]

---

## 3. Features

### 3.1 Email and password authentication

Registration validates with Zod (name 2–50, valid email, password 8–72 — the upper bound matters because bcrypt silently truncates past 72 bytes). Email is lowercased so casing cannot create duplicates; the password is hashed with bcrypt at cost 10. A `23505` unique violation becomes a clean `409`, never a leaked database error.

Login guards against a null `password_hash` — Google-only accounts have none, and bcrypt throws on null. Unknown email and wrong password return an **identical** `401`, so the endpoint cannot enumerate registered addresses.

[SCREENSHOT: /*The sign-in / register page with the form fields and the "Continue with Google" button*/]

### 3.2 Google Sign-In

An **ID token** flow, not an authorization-code flow. Google Identity Services hands the browser a signed JWT; the server verifies its signature against Google's certificates with the **audience pinned** to the configured client ID, so a token minted for another app is rejected.

Resolution has three branches: a returning user matched on Google's stable `sub` (never the email — a Workspace address can be reassigned, the `sub` cannot); an existing password account with the same address, onto which the Google identity is **linked** so the user keeps their files; or a brand-new account with no password at all.

Branch two is guarded by requiring `email_verified === true`. A *missing* claim is not treated as confirmation — without that rule, an unverified address could take over an existing account.

Because this only verifies a signature, there is no code exchange and therefore **no client secret** anywhere in the system.

[SCREENSHOT: /*The Google account chooser appearing over the sign-in page*/]

### 3.3 Sessions and silent refresh

| Token | Lifetime | Cookie path |
| --- | --- | --- |
| `accessToken` | 15 minutes | `/` |
| `refreshToken` | 7 days | `/api/auth/refresh` |

Both `httpOnly`, both `Secure` + `SameSite=None` in production. The refresh cookie is scoped to a single path, so the browser never attaches it to ordinary API calls — it reaches only the one endpoint entitled to consume it.

The client intercepts any `401` from a non-auth endpoint, refreshes, and retries **once**. Concurrent refreshes are de-duplicated behind a shared promise: six simultaneous `401`s produce one refresh, not six. Logout clears cookies with matching attributes — omit `secure` or `sameSite` and the browser ignores the instruction, leaving the session alive.

[SCREENSHOT: /*DevTools Application tab showing both cookies with HttpOnly, Secure, SameSite, and the refreshToken's restricted Path*/]

### 3.4 Folders

Rows with a self-referencing `parent_id`; `NULL` means root. Uniqueness is enforced by a **partial unique index** on `(owner_id, parent_id, name) WHERE is_deleted = false` — more precise than a plain constraint, because it lets a new `Photos` exist while the old one sits in the trash. Breadcrumbs come from a dedicated ancestor-chain endpoint, so navigation survives a refresh.

[SCREENSHOT: /*The explorer inside a nested folder with the full breadcrumb trail*/]

### 3.5 Dual-path upload

The single most consequential decision in the project. The client asks the API for its limits, then:

**Multipart** (at or below 50 MB) — `multer` buffers in memory, the API forwards to storage, then inserts the row. If the row fails, the API **deletes the blob it just wrote**. Storage keys are always `{userId}/{uuid}`, never the user's filename, which removes path traversal and collisions at once.

**Direct** (above the threshold) — the client requests a signed URL, `PUT`s the bytes straight to Supabase, then calls a completion endpoint. **The bytes never touch the API**, so its memory cost for a 2 GB file equals that of a 1 KB file.

Completion is deliberately suspicious of the client: the key must carry the caller's own prefix, must match an unclaimed `pending_uploads` row the server actually issued, folder access is re-checked, and **size and MIME are read back from storage** rather than taken from the request body.

[SCREENSHOT: /*The upload progress panel with several files uploading simultaneously*/]

### 3.6 Drag and drop — files *and* folders

`dataTransfer.files` cannot see inside a directory; it reports a dropped folder as one zero-byte entry. The File System Entry API is the only way in, and it has two silent failure modes:

1. `webkitGetAsEntry()` must be called **synchronously** — the `DataTransfer` is neutered the moment the handler returns.
2. `readEntries()` returns **at most 100 children per call** and signals the end with an empty batch. One call truncates anything larger, with no error.

The traversal handles both, caps depth at 32 so cyclic trees terminate, and records empty directories so they are recreated too. Folder paths resolve to IDs before any file is sent, cached so a hundred files in one folder create it once; an existing folder of the same name is **adopted** rather than treated as a failure.

[SCREENSHOT: /*The drag-and-drop overlay mid-drag, showing "Drop files or folders to upload"*/]

[SCREENSHOT: /*The explorer just after dropping a folder — new folder created, progress panel listing nested paths like "MyFolder/nested/file.txt"*/]

### 3.7 Starred items

Stars are **per-user**, so they are a join table keyed by `(user, resource)` rather than a boolean column. A file shared with you can sit in your Starred list without touching the owner's view — a column would have made your star mutate their file.

You may only star what you can already see; *un*starring deliberately skips that check, so removing a star still works after the item is trashed or the share is revoked. Listings attach `starred` with one extra query per request, not one per row. Toggling is optimistic with rollback, and a star that is on is never hidden behind hover.

[SCREENSHOT: /*The Starred view listing starred files and folders*/]

[SCREENSHOT: /*A file card with its star filled in amber, showing the toggle in context*/]

### 3.8 Preview, download, and public links

Blobs live in a **private** bucket. Every download or preview is a **time-limited signed URL** issued after authorization — no permanent public URL to any file ever exists.

Public links go further: `POST /api/share-links` mints a 32-byte URL-safe token, optionally with an expiry and a bcrypt-hashed password. Visitors open `/s/<token>` with no account.

Four decisions shape it:

- **The metadata endpoint reveals almost nothing.** For a protected link it returns only `requiresPassword: true` — not the name, size, or owner. Naming the file before checking the password leaks exactly what the password protects.
- **Subfolder traversal is descendant-checked.** Without it a token for one folder would read any folder in the database by id.
- **The password is resent per request**, not exchanged for a session. The server stays stateless and closing the tab genuinely ends access.
- **Expired links return `410`, not `404`** — the link did exist, and saying so is more useful.

Only the **owner** may create a link. An editor on a shared folder may add files to it, but handing the owner's content to the internet is not theirs to decide.

[SCREENSHOT: /*The Share modal showing the public link section — expiry dropdown, password field, and an existing link with copy and revoke buttons*/]

[SCREENSHOT: /*The visitor page at /s/<token> showing the password gate*/]

[SCREENSHOT: /*The visitor page showing a shared folder's contents with download buttons*/]

### 3.9 Sharing with named users

A share modal resolves an email to a user and assigns `viewer` or `editor`. Every protected operation calls `getAccessRole`, which resolves in three stages: ownership, then a direct grant, then **inheritance** — walking *up* the folder chain (bounded at 50 levels) for a share on any ancestor, where `editor` beats `viewer`.

Inheritance is what makes sharing feel natural: granting access to a folder covers everything beneath it, at any depth, including files added later. User lookup is exact-match only and returns just `id`, `email`, `name`, so it cannot enumerate the user base.

[SCREENSHOT: /*The Share modal with an email entered, role dropdown, and existing shares listed*/]

[SCREENSHOT: /*The "Shared with me" view listing items another account shared*/]

### 3.10 Trash with scheduled auto-purge

Deletion is soft: `is_deleted = true`, nothing leaves the database, no blob is removed. The partial index means a trashed folder no longer blocks a new folder of the same name.

Trash now empties itself. `is_deleted` is a boolean and cannot express a retention window, so a `deleted_at` timestamp was added and backfilled; soft delete stamps it and restore clears it (otherwise a restored-then-retrashed item would carry a stale timestamp and purge early).

The sweep's ordering is the whole trick: **blobs are collected and removed before the rows**, because dropping a folder row cascades to every file beneath it and destroys the only record of where those blobs live. Reversing the two steps leaks storage silently and permanently.

Two ways to drive it, because a free Render instance sleeps and an in-process timer cannot fire while asleep:

| | |
| --- | --- |
| In-process sweeper | Runs at boot *and* on an interval — waking up is itself the most reliable trigger |
| `POST /api/maintenance/purge-trash` | For an external scheduler, guarded by `PURGE_SECRET` — a cron job has no cookies |

The secret is compared with `crypto.timingSafeEqual`; a plain `===` returns on the first differing byte and leaks it to a patient caller.

[SCREENSHOT: /*The Trash view showing deleted items, the restore/delete actions, and the "deleted automatically after 30 days" notice*/]

### 3.11 Search, views, and sorting

Case-insensitive `ILIKE` scoped to the caller's own resources, with LIKE wildcards in the query escaped so a literal `_` behaves as typed. Grid and list layouts, sorting by name/date/size, and category filters.

Sorting and filtering run **client-side** over the complete result set — possible only because the API returns every item in a folder. This is recorded because it constrains a future change: server-side pagination would require moving sorting to the server too, since sorting one page rather than the whole folder is visibly wrong.

> **Known limitation:** search caps at 50 results per type with no cursor, so further matches are unreachable and the UI gives no sign they exist. See [§16](#16-future-improvements).

[SCREENSHOT: /*The explorer in list view with the sort dropdown open*/]

---

## 4. Tech Stack

### Frontend

| Technology | Role |
| --- | --- |
| **React 19** | Component model. The UI is heavily stateful — selections, modals, uploads, navigation |
| **TypeScript** | Response shapes are declared once and shared, so a contract change is a compile error rather than a runtime `undefined` |
| **Vite 6** | Build tool; build-time env inlining keeps runtime config lookups out of the bundle |
| **Tailwind CSS 4** | Utility styling, consistent dark theme without a separate stylesheet architecture |
| **lucide-react** | Tree-shakeable icons |

### Backend

| Technology | Role |
| --- | --- |
| **Node ≥20 / Express 5** | Minimal and unopinionated, which keeps the middleware chain explicit — important when its order is itself a security property |
| **TypeScript** | `strict`, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` |
| **Zod 4** | Runtime validation. TypeScript vanishes at runtime; Zod is what actually guarantees a body's shape, and its issue lists render directly in the UI |
| **jsonwebtoken** | Access and refresh tokens, signed with **independent** secrets |
| **bcryptjs** | Password hashing at cost 10 — deliberately slow, which is the point |
| **multer 2** | Multipart parsing for the small-file path, with an enforced size limit |
| **express-rate-limit** | Throttles the guessing-prone endpoints |
| **google-auth-library** | Verifies Google ID tokens with audience pinning |
| **@supabase/supabase-js** | One client for both PostgreSQL and object storage |

### Data, hosting, tooling

**PostgreSQL (Supabase)** — the data is inherently relational, and partial indexes express rules like "unique among *non-deleted* siblings" directly in the schema. **Supabase Storage** — private bucket with signed upload and download URLs, exactly what both upload paths need. **Render** — one web service running the API, which also serves the SPA. **tsx / tsc / npm / raw SQL migrations** for development; `.npmrc` carries `include=dev` in both packages because `NODE_ENV=production` otherwise makes npm omit the very tools the build needs.

---

## 5. Frontend

### Architecture

No state library and no router. State divides cleanly in two, and two contexts express that without ceremony:

```
App
├── /s/<token> → PublicShareView        (outside auth entirely)
└── AuthProvider                        (who is signed in)
    └── StorageProvider                 (files, folders, uploads, trash, shares, stars)
        └── MainLayout
```

`StorageProvider` mounts only **after** a user exists, so every storage operation can assume authentication rather than defensively re-checking.

**On having no router.** For a workspace app whose navigation is *within* a hierarchy, a router adds a dependency and a URL-sync problem without proportional benefit. The honest cost: the current folder is not in the URL, so folders cannot be bookmarked and Back does not navigate up. Recorded as a future improvement rather than presented as a win.

Public share links still need a URL, so `App` reads `window.location.pathname` once at boot: `/s/<token>` renders the visitor page **outside `AuthProvider`** — mounting the auth flow would bounce a visitor to a sign-in screen they cannot complete.

### API integration

One `ApiClient` centralises four things that would otherwise be duplicated across dozens of call sites: the base URL, `credentials: 'include'`, refresh-on-`401` with single retry, and error normalisation from the API's `{ error: { code, message, issues? } }` envelope.

Two deliberate exceptions:

- **Uploads use `XMLHttpRequest`.** `fetch()` cannot report upload progress. The XHR path re-implements refresh-on-`401`, and sets `withCredentials: false` when talking to Supabase directly — a different origin, where session cookies must never be sent.
- **Public share calls bypass `request()` entirely.** That wrapper treats every `401` as an expired session and silently refreshes. Here `401` means *wrong password*; retrying would be useless and confusing. Those calls also send no credentials — the token is the only credential, and a stray session cookie must never be what makes a link work.

### UI decisions

Dark theme; grid and list modes; optimistic navigation; a non-blocking upload panel; errors surfaced in place. Failures are **itemised** — uploading twenty files where three fail marks exactly those three and keeps the seventeen. Password fields share one `PasswordInput` with a reveal toggle, typed `button` because all three sit inside forms and the default `submit` would post the form on each reveal.

[SCREENSHOT: /*The sign-in page with the password revealed, showing the eye toggle*/]

[SCREENSHOT: /*The app on a mobile-width viewport with the collapsed sidebar*/]

---

## 6. Backend

### Layers and middleware order

```
Request → trust proxy → CORS → JSON → cookies → router
        → requireAuth → controller (validate → authorize → act)
        → lib (supabase, tokens, cookies, google, access, stars, purge)
        → Supabase → response
```

Order is a correctness property, not a style choice. `trust proxy` first, because Render terminates TLS in front of the app and without it Express sees plain HTTP. CORS before routes, so preflights never reach them. `cookie-parser` before `requireAuth`, which depends on it. **Static SPA serving after the API**, so it can never shadow a route — and its fallback excludes `/api/`, because otherwise a typo'd endpoint would return `index.html` with status `200` and the client would parse HTML as JSON.

CORS wildcard matching walks literal segments rather than building a regex — converting a hostname pattern to a regex makes `.` mean "any character", which would let `https://evil-vercel.app` match a pattern meant for `https://*.vercel.app`.

### Endpoints

| Group | Endpoints |
| --- | --- |
| Auth | `register` · `login` · `google` · `refresh` · `logout` · `me` |
| Folders | create · `root` · `:id` · `:id/path` · rename/move · delete · restore · permanent · `trash` · empty trash |
| Files | `upload` · `upload-url` · `complete` · list · `:id` · rename/move · delete · restore · permanent |
| Search | `?q=` |
| Shares | create · list · `shared-with-me` · revoke |
| Share links | create · list · revoke |
| Public | `:token` · `:token/access` · `:token/folder/:id` · `:token/file/:id` |
| Stars | create · list · remove |
| Maintenance | `purge-trash` |
| Health | `/api/health` — status, upload limits, retention window |

Literal paths register before parameterised ones — `/folders/trash` must precede `/folders/:id`.

### Authorization — the central trade-off

The API connects with the **service role key**, which bypasses PostgreSQL Row Level Security entirely. RLS is enabled on the tables but the service role is not subject to it.

The consequence is stated plainly in the source: **the application-level check is the only thing preventing cross-user access.** There is no database safety net.

It was accepted for a specific reason. The inherited-permission model — a folder grant cascading to arbitrarily deep descendants — is hard to express as an RLS policy and straightforward as an explicit ancestor walk in application code. That made sharing tractable, at the cost of requiring discipline in every controller.

Resources the caller cannot see return `404`, not `403`, so the API never confirms another user's data exists.

### Validation, errors, configuration

Every body is parsed by Zod before any logic runs. Notable cases: multipart text fields arrive as strings, so `""` is normalised to `null` before Zod sees it; `completeUploadSchema` deliberately does **not** accept size or MIME, because those are read back from storage instead.

Errors use one envelope with machine-readable codes, so the client branches on `code` rather than string-matching. `23505` becomes a `409`; anything unexpected is logged server-side and returned as a generic `500`.

Environment loading fails fast and **collects** every missing variable into one message, so a misconfigured deploy reports all gaps at once. Durations parse into both a string (for `jsonwebtoken`) and milliseconds (for cookie `maxAge`) so the two cannot drift. The boot log states what was actually resolved:

```
[api] listening on port 10000 (production)
[api] web bundle: serving /opt/render/project/src/web/dist
[api] google sign-in: enabled (6284...apps.googleusercontent.com)
[api] trash purge: 30d retention, sweeping every 360m, manual endpoint enabled
```

Each line exists because a specific misconfiguration was once hard to diagnose.

[SCREENSHOT: /*Render deployment logs showing a successful boot with all diagnostic lines*/]

---

## 7. Database

PostgreSQL via Supabase, with ordered hand-written migrations in `api/infra/migrations/`.

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `users` | Accounts | `password_hash` **nullable** (Google-only accounts), `google_id` |
| `folders` | Hierarchy | self-referencing `parent_id`, `is_deleted`, `deleted_at` |
| `files` | File metadata | `storage_key` unique, `size_bytes`, `is_deleted`, `deleted_at` |
| `shares` | Named grants | polymorphic `resource_id`, `role` check constraint |
| `pending_uploads` | Direct-upload ledger | `storage_key` primary key |
| `stars` | Per-user bookmarks | composite PK `(user_id, resource_type, resource_id)` |
| `share_links` | Public links | `token` unique, `password_hash`, `expires_at`, `last_used_at` |

### Design notes

**Partial indexes** encode business rules where they cannot be bypassed: `folders_unique_name_per_parent … WHERE is_deleted = false` (uniqueness applies only among live siblings), `users_google_id_key … WHERE google_id IS NOT NULL` (one account per Google identity, while password accounts all hold `NULL`), and `files_deleted_at_idx … WHERE is_deleted = true` (the purge scans only trash).

**`shares` and `stars` are polymorphic** — `resource_id` may reference a file or a folder, discriminated by `resource_type`. This trades foreign-key enforcement for schema simplicity, with a `CHECK` preserving the part that matters most. `shares` is indexed in **both** directions because authorization asks the question both ways: "who can see this?" and "what can I see?"

**Two systems, no shared transaction.** The database and object store are reconciled explicitly. Multipart writes the blob first and deletes it if the row fails. The direct path uses `pending_uploads` as a ledger of issued keys, consumed on completion.

> **Known gap:** if a client gets a signed URL, uploads, and never calls `complete` — closed tab, dropped connection — the pending row and its blob remain. A sweeper is anticipated but **not implemented**. See [§16](#16-future-improvements).

[SCREENSHOT: /*An entity-relationship diagram of the seven tables*/]

---

## 8. APIs and Integrations

**Supabase PostgreSQL** — one reused client, `persistSession: false`. The service role key bypasses RLS and is therefore highly privileged: it exists only server-side and never reaches any `VITE_*` variable.

**Supabase Storage** — private bucket; all access via time-limited signed URLs. Keys are `{userId}/{uuid}`, never derived from the user's filename.

> **Operational note:** Supabase enforces its own upload ceiling at project and bucket level, independent of this app's limits. On the free tier that is 50 MB and cannot be raised — so the direct path, designed for multi-gigabyte files, is constrained by the plan rather than the code.

**Google Identity Services** — the browser obtains an ID token; the server verifies the signature, pins the audience, requires `email_verified === true`, and matches on the immutable `sub`. No client secret exists in this flow. The deployment origin must be registered under the OAuth client's *Authorized JavaScript origins*, which is a required step whenever the serving origin changes.

---

## 9. System Workflow

**Signed-out visit.** `GET /api/auth/me` → `401` → auto-refresh → `401` → sign-in screen. Both are **expected**, not errors; they only indicate a problem if they persist *after* a successful login.

**Sign-in.** Validate → bcrypt compare → sign both JWTs → `Set-Cookie` ×2 → explorer loads.

**Browsing.** `getAccessRole` resolves owner → direct grant → inherited grant; `null` returns `404`. Children are listed, `starred` attached in one query, breadcrumbs fetched separately.

**Small upload.** `GET /api/health` for limits → multipart to the API → multer buffers → authorize folder → blob to storage → row inserted (blob deleted if it fails).

**Large upload.** `upload-url` (authorize, issue signed URL, record pending) → browser `PUT`s straight to storage → `complete` (verify prefix, verify pending row, re-authorize folder, read size/MIME back from storage, insert row, consume ledger entry).

**Folder drop.** Read `dataTransfer.items` synchronously → walk entries, looping `readEntries` until empty → resolve each unique path to a folder id, creating or adopting → upload each file into its resolved folder → full refresh, because the tree changed.

**Public link.** Owner creates a token → visitor opens `/s/<token>` → metadata reveals only whether a password is needed → on access, password is verified and either a signed URL or a folder listing is returned, with every subfolder descendant-checked.

**Purge.** Sweeper finds trash older than the retention window → collects blobs, including files under expiring folders → removes blobs → deletes rows.

---

## 10. Use Cases

| User | Problem | How it helps |
| --- | --- | --- |
| Individual | Files scattered, no organised remote copy | Nested folders, stars, search, recoverable trash |
| Small team | Emailed attachments create version confusion | Share a folder once; everything inside follows, including files added later |
| Client-facing work | Delivering assets to someone with no account | A public link, optionally expiring and password-gated |
| Developer | Tutorials skip the hard parts | A readable implementation of auth, inherited permissions, and large-file handling |

**A designer sharing with a client.** Share the folder as `viewer`, or send a password-protected link that expires in 7 days. Files added next week appear automatically — permission resolves by ancestor walk at access time, not by copying grants at share time.

**Recovering a mistake.** A deleted folder and everything in it sit in the trash; restoring flips one flag. A *new* folder with the same name can be created meanwhile, because the uniqueness index only applies to live rows. Anything left untouched is purged after the retention window.

**Uploading a 300 MB video.** It takes the direct path automatically. The API's memory usage is identical to uploading a text file — invisible to the user, decisive for the server.

---

## 11. Challenges

### Cross-site cookies silently breaking auth

Login returned `200`; the next request returned `401`. Server logs showed nothing wrong, and it reproduced inconsistently across browsers.

The cause: `vercel.app` and `onrender.com` are both on the **Public Suffix List**, so the frontend and API were different *sites* and the auth cookie was third-party — exactly what Safari, Brave, and blocker extensions discard. The key realisation was that moving both to Render would **not** fix it, since two Render services are also two sites. The fix was serving the SPA from the API process itself.

*Learned:* browsers decide "same site" by registrable domain, not hostname. Deployment topology determines whether cookie auth works at all.

### A `500` on Google sign-in

The token verified, then the request failed with a generic `500` that gave nothing away. Reasoning backwards from *where* a `500` could originate narrowed it to the database write; a read-only schema probe returned `column users.google_id does not exist`. Two migrations had never been applied. The code was correct; the schema was behind it.

*Learned:* code and schema are separate deployables that drift. A `500` straight after a successful external verification points at persistence.

### Reading dropped folders

Two silent failure modes — a neutered `DataTransfer` after the first `await`, and `readEntries` truncating past 100 children. Both produce no error. Solved by capturing entries synchronously and looping the reader, with a depth cap for cyclic trees.

Verified with a harness that reproduced the reader's **constraints** — a 250-child folder and a self-referencing directory — not just its happy path. A single `readEntries` call works perfectly for 99 files and loses data at 101.

### Uploads that do not kill the server

`multer` with `memoryStorage` holds the whole file, and the Supabase client copies it — roughly **twice the file size per in-flight upload**. On a 512 MB instance with a 50 MB limit, about four concurrent uploads exhaust memory and the process is OOM-killed. It is a cliff, not a slope.

Solved with a second path where bytes never reach the API — which introduced a new problem, a blob with no row, tracked by the `pending_uploads` ledger.

*Learned:* "it works" and "it works under concurrency" are different claims. Every such optimisation has a cost; here it is a consistency gap that must be tracked rather than assumed away.

### Permissions that inherit

Copying grants onto descendants at share time breaks for files added later and creates a mess on moves. Resolving at **access** time by walking ancestors trades a little query cost for a great deal of correctness. The depth bound is what makes the recursion safe against malformed data.

### An ambiguous empty string

After the single-origin move, the client needed an empty base URL meaning "this page's origin" — but `||` treats `""` as falsy and collapsed it into the localhost fallback. Fixed with `??`. Later removed entirely: with one backend and no runtime switching, the URL became a constant, which deletes a whole class of "deployed bundle points at the wrong API" failures.

---

## 12. Skills Learned

**Authentication and sessions.** Why `httpOnly` cookies beat `localStorage`; why access and refresh tokens have different lifetimes and the refresh cookie is path-scoped; why clearing a cookie requires repeating its attributes; how the Public Suffix List defines "same site"; how to de-duplicate concurrent refreshes behind one promise; why identical errors for "no such user" and "wrong password" prevent enumeration.

**OAuth.** The distinction between an ID-token flow (verify a signature, no secret) and an authorization-code flow (exchange a code, secret required). Recognising the configured client secret was never read — and removing it — came from understanding which flow was in use. Plus audience pinning, matching on `sub`, and why `email_verified` must be affirmatively `true`.

**Database design.** Adjacency lists and ancestor walks; partial indexes as enforceable business rules; soft deletes and their effect on every query and uniqueness rule; polymorphic associations and their trade-off; indexing driven by query direction; migrations as reviewable history — and that schema drift causes production failures that look like code bugs.

**File handling.** That server *memory*, not disk or bandwidth, is the binding constraint, and being able to compute the concurrency ceiling from instance RAM and file size. Signed URLs, private buckets, server-generated keys, and reading metadata back from storage instead of trusting the client. Also a general lesson about distributed consistency: two systems without a shared transaction need explicit reconciliation, and naming the remaining gap is part of the design.

**Frontend.** Context as a deliberate choice; gating one provider behind another; centralising HTTP concerns; knowing when the platform forces your hand (`fetch` cannot report upload progress, and that decision cascades).

**Browser APIs and their failure modes.** The File System Entry API taught more about defensive frontend work than any well-behaved API could: read before neutering, loop a batched reader, cap recursion, always provide a fallback. Every one of those failures is silent.

**Deployment.** Variables validated at startup with all failures reported at once; `trust proxy` for TLS-terminating platforms — and that setting it to `true` rather than `1` would let anyone spoof `X-Forwarded-For` and walk past rate limiting; build-time versus runtime configuration; boot diagnostics designed so each common misconfiguration is visible at a glance.

**Debugging.** The most transferable skill: reasoning from the *shape* of a failure to its location. A `401` after a `200` login implicates the browser. A `500` after successful external verification implicates the database. A generic error is a reason to probe real system state rather than re-read correct code. And distinguishing noise from faults — two `401`s on a signed-out page load are the app working correctly.

**Judgement.** Knowing which trade-offs were made and being able to defend them: service-role access for a tractable inheritance model; client-side sorting for simplicity, at the cost of constraining pagination; two upload paths for a consistency gap that must be tracked. A limitation named honestly is more useful than one quietly omitted.

---

## 13. Security

### Implemented

**Passwords** — bcrypt cost 10; plaintext never stored, logged, or returned; capped at 72 bytes to match bcrypt's truncation point; `password_hash` excluded by explicit column selection; identical errors for unknown email and wrong password.

**Sessions** — both tokens `httpOnly`, `Secure` + `SameSite=None` in production; 15-minute access tokens; refresh cookie path-scoped; **independent signing secrets**, so compromising one does not yield the other; logout clears with matching attributes.

**Rate limiting** — sign-in, registration, the Google exchange, and the public share endpoints are capped per IP over a rolling window. Only **failed** requests count: signing in correctly ten times is not an attack, and counting it would lock out the legitimate case while barely slowing brute force. `POST /api/auth/refresh` is deliberately exempt — the client calls it on every page load, and forging one needs the signing secret. Per-IP counting is trustworthy only because `trust proxy` is `1` rather than `true`.

**Authorization** — every protected operation resolves a role first; mutations need `owner` or `editor`; inaccessible resources return `404`, not `403`; ancestor traversal is depth-bounded.

**Input** — Zod on every body; LIKE wildcards escaped in search; parameterised queries throughout; upload limits enforced on both paths.

**Files** — keys are `{userId}/{uuid}`, never user-supplied; private bucket; signed URLs expire; the completion endpoint verifies the key prefix and that the key was actually issued; size and MIME read back from storage; session cookies explicitly **not** sent on direct-to-storage uploads.

**Public links** — 32 bytes of CSPRNG entropy; passwords bcrypt-hashed; metadata withheld until the password passes; subfolder access descendant-checked; expiry enforced server-side on every call; `PURGE_SECRET` compared in constant time.

**Configuration** — secrets only in server-side variables; `VITE_*` values are public by construction and contain none; the process refuses to boot misconfigured.

### Deliberate trade-off

RLS is enabled but bypassed by the service role, so application checks are the **only** barrier. Accepted knowingly, because the inheritance model is far more tractable in application code — and flagged in the source at every relevant call site.

### Not implemented

| Gap | Risk |
| --- | --- |
| CSRF tokens | Mitigated in practice by `SameSite` and a JSON-only API, but no explicit token |
| Email verification for password accounts | Only Google-sourced addresses are verified |
| Password reset | No recovery flow |
| Refresh token revocation | Stateless; a stolen refresh token is valid until expiry |
| Virus/content scanning | No inspection of uploaded content |
| Audit logging | No record of who accessed or shared what |
| Per-user quotas | Consumption is unbounded |
| Security headers | No CSP, HSTS, or `X-Frame-Options` |

---

## 14. Performance

### Implemented

Dual-path uploads (the largest single win — server memory is independent of file size); server-declared limits cached per connection; targeted refreshes (a plain upload refetches only files; one that created folders refetches the tree); cached folder resolution during folder uploads, so a hundred files create one folder; single-flight token refresh; `starred` attached with one query per listing, not per row; trash emptied in one server-side sweep; indexes chosen by query direction; a reused Supabase client; ~93 KB gzipped bundle.

### Known bottlenecks

**No pagination anywhere.** Every list endpoint returns its full result set. A folder with 5,000 files sends 5,000 rows, renders 5,000 components, and fires 5,000 thumbnail requests. Nothing degrades gracefully.

**Search truncates silently** at 50 per type with no cursor or total — a correctness problem as much as a performance one.

**No lazy loading** of code, images, or data. Every thumbnail loads immediately, including below the fold.

**Multipart memory ceiling** — roughly twice the file size per in-flight upload; about four concurrent 50 MB uploads on a 512 MB instance before an OOM kill.

**Sequential uploads**, **per-level ancestor-walk cost** on deep hierarchies, and **client-side sorting** that couples any future pagination to a server-side sorting change.

---

## 15. Testing

Testing was **manual and targeted**; there is no committed test suite or runner. Verification relied on type checking, purpose-built scripts, live probes, and browser checks.

**Static.** The API compiles under `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; the frontend runs `tsc --noEmit`. Shared response types make contract changes compile errors.

**Targeted.** The drag-and-drop traversal — the highest density of silent failure modes — was validated against a harness reproducing the browser API's constraints: nested structure, loose files, empty folders, a 250-child folder across batches, a cyclic tree, and the no-API fallback. All six passed; the batching and cycle cases would otherwise have shipped as silent data loss.

**Live.** Read-only schema probes through the app's own client identified missing migrations and later confirmed them applied. Direct HTTP probes verified cookie attributes, CORS headers, rate-limit behaviour (`401, 401, 401, 429, 429` against a ceiling of three), the purge endpoint's auth paths (missing/wrong secret → `401`; unset secret → `501`), and that a failed sweep logs without killing the process. Routing was checked class by class: `/` returns HTML, `/api/health` returns JSON, a deep link returns the shell, an unknown `/api/*` path returns JSON `404`.

**Browser.** Folder drag-and-drop was exercised end to end with a synthetic drop carrying a nested tree — folders created, nested paths shown in the progress panel, structure recreated exactly including the empty folder. The password reveal toggle was confirmed to flip `type`, update `aria-pressed`, and **not** submit its form.

### Notable bugs found

| Bug | Cause | Fix |
| --- | --- | --- |
| Login `200`, next request `401` | Third-party cookie discarded | Single-origin deployment |
| Google sign-in `500` | Migrations unapplied | Applied `003` and `004` |
| Unverified email could link to an account | `=== false` let a *missing* claim through | Require `=== true` |
| Client secret configured but unused | Misread ID-token vs code flow | Removed |
| Empty API URL fell back to localhost | `||` collapsed a meaningful `""` | `??`, then a constant |

### Edge cases handled

Google accounts with no password; duplicate names against live vs trashed siblings; empty multipart fields arriving as `""`; repeated query parameters arriving as arrays; LIKE wildcards in search; folders past the reader's batch size; cyclic directories; concurrent refreshes; partial upload failures; non-JSON proxy responses.

---

## 16. Future Improvements

### Short-term

`loading="lazy"` on grid thumbnails (one attribute, immediate payoff) · fix the silent search cap · implement the `pending_uploads` sweeper, since abandoned uploads leak storage and the ledger already exists · lower the multipart threshold to raise the safe concurrency ceiling · security headers (CSP, HSTS, `X-Frame-Options`) · populate the unused `checksum` column for integrity checks.

### Medium-term

Server-side pagination **with** server-side sorting — the only change that alters scaling behaviour, and they must ship together, since sorting one page rather than the whole folder is visibly wrong · URL-based routing, so folders can be bookmarked and Back navigates up · parallel uploads with a concurrency limit · password reset and email verification · refresh-token revocation · audit logging · per-user quotas.

### Long-term

Cache authorization within a request (the ancestor walk repeats) · materialised paths or `ltree` to replace the iterative walk with one indexed query · a shared rate-limit store, so limits stay accurate across instances · file versioning · a background pipeline for thumbnails, virus scanning, and OCR — feasible on the multipart path where the API already holds the bytes · real-time updates over WebSockets · an automated test suite and CI.

---

## 17. Conclusion

A deployed full-stack storage platform: a TypeScript Express API of roughly forty endpoints, a React SPA, a seven-table PostgreSQL schema under ordered migrations, object storage with signed URLs, dual authentication including verified Google Sign-In, a hierarchical permission system with inheritance, tokenised public links, and a self-emptying trash — compiled together and served from a single origin.

The substance was never writing CRUD endpoints. It was the decisions:

- Recognising that **deployment topology determines whether cookie auth works**, that the Public Suffix List draws that line, and that two services on one platform are still two sites.
- Designing **two upload paths** because one is either memory-unsafe or needlessly complex — and accepting the consistency gap that creates.
- Resolving **permissions at access time** rather than materialising them at share time, so inheritance is automatic and moves need no bookkeeping.
- Encoding rules as **partial unique indexes**, where application code cannot bypass them.
- Ordering the purge so **blobs die before rows**, because the cascade destroys the only record of where they live.
- Handling a **browser API whose every failure is silent**, and testing its constraints rather than its happy path.
- Choosing **service-role access deliberately**, understanding exactly which safety net that removes.

What it demonstrates is the difference between an application that works in a demo and one reasoned about under load, under attack, and under the constraints real browsers and hosting platforms impose. The limitations recorded throughout are not omissions — they are the measured boundaries of what was built, and they mark exactly where the next work begins.

[SCREENSHOT: /*A final hero shot — the explorer fully populated, ideally with a share modal open or an upload in progress*/]
