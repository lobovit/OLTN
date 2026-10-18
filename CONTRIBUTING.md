# Contributing to OLTN

Thanks for your interest in contributing! OLTN is a fully client-side Mastodon
web client: there is no server component, and the browser talks directly to the
user's instance. This document covers setup, architecture, conventions, and the
checks to run before submitting changes.

A note on language: the app defaults to English and lets users switch to
Brazilian Portuguese (`pt-BR`) in Settings. `src/i18n/en.ts` is the master
dictionary (`TKey` derives from it); every UI string must exist in both
dictionaries. Code comments and test titles are written in English. Issues and
pull requests are welcome in English or Portuguese.

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8)
- npm
- Optionally, an account on a Mastodon-compatible instance for testing login
  and API features

No backend, database, or environment variables are required. All state lives
in the browser (`localStorage`/`sessionStorage`, keys prefixed `oltn.`).

## Getting started

```bash
git clone <repo-url>
cd OLTN
npm install
npm run dev        # http://localhost:5173
```

Sign in from the login page with `instance.tld` (or `@user@instance.tld`). The
app registers itself against the instance via `/api/v1/apps` and uses OAuth2
with PKCE when the instance advertises support. The OAuth callback is handled
in `src/state/boot.ts`.

### Testing over a tunnel

The dev server binds all interfaces (`host: true`) and allows `.ngrok*` hosts,
which is useful for testing the OAuth flow from a phone or another machine.
The redirect URI is always `location.origin + location.pathname`, so the
registered app works on any host you serve the app from.

## Repository layout

```
index.html            single HTML entry; contains the strict CSP meta
src/main.tsx          Preact root, imports global CSS
src/app.tsx           boot gate, providers, always-mounted overlays
src/app/              routing shell, route table, keyboard shortcut map
src/pages/            one component per route (non-deck pages)
src/components/       feature components; feature CSS is colocated
src/state/            valtio store, boot/auth flow, snapshot hooks
src/api/              masto wrappers (REST + streaming), OAuth helpers, types
src/lib/              router, storage, formatting, sanitization, retry, hotkeys
src/i18n/             en.ts (master dictionary) + pt-BR.ts
src/styles/           global tokens/base/shell/page CSS
scripts/              icon generation and icon coverage check
Makefile              task wrappers for dev, build, test and publish
```

## Commands

| Command                                           | Description                                        |
| ------------------------------------------------- | -------------------------------------------------- |
| `npm run dev`                                     | Vite dev server on http://localhost:5173           |
| `npm run build`                                   | Typecheck (`tsc`) then production build to `dist/` |
| `npm run preview`                                 | Serve the built `dist/` locally                    |
| `npm test`                                        | Full Vitest run (happy-dom)                        |
| `npx vitest run src/lib/__tests__/router.test.ts` | Run a single test file                             |
| `npm run typecheck`                               | `tsc --noEmit`                                     |
| `npm run format`                                  | Format the codebase with oxfmt                     |
| `npm run icons:check`                             | Verify every icon referenced in code exists        |
| `node scripts/generate-emojis.mjs`                | Regenerate the emoji datasets (pt/en)              |

There is no ESLint in this repository (the `eslint-disable` comments are
leftovers from other tooling). Do not expect or add a lint step.

The Makefile mirrors the common tasks (`make help` lists them). `make publish`
builds the app and pushes `dist/` to the GitHub Pages repository; it is intended
for maintainers.

## Architecture notes

- Flow: `src/main.tsx` → `src/app.tsx` → `boot()` in `src/state/boot.ts`
  (storage load, OAuth callback, sign-in, route guard). The UI renders only
  after `store.booted`.
- Routing is a small hash-based router (`src/lib/router.tsx`); routes are
  declared in `src/app/routes.tsx`. The optional `/:instance?` prefix supports
  deep links to other instances' content.
- State is a single valtio proxy (`src/state/store.ts`). Read it with
  `useSnapshot`/`useAppState` (`src/state/hooks.ts`) and mutate the `store`
  proxy directly (no actions/reducers). Statuses are cached under the key
  `uri || id` (`putStatus`, `putStatuses`).
- API access goes through `src/api/`: `getRest` caches a masto client per
  `instance|token`, and `connectUserStream` wraps the websocket. Prefer these
  wrappers over new raw `fetch` calls.
- The authenticated home route (`/`) is a multi-column deck (up to 6 pinned
  shortcuts; order and widths persisted per account in `store.prefs`). With
  deck mode off, the home route renders the same shortcuts as floating panels
  (position, size, stacking and color also persisted per account). All other
  routes render a page from `src/pages/`.

## Coding conventions

### TypeScript

- Strict mode plus `noUnusedLocals`/`noUnusedParameters`.
- `verbatimModuleSyntax` is on: type-only imports must use `import type`.
- `npm run typecheck` must pass; `npm run build` runs it as well.

### Preact, not React

- Components use Preact with `preact/jsx-runtime` and function components.
- Vite aliases `react`/`react-dom` to `preact/compat` only because some
  dependencies (valtio) import React. Never add `react` as a dependency or
  import it in app code.

### CSS

- Plain CSS only: no Tailwind, CSS-in-JS, or preprocessors.
- Global tokens and layout live in `src/styles/`; feature styles are colocated
  and imported by the component that uses them (`status.css`, `feed.css`,
  `login.css`).
- Themes and accent colors are driven by `data-theme`/`data-accent` attributes
  on `<html>` (set in `applyAppearance()`). Style with those instead of
  hardcoding colors.

### State

- Mutate `store` directly; read via `useSnapshot`/`useAppState`.
- Account-scoped preferences are written through `updatePrefs(patch)` in
  `src/state/boot.ts`: add the field to `AccountPrefs` and pass it as one patch,
  so one writer cannot drop a field added by another.

### Internationalization

- `src/i18n/en.ts` is the master dictionary; `TKey` is derived from it.
- Every new UI string must be added to both `en.ts` and `pt-BR.ts` - `pt-BR` is
  typed `Record<TKey, string>`, so a missing key fails `npm run typecheck`.
- Use the `t` proxy (it reads `store.settings.language` at access time, falling
  back to English) and avoid hardcoded user-visible text.

### Icons

- `src/components/ui/icons.ts` is generated by `scripts/generate-icons.mjs`;
  never hand-edit it.
- To add an icon: append its MingCute (Iconify) name to the `wanted` array in
  the script, run `node scripts/generate-icons.mjs`, then `npm run icons:check`.
- Reference icons by name through the `<Icon>` component; the check script
  scans the code for `*-line`/`*-fill` names.

### Emoji data and translation

- `src/lib/emoji-data.pt.ts` and `src/lib/emoji-data.en.ts` are generated by
  `scripts/generate-emojis.mjs` from the `emojibase-data` dev dependency
  (Emojibase, MIT); never hand-edit them. Regenerate with
  `node scripts/generate-emojis.mjs`. The datasets are loaded lazily as
  separate chunks by `src/lib/emoji.ts` when the composer emoji picker opens.
- Generated assets are committed already formatted: after regenerating icons
  or emoji data, run `npm run format` before opening a PR.
- Draft translation (`src/lib/translate.ts`) uses Google Translate's public
  `translate.googleapis.com` endpoint (free, no key). Note that the draft text
  is sent to Google when the user explicitly taps translate; keep it behind
  the user action and never translate automatically.

### Security and CSP

- `index.html` sets a strict CSP: scripts and styles from self (inline
  allowed), no `eval`, no external CDNs. `connect-src` allows `https:`/`wss:`
  (plain HTTP is not allowed); images/fonts must be `https:`, `blob:`, or
  `data:`.
- Status HTML must be sanitized (DOMPurify helpers in `src/lib/sanitize.ts`);
  never inject unsanitized HTML.
- Access tokens live in `localStorage` by design (client-side app); never log
  or transmit them beyond the user's own instance.

## Testing

- Vitest with the happy-dom environment, configured in the `test` block of
  `vite.config.ts`.
- Tests live in `src/lib/__tests__/*.test.ts(x)` and cover pure utilities and
  state helpers: router, formatting, sanitization, feed state, layout and
  floating-panel math, identity resolution, status actions, and emoji text
  rendering.
- Run the full suite with `npm test`, or one file with
  `npx vitest run <path>`.
- Add unit tests for new logic in `src/lib/`. Keep tests deterministic and
  offline: no network or real instance required.

## Before opening a pull request

1. `npm run format`
2. `npm run typecheck`
3. `npm test`
4. `npm run icons:check` (if you touched UI or icons)
5. Smoke-test the affected flow with `npm run dev` (login, timeline,
   composer, etc.)

There is no CI yet, so these checks are on you.

A few more notes:

- Keep pull requests focused; describe the behavior change and the motivation.
- Write imperative commit messages in English; the repository uses
  `type(scope): summary` (`feat`, `fix`, `refactor`, `style`, `docs`, `chore`).
- For UI changes, include a before/after screenshot and mention which theme(s)
  you tested.

## License

OLTN is released under the MIT license. The project is inspired by
[phanpy](https://github.com/cheeaun/phanpy) (MIT) by Lim Chee Aun.
