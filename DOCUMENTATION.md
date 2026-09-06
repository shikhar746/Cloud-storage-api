# CloudStorage Explorer — Technical Documentation

**A self-hosted cloud file storage platform with folder hierarchies, granular sharing, and dual-path uploads.**

| | |
| --- | --- |
| **Repository** | /*repository link goes here*/ |
| **Live application** | /*deployed application link goes here*/ |
| **Author** | /*your name goes here*/ |
| **Document version** | 1.0 |

---

## Table of Contents

1. [Project Introduction](#1-project-introduction)
2. [Project Overview](#2-project-overview)
3. [Features](#3-features)
4. [Tech Stack](#4-tech-stack)
5. [Frontend](#5-frontend)
6. [Backend](#6-backend)
7. [Database](#7-database)
8. [APIs and Integrations](#8-apis-and-integrations)
9. [Complete System Workflow](#9-complete-system-workflow)
10. [Use Cases](#10-use-cases)
11. [Challenges Faced](#11-challenges-faced)
12. [Skills Learned](#12-skills-learned)
13. [Security](#13-security)
14. [Performance and Optimization](#14-performance-and-optimization)
15. [Testing and Debugging](#15-testing-and-debugging)
16. [Future Improvements](#16-future-improvements)
17. [Conclusion](#17-conclusion)

---

## 1. Project Introduction

### 1.1 Project Name

**CloudStorage Explorer** — a full-stack cloud file storage and collaboration platform.

### 1.2 Short Overview

CloudStorage Explorer is a web application that lets a user store files in the cloud, organise them into nested folders, recover deleted items from a trash bin, search their library, and share individual files or entire folder trees with other users at two distinct permission levels.

It is built as a monorepo containing two deployable halves — a TypeScript/Express REST API and a React single-page application — which are compiled together and served from **one origin** by a single web service. The persistence layer is Supabase, used both as a PostgreSQL database and as an object store for the file blobs themselves.

### 1.3 Problem Statement

Storing files in the cloud is a solved problem commercially, but the commercial solutions are opaque. A developer or a small organisation that wants to understand — or control — how their file storage actually works faces a difficult choice:

- **Use a hosted product** (Google Drive, Dropbox, OneDrive). Reliable, but the data lives on someone else's terms, the permission model cannot be extended, and there is no way to integrate custom business logic into the upload path.
- **Build from scratch.** This immediately surfaces a set of genuinely hard sub-problems that are invisible from the outside: how do you upload a 2 GB file without your server holding it in memory? How do you make a permission granted on a folder apply to a file nested six levels below it? How do you keep an authentication session alive across a page refresh without exposing a token to JavaScript?

This project takes the second path deliberately, and treats those sub-problems as the actual substance of the work.

### 1.4 Why This Problem Matters

File storage looks trivial and is not. The naive implementation — accept a multipart upload, write it to disk, record a row — collapses under three pressures that arrive almost immediately in real use:

1. **Memory.** A server that buffers uploads in RAM has a hard concurrency ceiling determined by file size and instance memory. Exceed it and the process is killed, taking every unrelated in-flight request with it.
2. **Authorization.** Once files can be shared and folders can nest, "may this user read this file?" stops being a single database comparison and becomes a graph traversal.
3. **Session integrity.** Cookie-based authentication behaves differently depending on whether your API and your frontend are on the same site — a detail that is invisible in development and breaks silently in production for a subset of users.

Each of these has a correct answer that differs substantially from the obvious one. Building the system is the only reliable way to encounter them.

### 1.5 Motivation

The motivation was to build a system that is *complete* rather than demonstrative — one where the difficult paths are actually implemented rather than stubbed:

- Not just "upload a file", but **two upload strategies** selected automatically by file size, with the large-file path bypassing the API entirely.
- Not just "share a file", but a **permission model that inherits** down a folder tree, with grants resolved by walking ancestors.
- Not just "log in", but a **dual authentication system** — email/password and Google Sign-In — that can link a Google identity onto an existing password account without creating a duplicate.
- Not just "it works locally", but a **deployment topology deliberately chosen** so that browser privacy controls do not break the session.

### 1.6 What the Project Aims to Solve

| Goal | How it is addressed |
| --- | --- |
| Store files of widely varying sizes without destabilising the server | Two upload paths, split by a server-declared threshold |
| Organise files the way users actually think | Arbitrarily nested folders with move, rename, and breadcrumb navigation |
| Make deletion non-destructive | Soft delete into a trash bin, with restore and explicit permanent delete |
| Share safely and granularly | Per-resource grants at `viewer` / `editor`, inherited through folder hierarchies |
| Keep sessions secure and persistent | Short-lived access tokens with silent refresh, both in `httpOnly` cookies |
| Reduce sign-up friction | Google Sign-In with server-side ID token verification and account linking |

### 1.7 Key Objectives

1. Design a REST API with consistent, machine-readable error envelopes.
2. Implement a permission system that correctly resolves inherited access.
3. Support large file uploads without proportional server memory cost.
4. Implement secure, refreshable cookie-based sessions.
5. Integrate a third-party identity provider without weakening account security.
6. Deploy so that the authentication model works across all major browsers, including those blocking third-party cookies.
7. Keep the entire system reproducible from a documented environment specification and a set of ordered SQL migrations.

### 1.8 How the Solution Works — In Brief

A user authenticates and receives two `httpOnly` cookies: a short-lived access token (15 minutes) and a long-lived refresh token (7 days). The React client makes credentialed requests to the API; when one returns `401`, the client transparently calls the refresh endpoint and retries the original request exactly once.

To upload, the client asks the API for its current limits. Files at or below the threshold are sent as multipart directly to the API, which buffers and forwards them to object storage. Files above it take a different route entirely: the client asks for a **signed upload URL**, uploads the bytes straight to Supabase Storage — never touching the API — and then calls a completion endpoint that verifies the blob landed and records it in the database.

Every read or write is authorized by resolving the caller's role against the resource: owner, a direct share, or a share on any ancestor folder.

[SCREENSHOT: /*The main file explorer showing the sidebar, breadcrumb navigation, folder grid, and file grid with the app fully loaded — this is the "hero" screenshot for the whole project*/]

---

## 2. Project Overview

### 2.1 High-Level Architecture

The system is a monorepo with two packages that are built together and deployed as a **single web service**:

```
Cloud-storage-api/
├── package.json          Root orchestrator — builds web, then api
├── api/                  Express REST API (TypeScript)
│   ├── src/
│   │   ├── app.ts        Express app: middleware, routes, static SPA serving
│   │   ├── server.ts     HTTP listener and boot diagnostics
│   │   ├── config/       Environment loading and validation
│   │   ├── routes/       Route definitions per resource
│   │   ├── controllers/  Request handlers
│   │   ├── middleware/   Auth guard, upload handling, error handler
│   │   ├── lib/          Supabase client, tokens, cookies, Google, access control
│   │   ├── schemas/      Zod request validation schemas
│   │   └── ...
│   └── infra/migrations/ Ordered SQL migrations
└── web/                  React SPA (Vite)
    └── src/
        ├── context/      AuthContext, StorageContext
        ├── services/     API client, mock storage
        ├── components/   Explorer, layout, modals, auth
        ├── utils/        Formatters, drag-and-drop traversal
        └── types/        Shared TypeScript types
```

### 2.2 Major Components

| Component | Responsibility |
| --- | --- |
| **React SPA** | All user interface, client-side state, optimistic navigation |
| **Express API** | Authentication, authorization, business rules, database access |
| **PostgreSQL (Supabase)** | Users, folders, files metadata, shares, pending uploads |
| **Supabase Storage** | The file blobs themselves, in a private bucket |
| **Google Identity Services** | Third-party identity, verified server-side |
| **Render** | Single web service hosting both the API and the compiled SPA |

### 2.3 How the Pieces Interact

The defining architectural decision is that **the API also serves the frontend**. When the service boots, it resolves the path to the compiled `web/dist` directory relative to its own module location. If a build is present, it mounts it as static files with a single-page-application fallback: any `GET` that matches no file and does not begin with `/api/` returns `index.html`, so client-side deep links survive a refresh.

The consequence is that the browser sees one origin. The SPA at `https://example.onrender.com/` calls `https://example.onrender.com/api/...`, which is a **same-origin request**. This means:

- The authentication cookies are **first-party**, so browsers that block third-party cookies (Safari, Brave, and most blocker extensions) do not discard them.
- There is no CORS preflight on normal operation.
- There is no build-time coupling between the frontend and an API hostname — the client's base URL is the empty string, meaning "wherever this page came from".

The CORS allow-list and the configurable API base URL are both retained, because local development still runs the two halves on separate ports, and hosting the frontend separately remains supported as an explicit alternative.

[SCREENSHOT: /*A browser DevTools Network tab showing a request to /api/auth/me with the Cookie header present, demonstrating first-party cookies on the single-origin deployment*/]

### 2.4 Overall Data Flow

```
┌─────────────┐   credentialed fetch   ┌──────────────┐
│  React SPA  │ ─────────────────────► │  Express API │
│             │ ◄───────────────────── │              │
└─────────────┘   JSON + Set-Cookie    └──────┬───────┘
      │                                       │
      │  direct PUT (large files only)        │ service-role client
      │                                       ▼
      │                              ┌──────────────────┐
      └─────────────────────────────►│ Supabase         │
                                     │  • PostgreSQL    │
                                     │  • Object Storage│
                                     └──────────────────┘
```

Note the asymmetry: **most** traffic follows the top path, but large file bytes take the lower-left path and never pass through the API at all.

[SCREENSHOT: /*A hand-drawn or diagramming-tool architecture diagram showing SPA, API, Supabase Postgres, Supabase Storage, Google Identity Services, and the two distinct upload routes*/]

---

## 3. Features

### 3.1 Authentication — Email and Password

**What it does.** Lets a user register with a name, email, and password, and sign in later with the same credentials.

**Why it exists.** Not every user wants to link a Google account, and a password-based path is the baseline any storage product needs.

**How the user interacts with it.** A combined sign-in / register card. Validation errors return from the server and are rendered inline.

**What happens technically.**

On registration, the request body is validated with Zod (name 2–50 characters, valid email, password 8–72 characters — the upper bound matters because bcrypt silently truncates beyond 72 bytes). The email is lowercased and trimmed so that casing can never create duplicate accounts. The password is hashed with bcrypt at cost factor 10; the plaintext is never stored, logged, or returned.

The user row is inserted. If PostgreSQL rejects it with `23505` (unique violation on email), the API translates that into a clean `409 EMAIL_ALREADY_IN_USE` rather than leaking a database error.

On success the server signs two JWTs and sets them as cookies, then returns the user object. The password hash is never included in any response — the select list is explicit about which columns come back.

On login, the user is fetched by email. A deliberate detail: an account created through Google has **no** `password_hash`, and bcrypt throws when given a null hash, so the comparison is guarded and simply resolves to "invalid credentials" rather than crashing. Both "no such email" and "wrong password" return the identical `401 INVALID_CREDENTIALS` message, so the endpoint cannot be used to enumerate which email addresses are registered.

[SCREENSHOT: /*The sign-in / register page showing the form fields, the "Continue with Google" button, and the overall auth card design*/]

[SCREENSHOT: /*The same auth page displaying an inline validation error, e.g. after submitting a password that is too short*/]

---

### 3.2 Authentication — Google Sign-In

**What it does.** Lets a user sign in with their Google account in one click.

**Why it exists.** It removes the friction of creating and remembering another password, and it provides a verified email address.

**How the user interacts with it.** A "Continue with Google" button rendered by Google Identity Services. Clicking it opens Google's account chooser; on approval the button's callback fires with a credential.

**What happens technically.**

This is an **ID token** flow, not an authorization-code flow. Google Identity Services hands the browser a signed JWT (the "credential"). The browser posts it to `POST /api/auth/google`. The server verifies it with `google-auth-library`, checking the signature against Google's published certificates and pinning the **audience** to the configured client ID — so a token minted for a different application is rejected.

The server then applies a three-branch resolution:

1. **Returning Google user** — matched on Google's stable `sub` claim, *not* on email. This matters: a Google Workspace address can be deleted and reassigned to a different person, but the `sub` is permanent.
2. **Existing password account with the same email** — the Google identity is linked onto that account, so the user keeps every file they already had instead of silently getting a second, empty account.
3. **Brand new user** — a row is created with no `password_hash` at all. Google becomes the only way in.

A critical safety condition governs branch 2: the token's `email_verified` claim must be affirmatively `true`. A missing claim is not treated as confirmation. Without this rule, an unverified address could be used to take over an existing password account.

Because this flow only ever *verifies a signature*, there is no authorization-code exchange and therefore **no client secret** anywhere in the system. The client ID is public by design — it ships in the JavaScript bundle.

[SCREENSHOT: /*The Google account chooser popup appearing over the application's sign-in page*/]

[SCREENSHOT: /*The application immediately after a successful Google sign-in, showing the user's name and avatar in the header*/]

---

### 3.3 Session Management and Silent Refresh

**What it does.** Keeps a user signed in across page refreshes and for days at a time, without ever exposing a token to JavaScript.

**Why it exists.** Tokens stored in `localStorage` are readable by any script that manages to run on the page. Cookies marked `httpOnly` are not.

**What happens technically.**

Two tokens are issued:

| Token | Lifetime | Cookie path | Purpose |
| --- | --- | --- | --- |
| `accessToken` | 15 minutes | `/` | Authorises every API call |
| `refreshToken` | 7 days | `/api/auth/refresh` | Mints a new pair |

Both are `httpOnly`. In production both are `Secure` with `SameSite=None`; in development they fall back to `SameSite=Lax` over plain HTTP so local work is frictionless.

The refresh cookie is deliberately scoped to the single path `/api/auth/refresh`. The browser therefore never attaches it to ordinary API calls — it is transmitted only to the one endpoint entitled to consume it, which shrinks its exposure considerably.

On the client, the API wrapper intercepts every `401` from a non-auth endpoint, calls the refresh endpoint, and retries the original request **once**. The retry flag prevents infinite recursion. The refresh call itself is de-duplicated behind a single shared promise, so if six requests fail with `401` simultaneously, exactly one refresh request is issued and all six await the same result.

Logout clears both cookies. A subtle but important detail: a browser only drops a cookie when the clearing `Set-Cookie` repeats the same attributes it was written with. Omitting `secure` or `sameSite` in production would leave the session cookie alive, so `clearAuthCookies` mirrors them exactly.

[SCREENSHOT: /*DevTools Application tab showing the accessToken and refreshToken cookies with HttpOnly, Secure, and SameSite flags visible, and the refreshToken's restricted Path*/]

---

### 3.4 Folder Management

**What it does.** Create, rename, move, and delete folders, nested to any depth.

**How the user interacts with it.** A "Folder" button opens a naming modal. Folders open on double-click. Breadcrumbs show the current position and allow jumping to any ancestor. A move modal lets a folder be relocated.

**What happens technically.**

Folders are rows with a self-referencing `parent_id`, so the hierarchy is an adjacency list. A `NULL` parent means the user's root.

Uniqueness is enforced by the database rather than by application code, using a **partial unique index** on `(owner_id, parent_id, name) WHERE is_deleted = false`. This is more precise than a plain unique constraint: two folders may share a name if one of them is in the trash, which is exactly the behaviour a user expects after deleting `Photos` and creating a new `Photos`. A collision surfaces as `23505`, which the controller translates to `409 FOLDER_EXISTS`.

Breadcrumbs are served by a dedicated endpoint that returns the full ancestor chain, so navigation state survives a page refresh instead of being reconstructed client-side.

[SCREENSHOT: /*The file explorer inside a nested folder, with the breadcrumb trail showing the full path from root*/]

[SCREENSHOT: /*The "New Folder" modal open with a name typed in*/]

[SCREENSHOT: /*The Move modal showing the folder tree picker for relocating an item*/]

---

### 3.5 File Upload — Dual-Path Strategy

**What it does.** Uploads files, automatically choosing between two completely different transport strategies based on size.

**Why it exists.** This is the single most consequential engineering decision in the project. A server that buffers uploads in memory has a hard concurrency ceiling; exceeding it kills the process and every unrelated request in flight.

**How the user interacts with it.** Identically for both paths — a file picker or a drag-and-drop, with a progress panel. The split is invisible.

**What happens technically.**

The client first asks the API for its limits (the thresholds are server-owned, so raising them requires no frontend change). Then:

**Path A — Multipart, for files at or below the threshold (default 50 MB)**

```
Browser ──multipart──► API (multer, in memory) ──► Supabase Storage ──► files row
```

`multer` with `memoryStorage` buffers the file, the API forwards it to storage, then inserts the metadata row. If the row insert fails, the API **deletes the blob it just wrote** — no orphan is left behind. The storage key is always `{userId}/{uuid}`, never the user's filename, which eliminates path traversal and collision concerns in one stroke.

**Path B — Direct-to-storage, for files above the threshold**

```
1. Browser ──► API: POST /api/files/upload-url   → signed URL + pending_uploads row
2. Browser ──────────────PUT bytes─────────────► Supabase Storage   (API not involved)
3. Browser ──► API: POST /api/files/complete     → verify, then files row
```

The bytes never touch the API, so its memory cost for a 2 GB file is identical to its cost for a 1 KB file. Step 3 is where correctness is enforced, and it is deliberately suspicious of the client:

- The storage key must begin with the caller's own user ID prefix.
- A matching row must exist in `pending_uploads` — the key must be one the server actually issued and that has not already been claimed.
- Folder access is re-checked, because the folder may have been deleted or unshared since step 1.
- **Size and MIME type are read back from storage**, not taken from the request body. A client therefore cannot understate how much quota it just consumed or misrepresent what it uploaded.

[SCREENSHOT: /*The upload progress panel showing several files uploading simultaneously with percentage bars*/]

[SCREENSHOT: /*The upload progress panel after completion, showing the "Uploads complete" state*/]

---

### 3.6 Drag-and-Drop Upload — Files and Folders

**What it does.** Accepts files *and entire folder trees* dropped onto the explorer, recreating the folder structure on the server.

**Why it exists.** Dragging a folder is how people actually move a project's worth of files. Supporting only loose files makes the feature feel broken.

**How the user interacts with it.** Dragging anything over the explorer reveals a full-area overlay. Releasing begins the upload; nested files appear in the progress panel with their relative paths.

**What happens technically.**

This is deceptively difficult, because `dataTransfer.files` **cannot see inside a directory** — it reports a dropped folder as a single zero-byte entry that no upload can use. The only way in is the File System Entry API, which has two failure modes that are both silent:

1. **`webkitGetAsEntry()` must be called synchronously.** The `DataTransfer` object is neutered the instant the drop handler returns, so entries must be captured before the first `await`.
2. **`readEntries()` returns at most 100 children per call** and signals completion with an empty batch. Calling it once truncates any larger folder without any error.

The traversal handles both, walks recursively with a depth cap of 32 (so a cyclic tree terminates rather than hanging the tab), and records every directory it sees — including empty ones, so they are recreated too.

On the upload side, folder paths are resolved to IDs before any file is sent, cached so that a hundred files in one folder create it exactly once. If a folder of that name already exists, the `409` is caught and the existing folder is **adopted** rather than treated as a failure.

The same normalisation handles `webkitRelativePath`, so a folder chosen through a file picker would work through the identical code path.

[SCREENSHOT: /*The drag-and-drop overlay visible mid-drag, showing "Drop files or folders to upload" and the target folder name*/]

[SCREENSHOT: /*The explorer immediately after dropping a folder, showing the new folder created alongside the upload progress panel listing nested paths like "MyFolder/nested/file.txt"*/]

---

### 3.7 File Preview and Download

**What it does.** Previews images and documents in a modal; downloads any file.

**What happens technically.** Blobs live in a **private** bucket — they are not publicly readable. Requesting a file returns a **time-limited signed URL** generated server-side after the authorization check passes. The URL grants temporary read access to that one object. This means a leaked URL expires on its own, and no permanent public link to any user's file ever exists.

[SCREENSHOT: /*The file preview modal displaying an image, with the file name and controls visible*/]

[SCREENSHOT: /*The item details drawer showing file metadata — size, type, created date, and thumbnail*/]

---

### 3.8 Sharing and Inherited Permissions

**What it does.** Shares a file or folder with another user as `viewer` (read-only) or `editor` (may modify and upload).

**Why it exists.** Storage without sharing is just a hard drive.

**How the user interacts with it.** A share modal takes an email address, resolves it to a user, and assigns a role. Existing shares are listed and can be revoked. Resources shared *with* the user appear under a "Shared with me" view.

**What happens technically.**

This is the most intricate logic in the backend. Every protected operation calls `getAccessRole(userId, resourceType, resourceId)`, which resolves in three stages:

1. **Ownership.** If `owner_id` matches, the role is `owner`. Done.
2. **Direct grant.** Look for a `shares` row naming this exact resource and this grantee.
3. **Inheritance.** Walk *up* the folder chain — collecting ancestor IDs, bounded at 50 levels to guarantee termination — then look for any share on any of those ancestors. If several are found, an `editor` grant beats a `viewer` grant.

Stage 3 is what makes sharing feel natural: granting access to a folder implicitly grants access to everything beneath it, at any depth, including files added later.

Sharing a file requires a user lookup by exact email address. That endpoint returns only `id`, `email`, and `name`, and only on an exact match — it will not perform partial matching, so it cannot be used to enumerate the user base.

[SCREENSHOT: /*The Share modal with an email entered, the role dropdown showing viewer/editor, and a list of existing shares below*/]

[SCREENSHOT: /*The "Shared with me" view listing files and folders another account has shared, with the sharer's name visible*/]

---

### 3.9 Trash, Restore, and Permanent Deletion

**What it does.** Deletion is a soft delete. Items move to a trash bin and can be restored, deleted permanently, or cleared all at once.

**Why it exists.** Accidental deletion is the most common destructive user error, and it should be recoverable.

**What happens technically.** Deleting sets `is_deleted = true`; nothing leaves the database and no blob is removed. The partial unique index means a trashed folder no longer blocks a new folder of the same name. Restoring flips the flag back. Permanent deletion removes the row *and* the underlying blob.

"Empty trash" is a single server-side sweep. An earlier design issued one request per item from the client, which could leave the trash half-emptied if any single request failed mid-loop; consolidating it into one endpoint made the operation atomic from the user's perspective.

[SCREENSHOT: /*The Trash view showing deleted files and folders with restore and permanent-delete actions, plus the "Empty Trash" button*/]

---

### 3.10 Search

**What it does.** Finds files and folders by name.

**What happens technically.** A case-insensitive `ILIKE` pattern match scoped to the caller's own resources and excluding trashed items. LIKE wildcards (`%` and `_`) in the user's query are escaped, so searching for a literal underscore behaves as expected rather than matching any character.

> **Current limitation:** results are capped at 50 per resource type with no pagination, so matches beyond the 50th are unreachable and the interface gives no indication that more exist. This is documented as a known issue in [§16 Future Improvements](#16-future-improvements).

[SCREENSHOT: /*The search results view showing matched files and folders for a typed query*/]

---

### 3.11 View Modes, Sorting, and Filtering

**What it does.** Switches between grid and list layouts, sorts by name/date/size in either direction, and filters by file category (documents, images, code, media, archives).

**What happens technically.** Sorting and category filtering are performed **client-side** over the complete result set, which is possible precisely because the API returns every item in a folder. This is a deliberate trade recorded here because it constrains a future change: introducing server-side pagination would require moving sorting to the server as well, since sorting one loaded page rather than the whole folder produces visibly wrong results.

[SCREENSHOT: /*The explorer in list/table view mode showing the columns for name, size, and date*/]

[SCREENSHOT: /*The toolbar with the sort dropdown expanded showing all sort options*/]

---

## 4. Tech Stack

### 4.1 Frontend

| Technology | Role and rationale |
| --- | --- |
| **React 19** | Component model and rendering. The interface is highly stateful — selections, modals, uploads, navigation — which suits a declarative component tree far better than imperative DOM manipulation. |
| **TypeScript** | Compile-time types shared between UI and API client. Because the API's response shapes are declared once in `types/storage.ts`, a change to a response shape becomes a compile error rather than a runtime `undefined`. |
| **Vite 6** | Build tool and dev server. Chosen for near-instant HMR and for its build-time environment variable inlining, which keeps the deployed bundle free of runtime configuration lookups. |
| **Tailwind CSS 4** | Utility-first styling. Keeps styles co-located with markup and makes a consistent dark theme achievable without maintaining a separate stylesheet architecture. |
| **lucide-react** | Icon set. Tree-shakeable, so only the icons actually used are bundled. |
| **motion** | Animation primitives for overlays and transitions. |

### 4.2 Backend

| Technology | Role and rationale |
| --- | --- |
| **Node.js (≥20)** | Runtime. Its non-blocking I/O model suits a workload that is almost entirely network-bound — database queries and object storage calls. |
| **Express 5** | HTTP framework. Minimal and unopinionated, which keeps the middleware chain explicit and auditable — important when middleware order is itself a security property. |
| **TypeScript** | Type safety across controllers, and `strict` mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled, which catches a class of null-handling bugs at compile time. |
| **Zod 4** | Runtime request validation. TypeScript types vanish at runtime; Zod is what actually guarantees an incoming body matches its expected shape, and it produces structured issue lists that the frontend renders directly. |
| **jsonwebtoken** | Signs and verifies the access and refresh tokens, with independent secrets for each. |
| **bcryptjs** | Password hashing at cost factor 10. Deliberately slow, which is the entire point — it makes offline brute-force attacks against a leaked hash impractical. |
| **multer 2** | Multipart parsing for the small-file upload path, configured with an enforced `fileSize` limit. |
| **cookie-parser** | Reads the `httpOnly` auth cookies off incoming requests. |
| **cors** | Origin allow-listing with wildcard-segment support, needed for local development and optional split deployments. |
| **google-auth-library** | Verifies Google ID tokens against Google's certificates with audience pinning. |
| **@supabase/supabase-js** | Single client for both PostgreSQL queries and object storage operations. |

### 4.3 Database and Storage

| Technology | Role and rationale |
| --- | --- |
| **PostgreSQL (via Supabase)** | Relational store for users, folders, files, shares, and pending uploads. Chosen because the data is inherently relational — folder hierarchies, ownership, and share grants are all foreign-key relationships — and because PostgreSQL's **partial indexes** directly express constraints like "names must be unique among *non-deleted* siblings". |
| **Supabase Storage** | Object storage for the file blobs, in a private bucket. Supports signed upload URLs and signed download URLs, which is precisely what both the direct-upload and the preview/download features require. |

### 4.4 Authentication and Authorization

| Technology | Role |
| --- | --- |
| **JWT (access + refresh)** | Stateless session tokens carried in `httpOnly` cookies. |
| **bcrypt** | Password hashing. |
| **Google Identity Services** | Browser-side identity, verified server-side. |
| **Custom `getAccessRole`** | Application-level authorization resolving owner / direct grant / inherited grant. |

### 4.5 Deployment and Hosting

| Technology | Role |
| --- | --- |
| **Render** | Single web service running the API, which also serves the compiled SPA. Chosen for direct Git integration and straightforward environment management. |
| **Supabase (hosted)** | Managed PostgreSQL and object storage. |
| **Vercel** | Supported as an optional alternative host for the frontend alone; retained in configuration but not the primary topology. |

### 4.6 Development Tools

| Tool | Role |
| --- | --- |
| **tsx** | Runs TypeScript directly in development with watch mode, removing a compile step from the inner loop. |
| **tsc** | Production compilation and type checking (`--noEmit` on the frontend). |
| **Git / GitHub** | Version control, feature branches, and pull-request review. |
| **npm** | Dependency management. `.npmrc` files with `include=dev` in both packages ensure build-only dependencies survive `NODE_ENV=production`, which otherwise makes npm omit them and breaks the build. |
| **Raw SQL migrations** | Ordered, reviewable schema changes in `api/infra/migrations/`. |

---

## 5. Frontend

### 5.1 Architecture

The frontend is a single-page application with a deliberately shallow component hierarchy and **two React contexts** carrying all shared state. There is no Redux, no Zustand, no external state library — the application's state divides cleanly into two concerns, and two contexts express that without ceremony.

```
App
└── AuthProvider              ← who is signed in; API mode; backend health
    └── AppContent
        ├── (loading)         ← session being established
        ├── AuthPage          ← not signed in
        └── StorageProvider   ← files, folders, uploads, trash, shares
            └── MainLayout
                ├── Sidebar
                ├── Header
                └── DragDropZone
                    └── FileExplorerView / SharedView / TrashView
```

The gate in `AppContent` is meaningful: `StorageProvider` is only mounted **after** a user exists. Every storage operation can therefore assume an authenticated user rather than defensively checking on each call.

### 5.2 Screens

The application has no URL router. Navigation is state-driven through `activeTab` (`files`, `shared`, `trash`, `settings`) and `currentFolderId`.

| Screen | Purpose |
| --- | --- |
| **Loading** | Shown while the initial session check is in flight |
| **AuthPage** | Sign in / register, including Google Sign-In |
| **FileExplorerView** | Primary browsing surface — folders and files in the current folder |
| **SharedView** | Resources other users have shared with the signed-in user |
| **TrashView** | Soft-deleted items with restore and permanent delete |

**Design decision — no router.** For a workspace-style application whose primary navigation is *within* a folder hierarchy rather than between distinct pages, a router adds a dependency and a URL-synchronisation problem without a proportional benefit. The honest trade-off is real and worth stating: the current folder is **not** reflected in the URL, so a folder cannot be bookmarked or shared as a link, and the browser Back button does not navigate up. This is recorded as a future improvement rather than presented as a design win.

### 5.3 State Management

**`AuthContext`** owns the identity layer: the current user and the loading flag during session bootstrap. On mount it calls `api.me()`; a `401` resolves to `null` and renders the sign-in screen.

**`StorageContext`** owns everything else: current folder ID, breadcrumbs, folder and file lists, view mode, sort configuration, category filter, selection, trash contents, shared-with-me data, upload tasks, upload limits, and the active modal targets. It exposes operations — `createFolder`, `uploadFiles`, `moveFile`, `emptyTrash` — that wrap the API client and refresh the relevant slice of state afterwards.

The refresh strategy is deliberately granular. After a plain file upload, only the file list is re-fetched, because nothing else can have changed. After an upload that created folders, the full folder content is re-fetched, because the tree changed too. This avoids a blanket "reload everything" on every mutation.

### 5.4 API Integration

All server communication goes through a single `ApiClient` class, which centralises four concerns that would otherwise be duplicated across dozens of call sites:

**1. Base URL.** A single exported constant, `API_BASE_URL`. There is one backend and no runtime switching, so the address is a constant rather than build-time configuration — which removes an entire class of "the deployed bundle is pointing at the wrong API" failures. Because the app is served from that same origin in production, requests remain same-origin and the auth cookies stay first-party.

**2. Credentials.** Every request sets `credentials: 'include'` so the `httpOnly` cookies travel with it.

**3. Automatic refresh.** A `401` from any non-auth endpoint triggers a refresh and a single retry, de-duplicated behind a shared promise as described in §3.3.

**4. Error normalisation.** The API returns a consistent envelope: `{ error: { code, message, issues? } }`. A helper extracts the most specific available message — a Zod issue list, then a message, then a code, then a status fallback — so the UI always has something meaningful to display.

**Upload progress requires a different transport.** `fetch()` cannot report upload progress, so anything sending a file body goes through `XMLHttpRequest` instead, which exposes `upload.onprogress`. The XHR path re-implements the refresh-on-`401` retry, because it does not share the `fetch` wrapper's interception. When uploading directly to Supabase, `withCredentials` is explicitly **false** — that is a different origin entirely, and the session cookies must never be sent there.

### 5.5 UI/UX Decisions

- **Dark theme throughout**, appropriate for a tool users keep open for long periods.
- **Grid and list view modes**, because thumbnails matter for images and density matters for documents.
- **Optimistic navigation** — the breadcrumb and folder title update immediately while content loads.
- **The upload panel is non-blocking** — it docks in a corner so browsing continues during a large upload.
- **Errors are surfaced in place**, not in alert dialogs.
- **Failures are itemised.** Uploading twenty files where three fail marks exactly those three, keeps the seventeen successes, and reports which failed and why — rather than failing the batch.

### 5.6 Responsive Design

Layout is built with Tailwind's responsive utilities: the sidebar collapses on narrow viewports, the grid reflows its column count, and the toolbar wraps. Modals are width-constrained with internal scrolling so they remain usable on short screens.

[SCREENSHOT: /*The application on a mobile-width viewport, showing the collapsed sidebar and reflowed file grid*/]

### 5.7 Forms and Validation

Validation is layered rather than duplicated. The client performs lightweight checks — required fields, obvious format errors — for immediate feedback, but the **server is the authority**. Zod issues returned from the API are formatted into readable strings with their field paths, so a server-side rejection produces a message as specific as a client-side one. This avoids the common failure mode where client and server validation rules drift apart.

### 5.8 Authentication Flow (Frontend)

```
App mounts
   └─► AuthContext calls api.me()
         ├─ 200 → user set → StorageProvider mounts → explorer renders
         └─ 401 → refresh attempted
                    ├─ success → original request retried
                    └─ failure → user = null → AuthPage renders
```

A note on expected console output: on a genuinely signed-out visit, this sequence produces a `401` on `/api/auth/me` followed by a `401` on `/api/auth/refresh`. Both are **normal** — the application is asking "who am I?", finding no session, and rendering the sign-in screen. They only indicate a problem if they persist *after* a successful login.

### 5.9 Error Handling

Errors are caught at the layer that can act on them. The API client converts non-2xx responses into `Error` objects with extracted messages. `StorageContext` catches those and writes to its `error` state. Components render that state inline. Upload failures are tracked per-task so one bad file does not obscure nineteen good ones. The Google Sign-In button distinguishes "script failed to load" from "not configured" and shows a different, actionable message for each.

### 5.10 Reusable Components

| Component | Responsibility |
| --- | --- |
| `FileCard` / `FileRow` | One file in grid or list form |
| `FolderCard` / `FolderRow` | One folder in grid or list form |
| `FileIcon` | Maps MIME type to an icon and colour |
| `Breadcrumbs` | Ancestor navigation |
| `DragDropZone` | Wraps the explorer, handles drag state and entry traversal |
| `UploadProgressPanel` | Live per-file progress |
| `FilePreviewModal` | In-app preview |
| `ItemDetailsDrawer` | Metadata side panel |
| `ShareModal` / `MoveModal` / `RenameModal` / `NewFolderModal` | Focused single-purpose dialogs |
| `GoogleSignInButton` | GSI script loading and button rendering |

---

## 6. Backend

### 6.1 Architecture

The backend follows a conventional layered structure, with each layer having exactly one reason to change:

```
Request
  ↓
Middleware      trust proxy → CORS → JSON parsing → cookie parsing
  ↓
Router          maps method + path to a controller
  ↓
requireAuth     verifies the access token, attaches req.userId
  ↓
Controller      validates (Zod) → authorizes (getAccessRole) → acts
  ↓
lib/            supabase, tokens, cookies, google, access
  ↓
Supabase        PostgreSQL + Object Storage
  ↓
Response        JSON, or a consistent error envelope
```

### 6.2 Middleware Order

Middleware order is a correctness property, not a stylistic choice:

1. **`trust proxy`** — Render terminates TLS in front of the app. Without this, Express sees every request as plain HTTP and `Secure` cookie logic misbehaves.
2. **CORS** — must run before routes so preflight requests are answered without reaching them.
3. **`express.json()`** — populates `req.body`.
4. **`cookie-parser`** — populates `req.cookies`, required by `requireAuth`.
5. **Routes** — all `/api/*` handlers.
6. **Static SPA + fallback** — after the API, so it can never shadow a route.
7. **404 handler** — a JSON envelope for unmatched `/api/*` paths.
8. **Error handler** — last, catching everything above.

The SPA fallback explicitly excludes paths beginning with `/api/`. Without that guard, a typo'd API endpoint would return `index.html` with status `200`, and the client would try to parse HTML as JSON — a confusing failure that is easy to create and hard to diagnose.

### 6.3 CORS Origin Matching

The allow-list supports `*` as a wildcard *segment* (for example `https://*.vercel.app`). Matching is implemented by walking literal segments in order rather than by constructing a regular expression — deliberately, because converting a hostname pattern into a regex makes `.` mean "any character", which would let `https://evil-vercel.app` match a pattern intended for `https://*.vercel.app`.

A rejected origin is denied by responding **without** CORS headers rather than by throwing. The browser blocks the request, which is the correct outcome, instead of the server returning a `500`.

Because credentials are involved, a literal `*` is never sent — the caller's exact origin is echoed back, which the specification requires.

### 6.4 Endpoints

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | Status and upload limits |
| `POST` | `/api/auth/register` | — | Create account |
| `POST` | `/api/auth/login` | — | Password sign-in |
| `POST` | `/api/auth/google` | — | Google ID token sign-in |
| `POST` | `/api/auth/refresh` | refresh cookie | Rotate token pair |
| `POST` | `/api/auth/logout` | — | Clear cookies |
| `GET` | `/api/auth/me` | ✓ | Current user |
| `POST` | `/api/folders` | ✓ | Create folder |
| `GET` | `/api/folders/root` | ✓ | Root contents |
| `GET` | `/api/folders/:id` | ✓ | Folder contents |
| `GET` | `/api/folders/:id/path` | ✓ | Ancestor chain |
| `PATCH` | `/api/folders/:id` | ✓ | Rename / move |
| `DELETE` | `/api/folders/:id` | ✓ | Soft delete |
| `PATCH` | `/api/folders/:id/restore` | ✓ | Restore |
| `DELETE` | `/api/folders/:id/permanent` | ✓ | Hard delete |
| `GET` | `/api/folders/trash` | ✓ | Trash contents |
| `DELETE` | `/api/folders/trash` | ✓ | Empty trash |
| `POST` | `/api/files/upload` | ✓ | Multipart upload |
| `POST` | `/api/files/upload-url` | ✓ | Signed URL for direct upload |
| `POST` | `/api/files/complete` | ✓ | Register a direct upload |
| `GET` | `/api/files` | ✓ | List files in a folder |
| `GET` | `/api/files/:id` | ✓ | Metadata + signed download URL |
| `PATCH` | `/api/files/:id` | ✓ | Rename / move |
| `DELETE` | `/api/files/:id` | ✓ | Soft delete |
| `PATCH` | `/api/files/:id/restore` | ✓ | Restore |
| `DELETE` | `/api/files/:id/permanent` | ✓ | Hard delete |
| `GET` | `/api/search?q=` | ✓ | Search by name |
| `POST` | `/api/shares` | ✓ | Grant access |
| `GET` | `/api/shares/:type/:id` | ✓ | List grants |
| `GET` | `/api/shares/shared-with-me` | ✓ | Inbound shares |
| `DELETE` | `/api/shares/:id` | ✓ | Revoke |
| `GET` | `/api/users/lookup?email=` | ✓ | Exact-match user lookup |

**Route ordering note.** Literal paths are registered before parameterised ones — `/folders/trash` must precede `/folders/:id`, or Express would interpret `trash` as an ID.

[SCREENSHOT: /*A REST client (Postman/Thunder Client/curl) showing a request to an endpoint and its JSON response, demonstrating the API contract*/]

### 6.5 Authorization — The Central Design Decision

The API connects to Supabase using the **service role key**, which bypasses PostgreSQL Row Level Security entirely. RLS is enabled on the tables, but the service role is not subject to it.

This has one overriding consequence, and it is stated explicitly in the source comments: **the application-level check is the only thing preventing cross-user data access.** There is no database safety net. Every controller that touches a user-owned resource must call `getAccessRole` before acting.

The trade-off was accepted for a specific reason: the inherited-permission model — where a grant on a folder cascades to arbitrarily deep descendants — is difficult to express as an RLS policy but straightforward as an explicit ancestor walk in application code. Choosing service-role access made the sharing model tractable, at the cost of requiring discipline in every controller.

`getAccessRole` returns `owner`, `editor`, `viewer`, or `null`, and callers gate on it. Operations that mutate require `owner` or `editor`; reads accept any non-null role. A resource the caller cannot see returns `404`, not `403` — so the API does not confirm the existence of resources belonging to other users.

### 6.6 Validation

Every request body is parsed with a Zod schema before any business logic runs. Notable cases:

- **Multipart text fields arrive as strings.** An empty form field is `""`, not `undefined`, so `folderId` is normalised (`""` and `"null"` → `null`) before Zod sees it.
- **`completeUploadSchema` deliberately does not accept size or MIME type.** Both are read back from storage instead. The comment in the source is blunt about the reasoning: the client has no reason to be believed here.
- **`createUploadUrlSchema` accepts an optional declared size**, checked against the configured maximum so an oversized file is rejected *before* the browser spends minutes uploading bytes that storage would refuse anyway.

### 6.7 Error Handling

All errors return a consistent envelope:

```json
{ "error": { "code": "FOLDER_NOT_FOUND", "message": "Folder not found" } }
```

Validation failures additionally carry an `issues` array from Zod. Machine-readable `code` values let the client branch on failure type without string matching. A dedicated error handler catches `MulterError` — notably `LIMIT_FILE_SIZE` — and converts it into the same envelope rather than an unhandled stack trace.

Database errors are inspected rather than blindly propagated: `23505` (unique violation) becomes a `409` with a meaningful message; anything unexpected is logged server-side and returned as a generic `500`, so internal details never reach the client.

### 6.8 Configuration and Startup

Environment loading is strict and fails fast. Missing required variables are **collected** rather than thrown one at a time, so a misconfigured deployment reports every gap in a single log line instead of forcing one redeploy per variable.

Values are parsed, not merely read: durations like `15m` and `7d` are converted into both the raw string (for `jsonwebtoken`) and a millisecond value (for cookie `maxAge`), so the two can never drift apart. Numeric variables reject non-positive and non-integer values. Origins have trailing slashes stripped, because a pasted dashboard value ending in `/` would otherwise never match a real browser `Origin` header.

The boot log states what was actually resolved:

```
[api] listening on port 10000 (production)
[api] web bundle: serving /opt/render/project/src/web/dist
[api] allowed origins: https://…
[api] google sign-in: enabled (…apps.googleusercontent.com)
```

Each line was added to make a specific class of misconfiguration visible in one glance rather than requiring reproduction.

[SCREENSHOT: /*The Render deployment logs showing a successful boot with all four diagnostic lines visible*/]

---

## 7. Database

### 7.1 Technology

PostgreSQL, hosted by Supabase, accessed through `@supabase/supabase-js` using the service role key. Schema changes are managed as **ordered, hand-written SQL migrations** in `api/infra/migrations/`, applied in filename order. Each migration is small and single-purpose, which makes the schema's history reviewable.

### 7.2 Schema

**`users`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated |
| `email` | `text` | Unique, not null |
| `password_hash` | `text` | **Nullable** — Google-only accounts have none |
| `name` | `text` | |
| `image_url` | `text` | Google avatar |
| `google_id` | `text` | Google's `sub`; unique among non-null values |
| `created_at` | `timestamptz` | |

**`folders`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `name` | `text` | Not null |
| `owner_id` | `uuid` | → `users(id)`, cascade delete |
| `parent_id` | `uuid` | → `folders(id)`, cascade delete; `NULL` = root |
| `is_deleted` | `boolean` | Soft delete flag |
| `created_at` / `updated_at` | `timestamptz` | |

**`files`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `name` | `text` | Not null |
| `mime_type` | `text` | Read back from storage |
| `size_bytes` | `bigint` | Read back from storage |
| `storage_key` | `text` | Unique — the object store path |
| `owner_id` | `uuid` | → `users(id)`, cascade |
| `folder_id` | `uuid` | → `folders(id)`, cascade; `NULL` = root |
| `checksum` | `text` | Reserved; not currently populated |
| `is_deleted` | `boolean` | Soft delete flag |
| `created_at` / `updated_at` | `timestamptz` | |

**`shares`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key |
| `resource_type` | `text` | `CHECK IN ('file','folder')` |
| `resource_id` | `uuid` | Polymorphic — no FK |
| `grantee_user_id` | `uuid` | → `users(id)`, cascade |
| `role` | `text` | `CHECK IN ('viewer','editor')` |
| `created_by` | `uuid` | → `users(id)`, set null on delete |
| `created_at` | `timestamptz` | |

**`pending_uploads`**

| Column | Type | Notes |
| --- | --- | --- |
| `storage_key` | `text` | Primary key |
| `owner_id` | `uuid` | → `users(id)`, cascade |
| `folder_id` | `uuid` | → `folders(id)`, cascade |
| `created_at` | `timestamptz` | |

### 7.3 Relationships

```
users ──1:N──► folders ──self-referencing──► folders
  │               │
  │               └──1:N──► files
  ├──1:N──► files
  ├──1:N──► shares (as grantee)
  └──1:N──► pending_uploads
```

`shares` is intentionally **polymorphic**: `resource_id` may reference either a file or a folder, discriminated by `resource_type`. This avoids two near-identical tables at the cost of losing foreign-key enforcement on that column — a trade made consciously, with the `CHECK` constraint on `resource_type` preserving the part that matters most.

### 7.4 Indexing and Constraints

| Index / constraint | Purpose |
| --- | --- |
| `folders_unique_name_per_parent` on `(owner_id, parent_id, name) WHERE is_deleted = false` | **Partial unique index.** Prevents duplicate sibling names while allowing a trashed folder to share a name with a live one. |
| `users_google_id_key` on `google_id WHERE google_id IS NOT NULL` | Partial unique index — one account per Google identity, while password accounts (all `NULL`) do not collide. |
| `files_owner_id_idx`, `files_folder_id_idx` | Support the two dominant query patterns: "all files I own" and "files in this folder". |
| `shares_resource_idx`, `shares_grantee_idx` | Support both directions of the sharing question — "who can see this?" and "what can I see?" — both of which run on nearly every authorization check. |
| `files.storage_key` unique | Guarantees one row per stored object. |

The partial indexes are the most interesting design element here: they encode a business rule ("uniqueness applies only among live items") directly in the schema, where it cannot be bypassed by a code path that forgets to check.

### 7.5 Data Lifecycle

| Operation | Mechanism |
| --- | --- |
| **Create** | Insert after validation and authorization; storage keys are server-generated UUIDs |
| **Read** | Scoped by `owner_id` or by a resolved share; `is_deleted = false` filtered |
| **Update** | Targeted column updates after re-authorization |
| **Soft delete** | `is_deleted = true`; row and blob both retained |
| **Restore** | `is_deleted = false` |
| **Hard delete** | Row removed **and** blob removed from object storage |

### 7.6 Consistency Between Database and Object Storage

The database and the object store are two separate systems with no shared transaction, so the code compensates explicitly:

- **Multipart path:** blob is written first. If the metadata insert then fails, the blob is deleted — no orphan.
- **Direct path:** the blob is written by the browser before the API knows it exists. `pending_uploads` is the ledger of keys the server has issued; a row is consumed on successful completion. If the metadata insert fails at completion, both the blob and the pending row are removed.

> **Known gap:** if a client obtains a signed URL, uploads, and then never calls `complete` — a closed tab, a dropped connection — the `pending_uploads` row and its blob remain indefinitely. The migration that introduced the table anticipates a sweeper to reclaim these; **that sweeper is not implemented.** See [§16](#16-future-improvements).

[SCREENSHOT: /*An entity-relationship diagram of the five tables and their relationships*/]

[SCREENSHOT: /*The Supabase table editor showing the files table with real rows*/]

---

## 8. APIs and Integrations

### 8.1 Supabase — PostgreSQL

**What it does.** Primary data store for all metadata.

**Why it is needed.** Managed PostgreSQL removes operational burden while providing the relational features the data model genuinely requires — foreign keys, cascade deletes, check constraints, and partial indexes.

**Integration.** A single client instance is created at startup and reused, configured with `persistSession: false` and `autoRefreshToken: false` because the API is a stateless server, not a browser session.

**Security.** The service role key bypasses RLS and is therefore a highly privileged credential. It exists only in the API's server-side environment, is never exposed to any `VITE_*` variable, and never reaches the browser.

### 8.2 Supabase — Object Storage

**What it does.** Stores the file blobs in a private bucket.

**Request/response flow.**

- *Downloads and previews:* the API generates a **time-limited signed URL** after authorizing the request. No permanent public URL to any user's file exists.
- *Direct uploads:* the API generates a **signed upload URL** scoped to one specific object key, which the browser uses to `PUT` bytes straight to storage.

**Security considerations.** Storage keys are always `{userId}/{uuid}` — never derived from the user-supplied filename — which removes path traversal, collision, and filename-injection concerns simultaneously. Signed URLs expire. The completion endpoint verifies the key prefix belongs to the caller before accepting it.

> **Operational note.** Supabase enforces its own upload size ceiling at both the project and bucket level, independent of this application's configured limits. On the free tier that ceiling is 50 MB and cannot be raised, which means the direct-upload path — designed for multi-gigabyte files — is constrained by the plan rather than by the code.

### 8.3 Google Identity Services

**What it does.** Provides third-party sign-in.

**Why it is needed.** Reduces sign-up friction and supplies a verified email address without this project handling another password.

**Request/response flow.**

```
Browser ──► Google: user approves
Google  ──► Browser: signed ID token (JWT)
Browser ──► API: POST /api/auth/google { credential }
API     ──► Google certs: verify signature, audience, expiry
API     ──► Database: match on sub → link by email → or create
API     ──► Browser: Set-Cookie (access + refresh) + user
```

**Integration details.** The GSI script is loaded once and shared by every caller through a cached promise; a load failure clears the cache so a later mount can retry rather than being permanently stuck.

**Security considerations.**

- The **audience is pinned** to the configured client ID, so a token issued for another application cannot be replayed here.
- `email_verified` must be affirmatively `true` — a missing claim is not accepted.
- Users are matched on the immutable `sub`, not the mutable email.
- **No client secret exists in this flow**, because there is no authorization-code exchange. The client ID is public by design.
- The deployment origin must be registered under the OAuth client's *Authorized JavaScript origins*, or Google refuses to render the button. This is a required configuration step whenever the serving origin changes.

### 8.4 Internal REST API

The application's own API is documented in [§6.4](#64-endpoints). Its contract is consistent throughout: JSON in, JSON out, cookie authentication, and a uniform error envelope with machine-readable codes.

---

## 9. Complete System Workflow

### 9.1 First Visit and Session Bootstrap

```
1. Browser requests /                → Express serves index.html from web/dist
2. SPA boots, AuthContext mounts
3. GET /api/auth/me                  → 401 (no cookie yet)
4. Client auto-attempts refresh      → 401 (no refresh cookie either)
5. user = null                       → AuthPage renders
```

Both `401`s are expected on a signed-out visit.

### 9.2 Registration

```
User fills form
  → POST /api/auth/register
      → Zod validates name/email/password
      → email lowercased and trimmed
      → bcrypt hashes password (cost 10)
      → INSERT users              (23505 → 409 EMAIL_ALREADY_IN_USE)
      → sign access + refresh JWTs
      → Set-Cookie ×2 (httpOnly, Secure, SameSite=None in prod)
      → 201 { user }
  → AuthContext sets user → StorageProvider mounts → explorer loads
```

### 9.3 Google Sign-In

```
User clicks the Google button
  → GSI returns a signed ID token
  → POST /api/auth/google { credential }
      → verify signature against Google certs, audience pinned
      → reject unless email_verified === true
      → match on sub → else link by email → else create
      → Set-Cookie ×2
      → 200/201 { user }
  → explorer loads
```

### 9.4 Browsing a Folder

```
User double-clicks a folder
  → StorageContext sets currentFolderId
  → GET /api/folders/:id
      → requireAuth verifies access token
      → getAccessRole → owner | direct share | inherited share | null
      → null → 404 (existence is not confirmed)
      → SELECT child folders and files where is_deleted = false
      → 200 { folder, children, role }
  → GET /api/folders/:id/path → breadcrumbs
  → grid re-renders; sorting and filtering applied client-side
```

### 9.5 Small File Upload (≤ threshold)

```
User selects or drops a file
  → GET /api/health → limits
  → size ≤ maxFileSizeBytes → multipart path
  → XHR POST /api/files/upload   (progress events drive the panel)
      → multer buffers the file in memory
      → Zod validates folderId
      → getAccessRole on the target folder → owner/editor required
      → storageKey = {userId}/{uuid}
      → upload blob to Supabase Storage
      → INSERT files row  (on failure → delete the blob, no orphan)
      → 201 { file }
  → file list refreshed
```

### 9.6 Large File Upload (> threshold)

```
  → POST /api/files/upload-url { folderId, sizeBytes }
      → authorize folder; reject if sizeBytes exceeds the maximum
      → generate storageKey and a signed upload URL
      → INSERT pending_uploads
      → 200 { storageKey, signedUrl }

  → XHR PUT signedUrl  (withCredentials = false — different origin)
      → bytes go browser → Supabase Storage; the API is not involved

  → POST /api/files/complete { storageKey, name, folderId }
      → storageKey must start with {userId}/
      → a matching, unclaimed pending_uploads row must exist
      → re-authorize the folder
      → storage.info() → read back real size and MIME
      → INSERT files row  (on failure → delete blob and pending row)
      → DELETE pending_uploads row
      → 201 { file }
```

### 9.7 Folder Drag-and-Drop

```
User drops a folder
  → DragDropZone reads dataTransfer.items SYNCHRONOUSLY
      → webkitGetAsEntry() per item  (DataTransfer dies after the handler)
  → recursive walk
      → readEntries() looped until an empty batch  (100-per-call limit)
      → depth capped at 32
      → collects { file, path[] } plus every directory seen
  → uploadFiles(entries, dirs)
      → ensureFolder(path) for each unique path, cached
          → POST /api/folders   (409 → adopt the existing folder)
      → per file: upload into its resolved folder ID
  → full folder refresh, because the tree changed
```

### 9.8 Sharing

```
Owner opens the Share modal, enters an email
  → GET /api/users/lookup?email=...   → exact match only
  → POST /api/shares { resourceType, resourceId, granteeUserId, role }
      → caller must be the owner
      → INSERT shares  (unique(type, id, grantee) prevents duplicates)
      → 201 { share }

Grantee later signs in
  → GET /api/shares/shared-with-me → inbound grants
  → opening any descendant runs getAccessRole
      → not owner, no direct grant
      → walk ancestors (≤50), find the shared folder
      → editor beats viewer → role returned → access allowed
```

### 9.9 Delete and Restore

```
Delete    → is_deleted = true            (row and blob both retained)
Trash     → GET /api/folders/trash
Restore   → is_deleted = false
Permanent → DELETE row + DELETE blob
Empty     → one server-side sweep, not a client loop
```

---

## 10. Use Cases

### 10.1 Primary Users

| User | Problem they face | How the project helps |
| --- | --- | --- |
| **Individual storing personal files** | Files scattered across devices; no organised remote copy | Nested folders, search, trash recovery, access from any browser |
| **Small team sharing documents** | Emailing attachments creates version confusion | Share a folder once; everything inside is visible, including files added later |
| **Developer studying full-stack systems** | Tutorials skip the hard parts | A complete, readable implementation of auth, permissions, and large-file handling |

### 10.2 Real-World Scenarios

**A designer sharing assets with a client.** The designer creates `Client Project`, uploads mockups, and shares the folder as `viewer`. The client sees everything and can download but cannot alter anything. Files added next week appear automatically — no re-sharing, because permission is resolved by ancestor walk at access time rather than copied to each file at share time.

**A two-person team collaborating.** A shared folder granted at `editor` lets both upload into it, rename items, and create subfolders — while everything outside that folder stays private. The permission boundary is the folder, which matches how people naturally think about it.

**Recovering from a mistake.** A user deletes the wrong folder. Because deletion is soft, the folder and every file in it sit in the trash. Restoring flips one flag. Notably, they can also create a *new* folder with the same name in the meantime, because the uniqueness index only applies to non-deleted rows.

**Uploading a large video.** A 300 MB file automatically takes the direct path. The browser uploads straight to object storage while the API stays idle. The server's memory usage is identical to uploading a text file — the difference is invisible to the user and decisive for the server.

### 10.3 Organisations That Could Benefit

- **Small design or media studios** — client-facing asset delivery with read-only sharing
- **Educational institutions** — distributing course materials to a cohort via one shared folder
- **Small businesses** — internal document storage without a per-seat SaaS subscription
- **Development teams** — as a reference implementation or a base to extend

### 10.4 Extension Paths

The architecture supports several directions without redesign: a mobile client against the same REST API; an internal document store deployed on private infrastructure; a domain-specific system (patient records, legal case files) built on the existing permission model; or the addition of processing steps — thumbnailing, virus scanning, OCR — on the multipart upload path, where the API already has the bytes in hand.

---

## 11. Challenges Faced

### 11.1 Cross-Site Cookies Silently Breaking Authentication

**The problem.** With the frontend on Vercel and the API on Render, login returned `200`, and the very next request returned `401`. Server logs showed nothing wrong.

**Why it was difficult.** The failure is invisible on the server. The cookie was set correctly, CORS was correct, and the token was valid — the *browser* was discarding the cookie before it was ever sent back. It also reproduced inconsistently: fine in one browser, broken in another, depending on privacy settings.

**How it was solved.** The root cause is that `vercel.app` and `onrender.com` are on the **Public Suffix List**, so the frontend and API were different *sites*, making the auth cookie third-party — exactly what Safari, Brave, and blocker extensions discard.

The important realisation was that moving both halves to Render would **not** fix it, since two Render services are also two different sites by the same rule. The fix was to serve the compiled SPA from the API process itself, making every request same-origin and the cookies first-party.

**What was learned.** Browsers determine "same site" by registrable domain, not hostname. The Public Suffix List is what defines that boundary. Deployment topology is not an operational afterthought — it directly determines whether a cookie-based authentication model works at all.

### 11.2 Diagnosing a `500` on Google Sign-In

**The problem.** Google sign-in returned `500 INTERNAL_ERROR` after the token verified successfully.

**Why it was difficult.** The `500` was generic by design — internal errors are not leaked to clients — so the response gave no clue. Everything in the authentication logic was correct.

**How it was solved.** Working backwards from *where* a `500` could originate narrowed it to the database write. A read-only schema probe through the application's own client showed `column users.google_id does not exist` (PostgreSQL `42703`). Two migrations — `003_google_oauth` and `004_direct_uploads` — had never been applied to the hosted database. The code was correct; the schema was behind it.

**What was learned.** Code and schema are two deployables, and they drift independently. A `500` immediately after a successful external verification is a strong signal to look at the persistence layer. Probing the real schema is faster than re-reading correct code.

### 11.3 Reading Dropped Folders

**The problem.** Dropping a folder produced either nothing or a failed zero-byte upload.

**Why it was difficult.** `dataTransfer.files` cannot see inside a directory. The File System Entry API that can is non-standard and has two failure modes that produce **no error at all**: the `DataTransfer` is neutered as soon as the drop handler returns (so any `await` before reading entries loses everything), and `readEntries()` returns at most 100 children per call, silently truncating larger folders.

**How it was solved.** Entries are captured synchronously before the first `await`; `readEntries()` is looped until it returns an empty batch; recursion is depth-capped so a cyclic tree terminates. Directories are recorded separately so empty ones are recreated too. A fallback to the flat file list covers browsers without the API.

**Verification.** A test harness simulated the real reader's batching behaviour — including a 250-child folder and a self-referencing directory — and confirmed correct paths, complete enumeration, and termination. A synthetic drop in a real browser then confirmed the full path end to end: a nested tree with an empty folder was recreated exactly.

**What was learned.** Browser APIs with silent failure modes need tests that reproduce their *constraints*, not just their happy path. A single `readEntries()` call works perfectly for 99 files and loses data at 101.

### 11.4 Designing Uploads That Do Not Kill the Server

**The problem.** Buffering uploads in memory is simple and does not scale. `multer` with `memoryStorage` holds the entire file as a Buffer, and the Supabase client copies it again — roughly **twice the file size per in-flight upload**. On a 512 MB instance with a 50 MB limit, roughly four concurrent uploads exhaust available memory, and the process is OOM-killed along with every unrelated request.

**Why it was difficult.** It is not a gradual slowdown that monitoring catches early — it is a cliff. Everything is fine until the process dies.

**How it was solved.** A second path where the bytes never reach the API. The client requests a signed URL, uploads directly to storage, then calls a completion endpoint. The threshold is server-declared, so it can be tuned without a frontend release.

The direct path introduced a new problem — a blob can exist with no database row if the client disappears mid-upload — which the `pending_uploads` ledger tracks.

**What was learned.** "It works" and "it works under concurrency" are different claims. The correct architecture for large files is to keep them out of the application server entirely. Every such optimisation has a cost, and here it is a consistency gap that must be tracked explicitly rather than assumed away.

### 11.5 Permissions That Inherit Through a Hierarchy

**The problem.** A grant on a folder must apply to everything inside it, at any depth, including items created later.

**Why it was difficult.** The naive approach — copying grants onto every descendant at share time — breaks immediately for files added afterwards and creates a combinatorial mess on move operations.

**How it was solved.** Permission is resolved at **access** time by walking up the ancestor chain, bounded at 50 levels. Ownership short-circuits, then a direct grant, then inherited grants. When multiple ancestors grant access, `editor` wins over `viewer`.

**What was learned.** Resolving relationships at read time rather than materialising them at write time trades a little query cost for a great deal of correctness — new files inherit automatically, and moves need no permission bookkeeping. The bound on traversal depth is what makes the recursion safe against malformed data.

### 11.6 Build-Time Configuration and an Ambiguous Empty String

**The problem.** After moving to the single-origin deployment, the client needed to call "whatever origin served this page" — an empty base URL. But the existing code used `||` to apply a localhost fallback, and `""` is falsy, so the intentional empty string collapsed into `http://localhost:8080`.

**How it was solved.** Switching to `??` so only `undefined` triggers the fallback, and documenting that an empty value is meaningful rather than missing.

**What was learned.** Vite inlines `VITE_*` variables at build time, so configuration changes require a rebuild, not a restart. And `||` versus `??` is not stylistic when an empty string is a legitimate value.

### 11.7 Serving a SPA and an API from One Express App

**The problem.** Adding static file serving risked shadowing API routes, and the existing catch-all `404` would have intercepted client-side deep links.

**How it was solved.** Ordering: API routes first, then static files, then a fallback that returns `index.html` only for `GET`/`HEAD` requests whose path does **not** begin with `/api/`, then the JSON `404`, then the error handler. The health endpoint moved to `/api/health` so the SPA could own `/`. The whole block is conditional on a build being present, so an API-only deployment behaves exactly as before.

**What was learned.** In Express, middleware order *is* the routing logic. Without the `/api/` guard, a mistyped endpoint would return HTML with status `200` and fail confusingly inside the client's JSON parser.

---

## 12. Skills Learned

### 12.1 Backend Development

Building the API established a working understanding of layered server architecture — routes, middleware, controllers, and libraries as distinct responsibilities — and, more importantly, of **why middleware order is a correctness property**. `cookie-parser` must precede the auth guard; CORS must precede routes; the error handler must be last; the SPA fallback must not shadow the API.

Designing a consistent error contract — `{ error: { code, message, issues? } }` — taught the value of machine-readable failure codes over prose, and the discipline of translating database errors (`23505` → `409`) rather than letting internals leak.

### 12.2 Authentication and Session Design

This was the deepest area of learning:

- **Why `httpOnly` cookies beat `localStorage`** for tokens — inaccessible to scripts.
- **Why access and refresh tokens have different lifetimes**, and why the refresh cookie is path-scoped so it is transmitted only to the one endpoint that consumes it.
- **Why clearing a cookie requires repeating its original attributes**, or the browser ignores the instruction.
- **Why `SameSite` and `Secure` depend on deployment topology**, and how the Public Suffix List defines "same site".
- **How to de-duplicate concurrent refreshes** behind a single shared promise, so six simultaneous `401`s produce one refresh rather than six.
- **Why identical error messages for "no such user" and "wrong password"** prevent account enumeration.

### 12.3 OAuth and Third-Party Identity

Working with Google Identity Services clarified a distinction that is easy to blur: an **ID token flow** verifies a signature and needs no client secret, whereas an **authorization-code flow** exchanges a code and does. Recognising that the configured `GOOGLE_CLIENT_SECRET` was never read — and removing it — came from understanding which flow was actually in use.

Equally important were the security specifics: pinning the audience so tokens from other applications are rejected; matching users on the immutable `sub` rather than a reassignable email; and requiring `email_verified === true` rather than merely "not false", because that claim is what protects the account-linking branch from takeover.

### 12.4 Database Design

- **Adjacency lists** for hierarchies, and the ancestor-walk traversal they require.
- **Partial indexes** as a way to encode business rules in the schema — uniqueness that applies only to non-deleted rows is both more correct and impossible to bypass from application code.
- **Soft deletes**, and their downstream effect on every query and every uniqueness rule.
- **Polymorphic associations** (`shares.resource_id`), and the deliberate trade of foreign-key enforcement for schema simplicity.
- **Index design driven by query patterns** — `shares` is indexed in both directions because authorization asks the question both ways.
- **Migrations as an ordered, reviewable history**, and the operational reality that schema drift causes production failures that look like code bugs.

### 12.5 File Handling and Storage

Understanding that server memory — not disk or bandwidth — is the binding constraint on upload capacity, and being able to compute the concurrency ceiling from instance RAM and file size, changed how the feature was designed. Signed URLs, private buckets, server-generated storage keys, and reading metadata back from storage rather than trusting the client are all techniques learned here.

The two-phase direct upload also taught a general lesson about **distributed consistency**: two systems without a shared transaction require an explicit reconciliation mechanism, and being honest about the remaining gap (the missing sweeper) is part of the design rather than an admission of failure.

### 12.6 Frontend Development

React Context as a deliberate choice rather than a default; splitting state along the seam where it naturally divides; gating one provider behind another so downstream code can assume an authenticated user. Centralising HTTP concerns in a single client class kept refresh logic, error normalisation, and credential handling in one auditable place.

Knowing when the platform forces your hand also mattered — `fetch` cannot report upload progress, so the file paths use `XMLHttpRequest`, and that decision cascades into re-implementing refresh-on-`401` for that transport.

### 12.7 Browser APIs and Their Failure Modes

The File System Entry API taught more about defensive frontend engineering than any well-behaved API could: reading a `DataTransfer` before it is neutered, looping a batched reader until exhaustion, capping recursion against cyclic input, and always providing a fallback for browsers lacking a non-standard API. Every one of these failure modes is silent.

### 12.8 Deployment and DevOps

Environment variables validated at startup with **all** failures reported at once; durations parsed into two representations so they cannot drift; `trust proxy` for TLS-terminating platforms; build-time versus runtime configuration; `include=dev` in `.npmrc` because `NODE_ENV=production` makes npm omit the very tools the build needs; and boot diagnostics designed so that each common misconfiguration is visible in one glance.

### 12.9 Debugging and Systematic Diagnosis

Perhaps the most transferable skill: **reasoning from the shape of a failure to its location.** A `401` after a `200` login points at the browser, not the server. A `500` immediately after a successful external verification points at the database. A generic error message is a reason to probe the real system state rather than to re-read correct code.

Also learned: distinguishing normal noise from real faults. Two `401`s on a signed-out page load are the application working correctly; the same two after a successful login are a genuine bug.

### 12.10 Git, GitHub, and Collaboration

Feature-branch workflow, pull requests as review units, keeping a branch synchronised with a moving base, and verifying what is actually merged before deleting anything — including recognising a branch with **no merge base** as unrelated history that must not be deleted casually.

### 12.11 Technical Judgement

The least tangible but most valuable outcome: knowing which trade-offs were made and being able to defend them. Service-role access in exchange for a tractable inheritance model. Client-side sorting in exchange for simplicity, at the cost of constraining future pagination. Two upload paths in exchange for a consistency gap that must be tracked. Recognising that a limitation named honestly is more useful than one quietly omitted.

---

## 13. Security

### 13.1 Implemented Measures

**Password handling**
- bcrypt at cost factor 10; plaintext is never stored, logged, or returned.
- Maximum length capped at 72 characters, matching bcrypt's limit — beyond it, input is silently truncated, which would make the tail of a long password meaningless.
- `password_hash` is excluded from every response by explicit column selection rather than by post-hoc deletion.
- Login returns an identical error for unknown email and wrong password, preventing account enumeration.

**Session security**
- Both tokens are `httpOnly` — unreachable from JavaScript, which blunts token theft via XSS.
- `Secure` and `SameSite=None` in production; `SameSite=Lax` in development.
- Access tokens live 15 minutes, limiting the value of a captured token.
- The refresh cookie is path-scoped to `/api/auth/refresh`, so it is not transmitted on ordinary requests.
- Access and refresh tokens are signed with **independent secrets**, so compromise of one does not yield the other.
- Logout clears cookies with matching attributes, so they are genuinely dropped.

**Authorization**
- Every protected operation resolves the caller's role through `getAccessRole` before acting.
- Mutations require `owner` or `editor`; reads accept any non-null role.
- Inaccessible resources return `404`, not `403`, so the API does not confirm the existence of other users' data.
- Ancestor traversal is depth-bounded, guaranteeing termination.

**Input validation**
- Every request body is validated with Zod before business logic runs.
- Search queries escape LIKE wildcards so user input cannot alter the pattern's meaning.
- Parameterised queries throughout via the Supabase client — no string-concatenated SQL.
- Upload size limits are enforced by `multer` and re-checked on the direct path.

**File and storage security**
- Storage keys are `{userId}/{uuid}`, never derived from user-supplied filenames — eliminating path traversal and collision.
- The bucket is private; all access is via time-limited signed URLs.
- The completion endpoint verifies the key prefix belongs to the caller and that the key was actually issued.
- Size and MIME type are read back from storage rather than trusted from the client.
- Session cookies are explicitly **not** sent on direct-to-storage uploads (`withCredentials: false`).

**Transport and configuration**
- `trust proxy` so the app correctly understands it is behind TLS termination.
- CORS matching walks literal segments rather than building a regex, so a `.` in a hostname pattern cannot be interpreted as a wildcard.
- Credentialed CORS never sends a literal `*`.
- Secrets live only in server-side environment variables; `VITE_*` variables are public by construction and contain none.
- Required variables are validated at startup — the process refuses to boot misconfigured.

**Third-party identity**
- Google ID token signatures verified against Google's certificates.
- Audience pinned to the configured client ID.
- `email_verified === true` strictly required before account linking.
- Matching on the immutable `sub`, not on email.

### 13.2 Deliberate Trade-Off: Row Level Security

RLS is enabled on the tables, but the API connects with the **service role key**, which bypasses it. This means application-level checks are the **only** barrier between users' data.

This was accepted knowingly. The inherited-permission model is difficult to express as an RLS policy and straightforward as an explicit ancestor walk. The cost is that a controller which forgets to call `getAccessRole` would expose data with no database-level safety net — which is why the source comments flag this at every relevant call site.

### 13.3 Not Yet Implemented

Clearly distinguished from the above — these are **absent**, not partial:

| Gap | Risk |
| --- | --- |
| **Rate limiting** | Login and registration accept unlimited attempts; brute-force is not throttled |
| **CSRF tokens** | Mitigated in practice by `SameSite` and a JSON-only API, but no explicit token exists |
| **Email verification for password accounts** | Only Google-sourced addresses are verified |
| **Password reset** | No recovery flow |
| **Refresh token revocation** | Tokens are stateless; a stolen refresh token is valid until it expires |
| **Virus/content scanning** | No inspection of uploaded content |
| **Audit logging** | No record of who accessed or shared what |
| **Per-user storage quotas** | Consumption is unbounded |
| **Security headers** | No CSP, HSTS, or `X-Frame-Options` |

---

## 14. Performance and Optimization

### 14.1 Implemented Optimizations

**Dual-path uploads.** The most significant performance decision in the project. Large files bypass the API entirely, so server memory cost is independent of file size.

**Server-declared limits.** The client fetches thresholds from the API and caches them for the connection's lifetime, so tuning requires no frontend release.

**Targeted refreshes.** After a plain file upload, only the file list is re-fetched. Only an upload that created folders triggers a full refresh.

**Cached folder resolution during folder uploads.** Paths are resolved once and memoised, so a hundred files in one folder produce one folder-creation request rather than a hundred.

**Single-flight refresh.** Concurrent `401`s produce exactly one refresh request.

**Consolidated trash emptying.** One server-side sweep instead of one request per item.

**Purposeful indexes.** `files(owner_id)` and `files(folder_id)` serve the two dominant queries; `shares` is indexed in both directions because authorization asks both.

**Reused Supabase client.** One instance for the process, avoiding per-request connection setup.

**Tree-shakeable icons** and Vite's production build keep the bundle at roughly 94 KB gzipped.

### 14.2 Known Bottlenecks

Stated plainly, because each is real:

**No pagination anywhere.** Every list endpoint returns its complete result set. A folder with 5,000 files sends 5,000 rows, renders 5,000 components, and triggers 5,000 thumbnail requests. Nothing degrades gracefully.

**Search silently truncates.** Capped at 50 results per type with no cursor and no total count, so matches beyond the 50th are unreachable and the interface gives no indication they exist. This is a correctness problem as much as a performance one.

**No lazy loading of any kind.** No code splitting, no image `loading="lazy"`, no data pagination. Every thumbnail in a folder loads immediately, including those below the fold.

**Multipart upload memory ceiling.** Roughly twice the file size per in-flight upload. On a 512 MB instance with a 50 MB threshold, approximately four concurrent uploads exhaust memory, and the process is OOM-killed. It is a cliff, not a slope.

**Sequential uploads.** Files upload one at a time. Fine for a handful; slow for a large folder drop.

**Ancestor walk cost.** Inherited-permission resolution issues one query per ancestor level, so deep hierarchies make authorization progressively more expensive.

**Client-side sorting.** Correct only because the API returns complete result sets — which is precisely what makes pagination a coupled change rather than an isolated one.

---

## 15. Testing and Debugging

### 15.1 Approach

Testing was **manual and targeted** rather than a committed automated suite. This is stated plainly: there is no test runner configured and no test suite in the repository. Verification relied on type checking, targeted test scripts written during development, live probes against running services, and browser-based verification.

### 15.2 Static Verification

TypeScript is the first line of defence. The API compiles under `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; the frontend runs `tsc --noEmit`. Because request and response shapes are declared once and shared, a contract change surfaces as a compile error rather than a runtime `undefined`.

### 15.3 Targeted Testing

The drag-and-drop traversal — the component with the highest density of silent failure modes — was validated with a purpose-built harness that simulated the real browser API's constraints:

| Case | What it verified |
| --- | --- |
| Nested tree | Folder paths reconstructed correctly at depth |
| Loose file alongside a folder | Root-level files get an empty path |
| Empty folder | Recorded and recreated despite containing no files |
| 250-child folder | The 100-per-call batching limit does not truncate |
| Cyclic directory | Depth cap terminates instead of hanging |
| No entry API | Falls back to the flat file list |

All six passed. The batching and cycle cases are the ones that matter — both would have shipped as silent data loss.

### 15.4 Live Verification

**Schema probes.** A read-only query through the application's own Supabase client confirmed exactly which columns and tables existed, which is how the missing migrations were identified and later confirmed applied.

**HTTP probes.** Direct requests against the deployed API verified cookie attributes (`HttpOnly; Secure; SameSite=None`), CORS headers, and endpoint behaviour without needing the UI.

**Route verification.** After adding SPA serving, each routing class was checked: `/` returns HTML, `/api/health` returns JSON, a deep link returns the app shell, an unknown `/api/*` path returns a JSON `404` rather than HTML, and `/api/auth/refresh` returns a JSON `401`.

**Browser verification.** The folder drag-and-drop was exercised end to end in a real browser against mock data — no production data touched — by dispatching a synthetic drop carrying a nested tree. The result confirmed the complete path: folders created, nested paths shown in the progress panel, and the structure recreated exactly, including the empty folder.

### 15.5 Notable Bugs Found and Fixed

| Bug | Diagnosis | Fix |
| --- | --- | --- |
| Login succeeded, next request `401` | Third-party cookie discarded by the browser | Single-origin deployment |
| Google sign-in `500` after successful verification | `users.google_id` missing — migrations unapplied | Applied migrations `003` and `004` |
| Unverified email could link to an existing account | `email_verified === false` allowed a *missing* claim through | Require `=== true` |
| Client secret configured but unused | Misunderstanding of ID-token vs code flow | Removed |
| Google button would not render after deployment change | Client ID blank at build time | Populated in the build environment |
| Empty API URL fell back to localhost | `||` collapsed a meaningful empty string | Switched to `??` |

### 15.6 Debugging Techniques Developed

- **Reason from the failure's shape to its location.** A `401` after a `200` login implicates the browser; a `500` after successful external verification implicates the database.
- **Probe the real system.** Checking the actual deployed schema and actual response headers is faster than re-reading correct code.
- **Make configuration visible.** The boot log prints the port, environment, whether the web bundle was found, allowed origins, and the Google client ID — each line added after a specific misconfiguration proved hard to diagnose.
- **Distinguish noise from faults.** Two `401`s on a signed-out page load are correct behaviour.

### 15.7 Edge Cases Handled

Google accounts with no password (bcrypt on a null hash); duplicate folder names against live and trashed siblings; empty multipart form fields arriving as `""`; repeated query parameters arriving as arrays; LIKE wildcards in search input; folders exceeding the reader's batch size; cyclic directory structures; concurrent token refreshes; partial upload failures within a batch; and non-JSON error responses from proxies.

---

## 16. Future Improvements

### 16.1 Short-Term

| Improvement | Rationale |
| --- | --- |
| **`loading="lazy"` on grid thumbnails** | One attribute; immediate benefit in image-heavy folders |
| **Fix the silent search cap** | Return a total count, or paginate — currently results beyond 50 are unreachable with no indication |
| **Implement the `pending_uploads` sweeper** | Abandoned uploads leak storage indefinitely; the ledger already exists and is anticipated by the migration |
| **Lower the multipart threshold** | Reduces per-upload memory and raises the safe concurrency ceiling substantially |
| **Rate limiting on auth endpoints** | Brute-force is currently unthrottled |
| **Security headers** | CSP, HSTS, `X-Frame-Options` |
| **Populate the `checksum` column** | Column exists but is unused; would enable integrity verification and deduplication |

### 16.2 Medium-Term

| Improvement | Rationale |
| --- | --- |
| **Server-side pagination with server-side sorting** | The only change that alters the app's scaling behaviour — must be done together, since sorting one page rather than the whole folder is visibly wrong |
| **URL-based routing** | Folders cannot currently be bookmarked or shared as links, and Back does not navigate up |
| **Parallel uploads with a concurrency limit** | Large folder drops are currently sequential |
| **Password reset and email verification** | Standard account-recovery expectations |
| **Refresh token revocation** | Requires server-side token state; enables real logout-everywhere |
| **Audit logging** | Record access and share events |
| **Per-user storage quotas** | Consumption is currently unbounded |

### 16.3 Long-Term and Scalability

| Improvement | Rationale |
| --- | --- |
| **Cache authorization results per request** | The ancestor walk repeats within a single request lifecycle |
| **Materialised paths or `ltree` for hierarchies** | Would replace the iterative ancestor walk with a single indexed query |
| **Public share links with expiry** | Sharing currently requires the recipient to have an account |
| **File versioning** | Retain history rather than overwriting |
| **Background processing pipeline** | Thumbnails, virus scanning, OCR — feasible on the multipart path where the API already holds the bytes |
| **Real-time collaboration** | WebSocket-driven live updates when a shared folder changes |
| **Automated test suite and CI** | Formalise the manual verification described in §15 |
| **Horizontal scaling** | The API is stateless, so it scales horizontally today; the bottleneck would move to the database and to authorization query volume |

---

## 17. Conclusion

### 17.1 What Was Built

A complete, deployed, full-stack cloud storage platform: a TypeScript Express REST API spanning roughly thirty endpoints, a React single-page application, a five-table PostgreSQL schema managed through ordered migrations, object storage integration with signed URLs, dual authentication including verified Google Sign-In, and a hierarchical permission system with inheritance — all compiled together and served from a single origin.

### 17.2 What It Solves

It gives users a place to store, organise, recover, search, and share files, with a permission model that behaves the way people expect: grant access to a folder, and everything inside it — including files added later — follows automatically.

More broadly, it addresses the gap between file storage as it appears from the outside and file storage as it actually works. The problems that define the system — memory limits under concurrent uploads, permission inheritance through arbitrary depth, session integrity across browser privacy models — are invisible until you build it.

### 17.3 The Technical Work

The substance was not writing CRUD endpoints. It was the decisions:

- Recognising that **deployment topology determines whether cookie authentication works**, that the Public Suffix List defines the boundary, and that two services on the same platform are still two sites.
- Designing **two upload paths** because a single one is either memory-unsafe or needlessly complex, and accepting the consistency gap that creates.
- Resolving **permissions at access time** rather than materialising them at share time, so inheritance is automatic and moves require no bookkeeping.
- Encoding business rules as **partial unique indexes**, so they cannot be bypassed by application code.
- Handling a **browser API whose every failure mode is silent**, and testing against its constraints rather than its happy path.
- Choosing **service-role database access** deliberately, understanding exactly what safety net that removes.

### 17.4 Key Outcomes

- A working system with all major features implemented, not stubbed.
- A security posture with specific, defensible measures — and an honest register of what is absent.
- A documented and reproducible deployment.
- A debugging methodology that reasons from a failure's shape to its likely location.
- A clear, prioritised improvement path grounded in measured limitations.

### 17.5 Skills Gained

Full-stack development across React and Express with TypeScript throughout; relational schema design including partial indexes, soft deletes, and hierarchical data; authentication and session engineering; OAuth ID-token verification and its security requirements; object storage and signed-URL patterns; browser API edge cases; deployment configuration and diagnostics; systematic debugging; and — least tangible, most valuable — the judgement to name a trade-off rather than hide it.

### 17.6 Overall Impact and Potential

As a product, it is usable today for individuals and small teams needing organised storage with real sharing. As a foundation, its REST API and permission model would support a mobile client, a domain-specific document system, or an internally hosted alternative to commercial storage.

As a learning artefact — its primary purpose — it demonstrates the difference between an application that works in a demo and one that has been reasoned about under load, under attack, and under the constraints real browsers and real hosting platforms impose. The limitations recorded throughout this document are not omissions; they are the measured boundaries of what was built, and they define exactly where the next work begins.

---

[SCREENSHOT: /*A final "hero" screenshot of the completed application — the file explorer fully populated with folders and files, ideally with a share modal or upload in progress, suitable for the top of a portfolio entry*/]

---

*Documentation for CloudStorage Explorer — /*repository link goes here*/*
