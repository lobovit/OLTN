# OLTN

another mastodon webclient.

## Features

- OAuth2 + PKCE sign-in on any Mastodon-compatible instance (popup or redirect)
- Real-time home timeline with a "new posts" queue; grouped notifications and mentions
- Threaded conversations and profiles (posts, replies, media, followers/following)
- Composer with media, polls, CW, visibility, drafts, and editing
- Search (accounts, hashtags, posts), public hashtags, local/federated timelines
- Lists, bookmarks, favourites, filters (v2), trending
- Multi-column deck with pinned shortcuts, drag-to-reorder and resize
- Keyboard shortcuts (`j/k`, `c`, `/`, `?`, `g h`, …)
- Dark/light/auto themes, multi-account support, pt-BR and English UI

## Quick start

Requires Node.js `^20.19` or `>=22.12`.

```bash
npm install
npm run dev   # http://localhost:5173
```

## Development

```bash
npm run build      # tsc && vite build → dist/
npm test           # vitest (happy-dom)
npm run typecheck  # tsc --noEmit
npm run format     # oxfmt
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture, conventions, and the
icon/i18n workflows.

## Stack

Preact 11 · Vite 8 · valtio · masto v8 · vanilla CSS · TypeScript strict ·
MingCute icons via Iconify (CC0).

## License

MIT.
