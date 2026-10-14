# Ujredi Monorepo Design

Date: 2026-10-14

## Goal

A crossword app. A separate puzzle-creator project sends puzzle JSON to a Go server. The server serves that JSON to a Flutter app. The player can solve a downloaded puzzle fully offline, including revealing clues and answers.

## Scope

This repo contains the Flutter app and the Go server. The puzzle creator is a separate project and is not in this repo.

## Stack

| Area | Choice |
|---|---|
| App | Flutter (Dart), iOS and Android only |
| App state | Riverpod |
| Local progress | `shared_preferences` (drift/SQLite later if history is needed) |
| Local puzzles | JSON files in the app documents directory (`path_provider`) |
| Font | Noto Serif Georgian, bundled as an asset |
| Server | Go 1.22+, `net/http` with method/path route patterns |
| Server pages | `html/template` + htmx |
| Database | PostgreSQL, accessed with `pgx` + `sqlc` |
| Migrations | goose |
| Local dev | `docker compose` runs Postgres. The Go server runs natively with `air`. |

## Layout

```
ujredi/
├── compose.yaml          # Postgres only
├── Makefile              # db-up, migrate, sqlc, dev (air), app
├── app/                  # Flutter
│   ├── lib/
│   │   ├── features/     # puzzle list, puzzle screen
│   │   ├── shared/       # reusable widgets, theme
│   │   └── data/         # API client, PuzzleRepository, ProgressStore
│   └── assets/fonts/     # Noto Serif Georgian
└── server/               # Go module
    ├── cmd/server/       # main.go
    ├── internal/
    │   ├── http/         # handlers, route patterns
    │   ├── db/           # sqlc output (generated)
    │   └── web/          # html/template files
    ├── migrations/       # goose
    ├── queries/          # sqlc .sql files
    ├── sqlc.yaml
    └── .air.toml
```

No workspace tooling (no Melos, no `go.work`). There is one Flutter app and one Go module.

## Server

### Routes

- `POST /api/puzzles`: creator uploads puzzle JSON. Stored with status `draft`.
- `GET /api/puzzles`: list of `published` puzzles (metadata only).
- `GET /api/puzzles/{id}`: full puzzle JSON for one `published` puzzle.
- `GET /admin/puzzles`: server-rendered list. htmx changes the status of a puzzle (publish, unpublish) with `PATCH` and swaps the updated row in place.

### Data

A `puzzles` table with metadata columns and a `data jsonb` column that holds the creator's puzzle JSON as sent. The exact columns are not designed yet. They are decided when the first migration is written.

### Behavior

- The server checks only that the upload body is a well-formed JSON object. It does not check crossword rules. The creator and the app own the format.
- The app routes return only `published` puzzles. An unknown or unpublished `{id}` returns 404.
- Bad JSON returns 400 with a JSON error body. Database errors return 500 and are logged. The admin pages show errors inline.
- The `data` JSON sent to the app must contain clues and answers, because the app checks and reveals on the device.

### Auth

None in dev. Adding auth is a required task before any deploy. The plan is a static `Authorization: Bearer <token>` for `POST /api/puzzles` and HTTP basic auth for `/admin`, both from env vars. The read routes stay public.

### Dev flow

- `make db-up` starts Postgres.
- `make migrate` runs goose.
- `make sqlc` regenerates the query code.
- `make dev` runs the server under `air`.

## Flutter app

### Offline model

- The app calls the server only to list puzzles and to download one. It makes no calls while solving.
- `PuzzleRepository` reads `<id>.json` from the app documents directory. If the file is missing, it downloads the puzzle, saves it, and returns it.
- A downloaded puzzle is never updated. If the creator changes a puzzle, it needs a new id.
- The clues and answers are in the puzzle JSON. Check and reveal logic runs in the app. "Reveal" means showing a clue's text and revealing letters or answers from the downloaded JSON.

### Screens

- **List:** online, it shows the server list and marks downloaded puzzles. Offline, it shows only downloaded puzzles. If the fetch fails and nothing is downloaded, it shows an error with a retry button.
- **Puzzle:** grid, clues and timer.

### Progress

`ProgressStore` saves filled cells and elapsed seconds per puzzle id in `shared_preferences`. It sits behind an interface, so drift can replace it later without UI changes.

### State

Riverpod providers wrap the API client, `PuzzleRepository` and `ProgressStore`. The list and the single puzzle are async providers.

### UI

The grid cell, clue row and timer are reusable widgets in `shared/`. The theme uses the bundled Noto Serif Georgian font.

### API base URL

A build-time define sets the base URL. The Android emulator uses `10.0.2.2:8080`. The iOS simulator uses `localhost:8080`.

## Testing

- Go: handler tests with `httptest` against the compose Postgres.
- Flutter: unit tests for `PuzzleRepository`, `ProgressStore` and the providers, and widget tests for the shared widgets and screens.

## Open items

- The puzzle JSON schema is defined with the creator project and is not part of this spec.
- The `puzzles` table columns are decided at the first migration.
- Auth must be added before any deploy.
