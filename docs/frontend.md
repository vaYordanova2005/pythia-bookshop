# Frontend

No framework, no build step, no npm dependencies on the frontend — the browser
loads `FE/index.html`, `FE/app.js`, and `FE/styles.css` directly, served
statically by the Express backend.

## Structure

- **`FE/index.html`** — one `<section id="page-*" class="page">` per route
  (`home`, `detail`, `cart`, `checkout`, `orders`, `favorites`, `profile`), plus
  the auth modal markup. Routing shows/hides these sections rather than
  swapping in templates.
- **`FE/app.js`** (~830 lines) — all logic: routing, state, rendering, API calls.
- **`FE/styles.css`** — all styling.

## State

A single `state` object (`FE/app.js:9`) holds everything:

```js
{
  books, cart, favorites, token, user, role,
  promoCode, activeGenre, currentBookId, currentBook, currentStars
}
```

- `cart` is persisted to `localStorage` (`bibliotheca_cart`) so it survives
  reloads and doesn't require login.
- `token` (JWT) is persisted to `localStorage` (`bibliotheca_token`); `user` is
  fetched from `GET /api/auth/me` on load if a token exists.
- Everything else is in-memory and rebuilt on navigation.

## Routing

Hash-based, no history API:

- `navigate(page)` / `navigateToBook(id)` set `location.hash`.
- `applyRoute()` (triggered on `hashchange`) parses the hash, matches
  `#/book/:id` specially (calls `openBook`), otherwise shows the page section
  matching `#/<page>` via `showPage()`.
- Unknown routes fall back to `home`.

## Talking to the API

A single helper wraps `fetch` (`FE/app.js:59`, `api()`):

- Prefixes every call with `/api`.
- Attaches `Authorization: Bearer <token>` automatically when logged in.
- Parses JSON, throws on non-2xx with the server's `error` message.

All rendering functions (`renderBooks`, `renderCart`, `renderCheckout`,
`renderAuth`, etc.) call `api()` and then re-render the relevant DOM section —
there's no virtual DOM, they just rebuild `innerHTML` from template strings.

## Cover image fallback

Book covers come from Open Library by ISBN. Two edge cases are handled
(`FE/app.js:30-56`):

- A genuinely missing image fires the `error` event → falls back to a colored
  block with the book title.
- Open Library returns **HTTP 200 with a 1×1 placeholder pixel** when it has no
  cover for an ISBN, which never fires `error` — caught instead via a
  `naturalWidth <= 1` check on the `load` event.

Both listeners are delegated on `document` in the capture phase, since `error`
doesn't bubble.

## XSS handling

User-supplied and API-supplied strings (titles, descriptions, review comments)
are passed through `escapeAttr()` before being interpolated into template
strings — see commit `aa4c988` ("Fix XSS, auth, and order-integrity security
issues").
