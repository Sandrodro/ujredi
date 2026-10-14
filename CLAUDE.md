# Ujredi

Crossword app. A separate puzzle-creator project (not in this repo) sends puzzle JSON to the Go server. The server serves it to the Flutter app. Puzzles must be fully solvable offline, including revealing clues and answers.

Design: `docs/superpowers/specs/2026-10-14-ujredi-monorepo-design.md`
Plan: `docs/superpowers/plans/2026-10-14-ujredi-monorepo.md`

## Status

Only the plumbing exists. The server serves `GET /healthz` and nothing else. The app is the default Flutter template. The plan covers the rest: migration, JSON API, htmx admin pages, data layer, screens.

## Layout

- `app/`: Flutter, iOS and Android only. Package name is `ujredi`.
- `server/`: Go module `ujredi/server`. Entry point is `cmd/server`. Folders `migrations/` (goose), `queries/` (sqlc input) and `internal/db/` (sqlc output) are empty.
- `compose.yaml`: Postgres only. The Go server runs natively.

## Commands

Run from the repo root.

- `make tools`: install `goose`, `sqlc`, `air` into `~/go/bin`
- `make db-up` / `make db-down`: start or stop Postgres
- `make migrate`: run goose migrations
- `make sqlc`: generate Go code from `server/queries`
- `make dev`: start Postgres and run the server under `air` on `:8080`
- `make test-server` / `make test-app`: run Go or Flutter tests
- `make perf-app`: trace grid taps in profile mode. Needs a USB-connected iPhone. Writes `app/build/grid_taps.timeline_summary.json`.

Run `flutter` commands inside `app/`. Run `go` commands inside `server/`.

## Stack rules

- Server: `net/http` with Go 1.22 method/path patterns (`"GET /api/puzzles/{id}"`). Database access through `pgx` + `sqlc` only. Migrations through goose only.
- Server pages: `html/template` + htmx. Vendor htmx under `server/internal/web/static/`, do not load it from a CDN.
- Puzzles are stored as `data jsonb`. The server checks only that an upload is a JSON object. The puzzle schema belongs to the creator project.
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
