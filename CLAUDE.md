# Ujredi

Crossword app. The puzzle creator (`creator/`) sends puzzle JSON to the Go server. The server serves it to the Flutter app. Puzzles must be fully solvable offline, including revealing clues and answers.

## Status

Only the plumbing exists. The server serves `GET /healthz` and nothing else. The app is the default Flutter template. The creator has 8 sample grids (`loose-c` with 36 black cells, `open-a` with 34, 2 `loose-long` and 2 `open-long` grids with words up to 11 letters, all 13x13, and `loose-c-14` with 42 black cells and `open-a-14` with 40, both 14x14), a grid rule checker and a make-a-crossword page for filling letters and writing clues by hand. `creator/server/data/words.db` (SQLite, table `words`: `word`, `length`, `source`) holds 87,963 Georgian words (lemmas and inflected forms, 3 to 13 letters) for filling grids. Sources and rebuild steps are in `creator/server/data/README.md`. The creator server serves `GET /healthz`, `POST /api/fill` (fills a square grid of up to 14x14 with `ingrid_core`, typed letters stay) and `GET /api/candidates?pattern=` (words that match a pattern such as `მგ...`). The creator opens on a homepage with Create (pick a sample grid and fill it) and Open (load a saved puzzle file into the same editor, without the grid picker; files are not validated yet). The editor toolbar has Fill grid, Fill word, Save crossword and Clear. While a fill runs, the fill buttons say "Filling…" and are disabled, and Stop filling appears. This state and the fill error are kept per grid in `creator/src/grids/fillStatus.ts`, so they survive a grid switch. Fill grid keeps the letters you typed or picked and replaces the letters of the earlier fill, which are shown in gray when the fill kept letters you typed (a fill on an empty grid is black), so pressing it again is a refill. Cells take any character. Typing goes through a hidden input, so the OS emoji picker and paste work. The filler assumes the grid is fully Georgian: a grid with another character is refused by the server, and the page says so. Still to build: puzzle migration, JSON API, htmx admin pages, data layer, screens.

## Layout

- `app/`: Flutter, iOS and Android only. Package name is `ujredi`.
- `server/`: Go module `ujredi/server`. Entry point is `cmd/server`. Folders `migrations/` (goose), `queries/` (sqlc input) and `internal/db/` (sqlc output) are empty.
- `creator/`: React + TypeScript + Vite + Tailwind v4, managed with pnpm. Generates puzzles. Runs locally only, never deployed with the server.
- `creator/server/`: Go module `ujredi/creator/server`, port `:8081`. Owns the word list and grid filling. Filling runs the `ingrid_core` CLI (Rust, `cargo install ingrid_core`). Env: `INGRID_BIN` (default: PATH, then `~/.cargo/bin`), `FILL_TIMEOUT` (default `20s`), `WORDS_DB`. Without the binary the server still runs, and `/api/fill` returns 503. Pure-Go SQLite (`modernc.org/sqlite`), no Postgres.
- `compose.yaml`: Postgres only. The Go server runs natively.

## Commands

Run from the repo root.

- `make tools`: install `goose`, `sqlc`, `air` into `~/go/bin`
- `make db-up` / `make db-down`: start or stop Postgres
- `make migrate`: run goose migrations
- `make sqlc`: generate Go code from `server/queries`
- `make dev`: start Postgres and run the server under `air` on `:8080`
- `make test-server`: run Go tests
- `make perf-app`: trace grid taps in profile mode. Needs a USB-connected iPhone. Writes `app/build/grid_taps.timeline_summary.json`.
- `make words`: rebuild `creator/server/data/words.db` from the source files (downloads them)
- `make dev-creator-server` / `make test-creator-server`: run the creator server on `:8081` or run its Go tests. The creator page needs both `make dev-creator-server` and `make dev-creator`. Vite proxies `/api` to `:8081`.
- `make dev-creator` / `make build-creator` / `make test-creator`: run the creator dev server on `:5173`, build it, or run its Vitest tests

Run `flutter` commands inside `app/`. Run `go` commands inside `server/` or `creator/server/`. Run `pnpm` commands inside `creator/`.

## Stack rules

- Server: `net/http` with Go 1.22 method/path patterns (`"GET /api/puzzles/{id}"`). Database access through `pgx` + `sqlc` only. Migrations through goose only.
- Server pages: `html/template` + htmx. Vendor htmx under `server/internal/web/static/`, do not load it from a CDN.
- Puzzles are stored as `data jsonb`. The server checks only that an upload is a JSON object. The puzzle schema belongs to `creator/`. It lives in `creator/src/puzzle/types.ts` (version 2: `id`, `title`, `author?`, `size`, `rows` as arrays of cells, `clues` with `number`, `direction`, `answer` and `question`, `savedAt`). A cell is `null` (black), `""` (empty) or what it holds: one character as a person sees it, so a Latin letter, a symbol or an emoji is allowed. Version 1 files (`rows` as strings) still open. There is no status field. Save crossword in the creator downloads this file.
- Grid layouts, preset grids and grid rules (symmetry, black ratio, word length) belong to `creator/`. Grids come in six tiers. Four are 13x13. `loose` (36 black cells in the samples, up to 46 allowed) and `open` (34 black cells, up to 36 allowed) have words up to 9 letters and average 4.6 letters per word. `loose-14` (42 black cells in the sample, up to 53 allowed) and `open-14` (40 black cells, up to 42 allowed) are the 14x14 versions of those two, with the black counts scaled by cell count and even because a 14x14 grid has no centre cell. There are no 14x14 versions of the `-long` tiers yet: none of 4 searches of about 100s found one that fills. `loose-long` (32 to 34 black cells in the samples, up to 36 allowed) and `open-long` (28 to 32 black cells, up to 34 allowed) have words up to 11 letters and average 5.0 to 5.3 letters per word. Grids with words longer than 11 letters rarely fill with the current word list. A new `loose`, `open`, `loose-14` or `open-14` sample grid must fill with `ingrid_core` in under 2s with each of 3 differently scored word lists. A new `-long` sample grid must fill in under 30s with each of 5 differently scored word lists (the 4 current ones took up to 8s while 8 fills ran at once). The app renders grids it receives. The server does not validate them.
- The creator talks to the ujredi server only through the HTTP API, never to Postgres.
- The creator server owns the word list and grid filling. The ujredi server never sees them. The word list lives in `creator/server/data/words.db`, which is committed.
- Put reusable creator components in `creator/src/components/`. Grid rules live in `creator/src/grids/rules.ts`, sample grids in `creator/src/grids/samples.ts`.
- App state: Riverpod. Local progress: `shared_preferences`. Downloaded puzzles: JSON files in the app documents directory. Use drift (SQLite) only if history is needed.
- Font: Noto Serif Georgian, bundled in `app/assets/fonts/`.
- Put reusable widgets in `app/lib/shared/`.
- The app never calls the server while solving a puzzle.
- No auth in dev. Auth must be added before any deploy (Bearer token for uploads, basic auth for `/admin`).

## Gotchas

- Go sends `application/json` without a charset. In Dart, decode with `utf8.decode(response.bodyBytes)`, never `response.body`, or Georgian text breaks.
- Riverpod 3 retries failed providers by default. Set `retry: (retryCount, error) => null` on `ProviderScope` so error states show.
- Android blocks cleartext HTTP. Debug builds allow it (`app/android/app/src/debug/AndroidManifest.xml`). The emulator reaches the host at `http://10.0.2.2:8080`. The iOS simulator uses `http://localhost:8080`.
- `make migrate` fails with "no migration files found" until the first migration exists.
