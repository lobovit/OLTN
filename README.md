# OLTN

Another Mastodon Deck Web Client.

## Features

- OAuth2 + PKCE sign-in on any Mastodon-compatible instance (popup or redirect)
- Real-time home timeline with a "new posts" queue; grouped notifications and mentions
- Threaded conversations and profiles (posts, replies, media, followers/following, profile fields)
- Composer with media, polls, CW, visibility, quote policies, drafts, editing, emoji picker (Unicode + instance emojis), draft translation, post scheduling, and automatic code-to-image for fenced code blocks
- Edit and delete your own posts
- Search (accounts, hashtags, posts), public hashtags, local/federated timelines
- Lists, bookmarks, favourites, filters (v2)
- Trending with posts, hashtags, people and news tabs
- Newsletter with trending links and custom fediverse news sources (full handles, or a bare @user to pick from known accounts)
- Multi-column deck with pinned shortcuts, drag-to-reorder and resize; with deck mode off the home turns into floating panels that snap magnetically and take per-panel colors
- Keyboard shortcuts (`j/k`, `c`, `/`, `?`, `g h`, …), plus a Pomodoro/reminder timer in the nav
- Dark/light/auto themes, multi-account support, GIF autoplay setting, pt-BR and English UI

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

`make` wraps the common tasks (run `make help`). Maintainers publish the built app with `make publish`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture, conventions, and the
icon/i18n workflows.

## Stack

Preact 11 · Vite 8 · valtio · masto v8 · vanilla CSS · TypeScript strict ·
MingCute icons via Iconify (CC0).

## Support

OLTN is free, open-source software maintained in my spare time. If it is useful
to you, consider supporting its development with any amount, and every
contribution helps keep the project alive and improving.

<p align="center">
  <a href="https://nubank.com.br/cobrar/1z437/6accfdbf-ea20-443b-878e-5618946fad4a">
    <img src="src/assets/support-qr.png" alt="Support OLTN payment QR code" width="220">
  </a>
</p>

<p align="center">Scan the QR code with your phone or use the payment link above. Thank you for the support!</p>

## License

MIT. See [LICENSE](LICENSE).
