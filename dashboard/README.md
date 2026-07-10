# ExerciseDB Dashboard

The developer dashboard: account, API keys, usage, and plan changes.

A separate Vite + Vue project with its own `package.json`. The API's dependency
tree is untouched by it, and the docs site in `website/` stays a static build.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

The API must be running on `http://localhost:3000`, and that origin must appear
in the API's `DASHBOARD_ORIGINS`. Point elsewhere with `VITE_API_BASE_URL`.

```bash
npm run build      # -> dist/
npm run preview
```

## How authentication works

The dashboard does **not** use an API key. It cannot: the plaintext key is
returned exactly once, at creation, so a page whose job is to list and rotate
keys could never hold one. Revoking your last key would also lock you out.

Instead `POST /auth/login` sets an `httpOnly`, `SameSite=Lax` session cookie.
JavaScript cannot read it, `fetch` sends it because every request uses
`credentials: 'include'`, and the server can revoke it — logging out kills the
token server-side, not just in the browser.

Sessions consume no daily quota. Reading your own usage page should not cost you
requests.

Because the session lives in a cookie the app cannot read, "am I signed in?" is
answered by calling `GET /me` and treating `401` as "no". That is what
`src/stores/session.js` does on first navigation.

## Design values

There are none in this project. `src/styles/tokens.css` imports the design
system from `website/.vitepress/theme/design-system.css`, which is the single
source of truth. A copy would be a second source, and the two would drift.

The dark theme is keyed to a `.dark` class that VitePress toggles on the docs
site. Nothing toggles it here, so `src/styles/theme.js` binds that class to the
reader's OS preference.

## Layout

```
src/
  api/client.js       fetch wrapper; parses RFC 9457 errors into ApiError
  stores/session.js   who is signed in
  router.js           routes plus the signed-in / signed-out guard
  views/              one file per page
  styles/             tokens import, app styles, theme binding
```
