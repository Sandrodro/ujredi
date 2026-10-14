# Ujredi Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Mark each step done when it is done.

**Goal:** Build the monorepo: a Go server that stores puzzle JSON from the creator and serves it, and a Flutter app that lists, downloads and stores puzzles for offline use.

**Architecture:** The Go server (`net/http` route patterns, `pgx` + `sqlc`, goose migrations) keeps each puzzle as a `data jsonb` column and exposes a JSON API plus htmx admin pages. The Flutter app downloads a puzzle once, saves it as `<id>.json`, and never calls the server again for that puzzle. Riverpod providers wrap an API client, a `PuzzleRepository` and a `ProgressStore`.

**Tech Stack:** Go, PostgreSQL 17 (docker compose), pgx v5, sqlc, goose, air, html/template, htmx 2.0.4, Flutter, flutter_riverpod 3.x, http, shared_preferences, path_provider.

**Spec:** `docs/superpowers/specs/2026-10-14-ujredi-monorepo-design.md`

## Not in this plan

- The solving screen (grid, clues, timer, check and reveal). It needs the puzzle JSON schema, which is defined with the creator project. This plan ends with a placeholder puzzle screen. The grid cell, clue row and timer widgets belong to the follow-up plan.
- Auth. The spec says none in dev and requires auth before any deploy.

## Global Constraints

- Go 1.22+ (the `go` directive in `go.mod` may be raised by `go get`, never lowered below 1.22). Routing uses `net/http` method/path patterns.
- Flutter targets iOS and Android only.
- State: Riverpod. Local progress: `shared_preferences`. Local puzzles: JSON files in the app documents directory (`path_provider`).
- Font: Noto Serif Georgian, bundled as an asset.
- Database: PostgreSQL via `pgx` + `sqlc`, migrations with goose. The puzzle is stored as `data jsonb`.
- `compose.yaml` runs Postgres only. The Go server runs natively with `air`.
- Server pages: `html/template` + htmx. No workspace tooling (no Melos, no `go.work`).
- The server checks only that an upload is a well-formed JSON object.
- No auth in dev.
- Reuse widgets. Shared widgets live in `app/lib/shared/`.
- Every git commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Georgian text through the HTTP client. Go sends `application/json` without a charset, and the `http` package decodes `.body` as Latin-1 then. Expected: Georgian titles stay intact. Pinned in Task 7 (`puzzle_api_test.dart`).
- A download that is cut off or returns invalid JSON. Expected: no file is saved, so the next open downloads again. Pinned in Task 7 (`puzzle_repository_test.dart`).
- No published puzzles. Expected: `GET /api/puzzles` returns `[]`, not `null`. Pinned in Task 3.
- Corrupt saved progress. Expected: `ProgressStore.load` returns `null` and the app does not crash. Pinned in Task 7 (`progress_store_test.dart`).
- A puzzle title that contains HTML. Expected: the admin page shows it as text. Pinned in Task 4.

Known gap in the spec: online, the list shows only the server list, so a downloaded puzzle that is later unpublished disappears from the list while its file stays on the device. This plan follows the spec.

---

### Task 1: Repo scaffolding and Postgres

**Files:**
- Create: `.gitignore`, `compose.yaml`, `Makefile`

**Interfaces:**
- Produces: `make tools`, `make db-up`, `make db-down`, `make migrate`, `make test-db`, `make sqlc`, `make dev`, `make test-server`, `make test-app`. Later tasks call these.

- [ ] **Step 1: Create `.gitignore`**

```
.DS_Store
server/tmp/
```

- [ ] **Step 2: Create `compose.yaml`**

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: ujredi
      POSTGRES_PASSWORD: ujredi
      POSTGRES_DB: ujredi
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ujredi -d ujredi"]
      interval: 2s
      timeout: 3s
      retries: 15

volumes:
  pgdata:
```

- [ ] **Step 3: Create `Makefile`** (recipe lines start with a tab character)

```make
GOBIN := $(shell go env GOPATH)/bin
GOOSE := $(GOBIN)/goose
SQLC := $(GOBIN)/sqlc
AIR := $(GOBIN)/air

DATABASE_URL ?= postgres://ujredi:ujredi@localhost:5432/ujredi?sslmode=disable
TEST_DATABASE_URL ?= postgres://ujredi:ujredi@localhost:5432/ujredi_test?sslmode=disable

.PHONY: tools db-up db-down migrate test-db sqlc dev test-server test-app

tools:
	go install github.com/pressly/goose/v3/cmd/goose@latest
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/air-verse/air@latest

db-up:
	docker compose up -d --wait db

db-down:
	docker compose down

migrate: db-up
	$(GOOSE) -dir server/migrations postgres "$(DATABASE_URL)" up

test-db: db-up
	docker compose exec -T db psql -U ujredi -d ujredi -tc "SELECT 1 FROM pg_database WHERE datname='ujredi_test'" | grep -q 1 || docker compose exec -T db psql -U ujredi -d ujredi -c "CREATE DATABASE ujredi_test"
	$(GOOSE) -dir server/migrations postgres "$(TEST_DATABASE_URL)" up

sqlc:
	cd server && $(SQLC) generate

dev: migrate
	cd server && $(AIR)

test-server: test-db
	cd server && TEST_DATABASE_URL="$(TEST_DATABASE_URL)" go test ./...

test-app:
	cd app && flutter test
```

- [ ] **Step 4: Install the tools**

Run: `make tools`
Expected: no errors. `ls ~/go/bin` shows `goose`, `sqlc`, `air`. If `sqlc` fails to build, run `brew install sqlc` and point `SQLC` in the Makefile at `$(shell which sqlc)`.

- [ ] **Step 5: Start Postgres**

Run: `make db-up && docker compose exec -T db psql -U ujredi -d ujredi -c "SELECT 1"`
Expected: the query prints one row with `1`.

- [ ] **Step 6: Commit**

```bash
git add .gitignore compose.yaml Makefile
git commit -m "chore: add compose, Makefile and gitignore"
```

---

### Task 2: Server module, migration and sqlc

**Files:**
- Create: `server/go.mod`, `server/migrations/00001_create_puzzles.sql`, `server/queries/puzzles.sql`, `server/sqlc.yaml`
- Generated: `server/internal/db/*.go`

**Interfaces:**
- Produces (package `ujredi/server/internal/db`):
  - `db.New(db.DBTX) *db.Queries`
  - `CreatePuzzle(ctx, db.CreatePuzzleParams{Title string, Data []byte}) (db.CreatePuzzleRow{ID int64, Status string}, error)`
  - `ListPublishedPuzzles(ctx) ([]db.ListPublishedPuzzlesRow{ID int64, Title string}, error)`
  - `GetPublishedPuzzle(ctx, id int64) ([]byte, error)`
  - `ListAllPuzzles(ctx) ([]db.ListAllPuzzlesRow{ID int64, Title string, Status string}, error)`
  - `SetPuzzleStatus(ctx, db.SetPuzzleStatusParams{ID int64, Status string}) (db.SetPuzzleStatusRow{ID int64, Title string, Status string}, error)`

- [ ] **Step 1: Create the module**

Run: `mkdir -p server/migrations server/queries && cd server && go mod init ujredi/server && go get github.com/jackc/pgx/v5`
Expected: `server/go.mod` exists and lists `pgx/v5`.

- [ ] **Step 2: Create `server/migrations/00001_create_puzzles.sql`**

```sql
-- +goose Up
CREATE TABLE puzzles (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    data       JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE puzzles;
```

- [ ] **Step 3: Create `server/queries/puzzles.sql`**

```sql
-- name: CreatePuzzle :one
INSERT INTO puzzles (title, data)
VALUES ($1, $2)
RETURNING id, status;

-- name: ListPublishedPuzzles :many
SELECT id, title
FROM puzzles
WHERE status = 'published'
ORDER BY id DESC;

-- name: GetPublishedPuzzle :one
SELECT data
FROM puzzles
WHERE id = $1 AND status = 'published';

-- name: ListAllPuzzles :many
SELECT id, title, status
FROM puzzles
ORDER BY id DESC;

-- name: SetPuzzleStatus :one
UPDATE puzzles
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING id, title, status;
```

- [ ] **Step 4: Create `server/sqlc.yaml`**

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "queries"
    schema: "migrations"
    gen:
      go:
        package: "db"
        out: "internal/db"
        sql_package: "pgx/v5"
```

- [ ] **Step 5: Apply the migrations and generate code**

Run: `make migrate test-db sqlc && cd server && go build ./...`
Expected: goose prints `OK 00001_create_puzzles.sql` for both databases. `server/internal/db/` contains `db.go`, `models.go`, `puzzles.sql.go`. The build passes. If a generated name differs from the Interfaces block (for example `CreatePuzzleRow`), fix the Interfaces block and the later tasks before continuing.

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): add puzzles migration and sqlc queries"
```

---

### Task 3: JSON API

**Files:**
- Create: `server/internal/http/server.go`, `server/internal/http/api.go`
- Test: `server/internal/http/api_test.go`

**Interfaces:**
- Consumes: the `db` package from Task 2.
- Produces: `httpserver.New(q *db.Queries) (http.Handler, error)`. Task 4 extends it with the admin routes. Package name is `httpserver`, directory is `internal/http`.

- [ ] **Step 1: Write the failing tests**

Create `server/internal/http/api_test.go`:

```go
package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"ujredi/server/internal/db"
)

type testEnv struct {
	h http.Handler
	q *db.Queries
}

func newTestEnv(t *testing.T) testEnv {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://ujredi:ujredi@localhost:5432/ujredi_test?sslmode=disable"
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, "TRUNCATE puzzles RESTART IDENTITY"); err != nil {
		t.Fatal(err)
	}
	q := db.New(pool)
	h, err := New(q)
	if err != nil {
		t.Fatal(err)
	}
	return testEnv{h: h, q: q}
}

func (e testEnv) do(method, path, body, contentType string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	return rec
}

func (e testEnv) publish(t *testing.T, id int64) {
	t.Helper()
	_, err := e.q.SetPuzzleStatus(context.Background(), db.SetPuzzleStatusParams{ID: id, Status: "published"})
	if err != nil {
		t.Fatal(err)
	}
}

func TestCreatePuzzleStoresDraft(t *testing.T) {
	e := newTestEnv(t)
	rec := e.do("POST", "/api/puzzles", `{"title":"სატესტო","cells":[1,2]}`, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	var got struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != 1 || got.Status != "draft" {
		t.Fatalf("got %+v, want id 1 and status draft", got)
	}
}

func TestCreatePuzzleRejectsNonObjectBodies(t *testing.T) {
	e := newTestEnv(t)
	for _, body := range []string{"", "not json", "[]", "null", `"text"`, "42"} {
		t.Run(fmt.Sprintf("%q", body), func(t *testing.T) {
			rec := e.do("POST", "/api/puzzles", body, "")
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", rec.Code)
			}
			var got struct {
				Error string `json:"error"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.Error == "" {
				t.Fatalf("want a JSON error body, got %q", rec.Body)
			}
		})
	}
}

func TestListIsEmptyArrayWhenNothingIsPublished(t *testing.T) {
	e := newTestEnv(t)
	rec := e.do("GET", "/api/puzzles", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := strings.TrimSpace(rec.Body.String()); got != "[]" {
		t.Fatalf("body = %q, want []", got)
	}
}

func TestDraftPuzzleIsHidden(t *testing.T) {
	e := newTestEnv(t)
	e.do("POST", "/api/puzzles", `{"title":"Draft"}`, "")
	if got := strings.TrimSpace(e.do("GET", "/api/puzzles", "", "").Body.String()); got != "[]" {
		t.Fatalf("list = %q, want []", got)
	}
	if rec := e.do("GET", "/api/puzzles/1", "", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestPublishedPuzzleIsListedAndServed(t *testing.T) {
	e := newTestEnv(t)
	e.do("POST", "/api/puzzles", `{"title":"სატესტო","cells":[1,2]}`, "")
	e.publish(t, 1)

	var list []struct {
		ID    int64  `json:"id"`
		Title string `json:"title"`
	}
	if err := json.Unmarshal(e.do("GET", "/api/puzzles", "", "").Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].ID != 1 || list[0].Title != "სატესტო" {
		t.Fatalf("list = %+v", list)
	}

	rec := e.do("GET", "/api/puzzles/1", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type = %q", ct)
	}
	var data map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &data); err != nil {
		t.Fatal(err)
	}
	if data["title"] != "სატესტო" || data["cells"] == nil {
		t.Fatalf("data = %+v", data)
	}
}

func TestUntitledUploadGetsDefaultTitle(t *testing.T) {
	e := newTestEnv(t)
	e.do("POST", "/api/puzzles", `{"cells":[]}`, "")
	e.publish(t, 1)
	var list []struct {
		Title string `json:"title"`
	}
	json.Unmarshal(e.do("GET", "/api/puzzles", "", "").Body.Bytes(), &list)
	if len(list) != 1 || list[0].Title != "Untitled" {
		t.Fatalf("list = %+v", list)
	}
}

func TestGetPuzzleNotFound(t *testing.T) {
	e := newTestEnv(t)
	for _, path := range []string{"/api/puzzles/999", "/api/puzzles/abc"} {
		if rec := e.do("GET", path, "", ""); rec.Code != http.StatusNotFound {
			t.Fatalf("%s: status = %d, want 404", path, rec.Code)
		}
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make test-server`
Expected: FAIL. The build error says `undefined: New`.

- [ ] **Step 3: Write `server/internal/http/server.go`**

```go
package httpserver

import (
	"encoding/json"
	"log"
	"net/http"

	"ujredi/server/internal/db"
)

type Server struct {
	q *db.Queries
}

func New(q *db.Queries) (http.Handler, error) {
	s := &Server{q: q}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/puzzles", s.createPuzzle)
	mux.HandleFunc("GET /api/puzzles", s.listPuzzles)
	mux.HandleFunc("GET /api/puzzles/{id}", s.getPuzzle)
	return mux, nil
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write json: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func serverError(w http.ResponseWriter, err error) {
	log.Printf("server error: %v", err)
	writeError(w, http.StatusInternalServerError, "internal error")
}
```

- [ ] **Step 4: Write `server/internal/http/api.go`**

```go
package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"

	"ujredi/server/internal/db"
)

const maxUploadBytes = 1 << 20

type puzzleSummary struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

func (s *Server) createPuzzle(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxUploadBytes))
	if err != nil {
		writeError(w, http.StatusBadRequest, "could not read body")
		return
	}
	var obj map[string]any
	if err := json.Unmarshal(body, &obj); err != nil || obj == nil {
		writeError(w, http.StatusBadRequest, "body must be a JSON object")
		return
	}
	title, _ := obj["title"].(string)
	if title == "" {
		title = "Untitled"
	}
	row, err := s.q.CreatePuzzle(r.Context(), db.CreatePuzzleParams{Title: title, Data: body})
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": row.ID, "status": row.Status})
}

func (s *Server) listPuzzles(w http.ResponseWriter, r *http.Request) {
	rows, err := s.q.ListPublishedPuzzles(r.Context())
	if err != nil {
		serverError(w, err)
		return
	}
	out := make([]puzzleSummary, 0, len(rows))
	for _, p := range rows {
		out = append(out, puzzleSummary{ID: p.ID, Title: p.Title})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) getPuzzle(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "puzzle not found")
		return
	}
	data, err := s.q.GetPublishedPuzzle(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "puzzle not found")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd server && go mod tidy && cd .. && make test-server`
Expected: PASS for all tests in `internal/http`.

- [ ] **Step 6: Commit**

```bash
git add server
git commit -m "feat(server): add puzzle JSON API"
```

---

### Task 4: Admin pages

**Files:**
- Create: `server/internal/web/web.go`, `server/internal/web/templates/admin.html`, `server/internal/web/static/htmx.min.js`, `server/internal/http/admin.go`
- Modify: `server/internal/http/server.go`
- Test: `server/internal/http/admin_test.go`

**Interfaces:**
- Consumes: `testEnv`, `newTestEnv`, `do` and `publish` from `api_test.go` (Task 3), and `db.ListAllPuzzles`, `db.SetPuzzleStatus` (Task 2).
- Produces: routes `GET /admin/puzzles`, `PATCH /admin/puzzles/{id}` (form field `status` = `draft` or `published`), `GET /static/`.

- [ ] **Step 1: Write the failing tests**

Create `server/internal/http/admin_test.go`:

```go
package httpserver

import (
	"net/http"
	"strings"
	"testing"
)

const formType = "application/x-www-form-urlencoded"

func TestAdminListShowsEmptyMessage(t *testing.T) {
	e := newTestEnv(t)
	rec := e.do("GET", "/admin/puzzles", "", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "No puzzles yet.") {
		t.Fatalf("body = %s", rec.Body)
	}
}

func TestAdminListEscapesTitles(t *testing.T) {
	e := newTestEnv(t)
	e.do("POST", "/api/puzzles", `{"title":"<script>alert(1)</script>"}`, "")
	body := e.do("GET", "/admin/puzzles", "", "").Body.String()
	if strings.Contains(body, "<script>alert(1)</script>") {
		t.Fatalf("title was not escaped: %s", body)
	}
	if !strings.Contains(body, "&lt;script&gt;") {
		t.Fatalf("escaped title missing: %s", body)
	}
}

func TestAdminPublishSwapsRowAndExposesPuzzle(t *testing.T) {
	e := newTestEnv(t)
	e.do("POST", "/api/puzzles", `{"title":"სატესტო"}`, "")

	rec := e.do("PATCH", "/admin/puzzles/1", "status=published", formType)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	body := rec.Body.String()
	for _, want := range []string{`id="puzzle-1"`, "სატესტო", "published", `hx-patch="/admin/puzzles/1"`, "Unpublish"} {
		if !strings.Contains(body, want) {
			t.Fatalf("row missing %q: %s", want, body)
		}
	}
	if rec := e.do("GET", "/api/puzzles/1", "", ""); rec.Code != http.StatusOK {
		t.Fatalf("published puzzle status = %d", rec.Code)
	}

	e.do("PATCH", "/admin/puzzles/1", "status=draft", formType)
	if rec := e.do("GET", "/api/puzzles/1", "", ""); rec.Code != http.StatusNotFound {
		t.Fatalf("unpublished puzzle status = %d, want 404", rec.Code)
	}
}

func TestAdminPatchRejectsBadInput(t *testing.T) {
	e := newTestEnv(t)
	e.do("POST", "/api/puzzles", `{"title":"A"}`, "")
	if rec := e.do("PATCH", "/admin/puzzles/1", "status=bogus", formType); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad status: got %d, want 400", rec.Code)
	}
	if rec := e.do("PATCH", "/admin/puzzles/999", "status=published", formType); rec.Code != http.StatusNotFound {
		t.Fatalf("unknown id: got %d, want 404", rec.Code)
	}
	if rec := e.do("PATCH", "/admin/puzzles/abc", "status=published", formType); rec.Code != http.StatusNotFound {
		t.Fatalf("bad id: got %d, want 404", rec.Code)
	}
}

func TestStaticServesHtmx(t *testing.T) {
	e := newTestEnv(t)
	rec := e.do("GET", "/static/htmx.min.js", "", "")
	if rec.Code != http.StatusOK || rec.Body.Len() == 0 {
		t.Fatalf("status = %d, len = %d", rec.Code, rec.Body.Len())
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `make test-server`
Expected: FAIL. The admin tests get 404 from the mux, and `TestStaticServesHtmx` fails.

- [ ] **Step 3: Vendor htmx**

Run: `mkdir -p server/internal/web/static server/internal/web/templates && curl -fsSL https://unpkg.com/htmx.org@2.0.4/dist/htmx.min.js -o server/internal/web/static/htmx.min.js && wc -c server/internal/web/static/htmx.min.js`
Expected: a file of about 50 KB.

- [ ] **Step 4: Create `server/internal/web/web.go`**

```go
package web

import (
	"embed"
	"html/template"
	"io/fs"
)

//go:embed templates/*.html
var templateFS embed.FS

//go:embed static
var staticFS embed.FS

func Templates() (*template.Template, error) {
	return template.ParseFS(templateFS, "templates/*.html")
}

func Static() (fs.FS, error) {
	return fs.Sub(staticFS, "static")
}
```

- [ ] **Step 5: Create `server/internal/web/templates/admin.html`**

```html
{{define "row"}}<tr id="puzzle-{{.ID}}">
  <td>{{.ID}}</td>
  <td>{{.Title}}</td>
  <td>{{.Status}}</td>
  <td><button hx-patch="/admin/puzzles/{{.ID}}" hx-vals='{"status": "{{.NextStatus}}"}' hx-target="#puzzle-{{.ID}}" hx-swap="outerHTML">{{.Action}}</button></td>
</tr>{{end}}

{{define "admin"}}<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Puzzles</title>
  <script src="/static/htmx.min.js"></script>
</head>
<body>
  <h1>Puzzles</h1>
  <p id="error" role="alert"></p>
  <table>
    <thead>
      <tr><th>ID</th><th>Title</th><th>Status</th><th></th></tr>
    </thead>
    <tbody hx-on::response-error="document.getElementById('error').textContent = event.detail.xhr.responseText">
      {{range .}}{{template "row" .}}{{else}}<tr><td colspan="4">No puzzles yet.</td></tr>{{end}}
    </tbody>
  </table>
</body>
</html>{{end}}
```

- [ ] **Step 6: Create `server/internal/http/admin.go`**

```go
package httpserver

import (
	"bytes"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"

	"ujredi/server/internal/db"
)

type puzzleRow struct {
	ID     int64
	Title  string
	Status string
}

func (p puzzleRow) NextStatus() string {
	if p.Status == "published" {
		return "draft"
	}
	return "published"
}

func (p puzzleRow) Action() string {
	if p.Status == "published" {
		return "Unpublish"
	}
	return "Publish"
}

func (s *Server) render(w http.ResponseWriter, name string, data any) {
	var buf bytes.Buffer
	if err := s.tmpl.ExecuteTemplate(&buf, name, data); err != nil {
		serverErrorText(w, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	buf.WriteTo(w)
}

func (s *Server) adminList(w http.ResponseWriter, r *http.Request) {
	rows, err := s.q.ListAllPuzzles(r.Context())
	if err != nil {
		serverErrorText(w, err)
		return
	}
	view := make([]puzzleRow, 0, len(rows))
	for _, p := range rows {
		view = append(view, puzzleRow{ID: p.ID, Title: p.Title, Status: p.Status})
	}
	s.render(w, "admin", view)
}

func (s *Server) adminSetStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "puzzle not found", http.StatusNotFound)
		return
	}
	status := r.FormValue("status")
	if status != "draft" && status != "published" {
		http.Error(w, "status must be draft or published", http.StatusBadRequest)
		return
	}
	p, err := s.q.SetPuzzleStatus(r.Context(), db.SetPuzzleStatusParams{ID: id, Status: status})
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "puzzle not found", http.StatusNotFound)
		return
	}
	if err != nil {
		serverErrorText(w, err)
		return
	}
	s.render(w, "row", puzzleRow{ID: p.ID, Title: p.Title, Status: p.Status})
}
```

- [ ] **Step 7: Update `server/internal/http/server.go`**

Replace the imports, the `Server` struct, `New`, and add `serverErrorText`:

```go
package httpserver

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"

	"ujredi/server/internal/db"
	"ujredi/server/internal/web"
)

type Server struct {
	q    *db.Queries
	tmpl *template.Template
}

func New(q *db.Queries) (http.Handler, error) {
	tmpl, err := web.Templates()
	if err != nil {
		return nil, err
	}
	static, err := web.Static()
	if err != nil {
		return nil, err
	}
	s := &Server{q: q, tmpl: tmpl}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/puzzles", s.createPuzzle)
	mux.HandleFunc("GET /api/puzzles", s.listPuzzles)
	mux.HandleFunc("GET /api/puzzles/{id}", s.getPuzzle)
	mux.HandleFunc("GET /admin/puzzles", s.adminList)
	mux.HandleFunc("PATCH /admin/puzzles/{id}", s.adminSetStatus)
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServerFS(static)))
	return mux, nil
}

func serverErrorText(w http.ResponseWriter, err error) {
	log.Printf("server error: %v", err)
	http.Error(w, "internal error", http.StatusInternalServerError)
}
```

Keep `writeJSON`, `writeError` and `serverError` unchanged below it.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `make test-server`
Expected: PASS for all tests in `internal/http`, including the Task 3 tests.

- [ ] **Step 9: Commit**

```bash
git add server
git commit -m "feat(server): add htmx admin pages"
```

---

### Task 5: Server entrypoint, air and end-to-end check

**Files:**
- Create: `server/cmd/server/main.go`, `server/.air.toml`

**Interfaces:**
- Consumes: `httpserver.New` (Task 3 and 4), `db.New` (Task 2).
- Produces: a server on `:8080` (env `PORT`), reading `DATABASE_URL`.

- [ ] **Step 1: Create `server/cmd/server/main.go`**

```go
package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"ujredi/server/internal/db"
	httpserver "ujredi/server/internal/http"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	ctx := context.Background()
	dsn := getenv("DATABASE_URL", "postgres://ujredi:ujredi@localhost:5432/ujredi?sslmode=disable")
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		log.Fatal(err)
	}
	if err := pool.Ping(ctx); err != nil {
		log.Fatal(err)
	}

	handler, err := httpserver.New(db.New(pool))
	if err != nil {
		log.Fatal(err)
	}

	addr := ":" + getenv("PORT", "8080")
	log.Printf("listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, handler))
}
```

- [ ] **Step 2: Create `server/.air.toml`**

```toml
root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/server ./cmd/server"
  bin = "./tmp/server"
  include_ext = ["go", "html", "sql"]
  exclude_dir = ["tmp"]
```

- [ ] **Step 3: Run the server under air**

Run in the background: `make dev`
Expected: air builds the server and logs `listening on :8080`.

- [ ] **Step 4: Check the API end to end**

Run:
```bash
curl -s -X POST localhost:8080/api/puzzles -d '{"title":"კროსვორდი","cells":[1,2]}'
curl -s localhost:8080/api/puzzles
curl -s -X PATCH localhost:8080/admin/puzzles/1 -d 'status=published' | head -5
curl -s localhost:8080/api/puzzles
curl -s localhost:8080/api/puzzles/1
```
Expected, in order: `{"id":1,"status":"draft"}`, then `[]`, then an HTML `<tr id="puzzle-1">` row, then `[{"id":1,"title":"კროსვორდი"}]`, then the puzzle JSON. If the table already has rows from earlier runs, the ids differ. Use the id from the first response.

- [ ] **Step 5: Check the reload and the inline error**

Edit the log line in `main.go` to say `serving on`. Expected: air rebuilds and the log shows the new text. Revert the edit. Then open `http://localhost:8080/admin/puzzles` in a browser and confirm the row shows. Delete the row with `docker compose exec -T db psql -U ujredi -d ujredi -c "DELETE FROM puzzles"` and click its button. Expected: the text `puzzle not found` appears above the table. If you cannot use a browser, ask the user to do this check and say that it is unverified.

- [ ] **Step 6: Stop air and commit**

```bash
git add server
git commit -m "feat(server): add entrypoint and air config"
```

---

### Task 6: Flutter scaffold, dependencies and font

**Files:**
- Create: `app/` (by `flutter create`), `app/assets/fonts/NotoSerifGeorgian.ttf`, `app/assets/fonts/OFL.txt`, `app/lib/shared/theme.dart`
- Modify: `app/pubspec.yaml`, `app/android/app/src/debug/AndroidManifest.xml`
- Delete: `app/test/widget_test.dart`

**Interfaces:**
- Produces: `buildTheme() -> ThemeData` in `package:ujredi/shared/theme.dart`. The package name is `ujredi`.

- [ ] **Step 1: Create the Flutter project**

Run: `flutter create --org com.ujredi --project-name ujredi --platforms=ios,android app`
Expected: `app/` exists with `ios/` and `android/` and no other platform folders.

- [ ] **Step 2: Add the dependencies**

Run: `cd app && flutter pub add flutter_riverpod http shared_preferences path_provider`
Expected: `pubspec.yaml` lists all four. `flutter_riverpod` is 3.x.

- [ ] **Step 3: Download the font and its license**

Run:
```bash
mkdir -p app/assets/fonts
curl -fsSL "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifgeorgian/NotoSerifGeorgian%5Bwdth%2Cwght%5D.ttf" -o app/assets/fonts/NotoSerifGeorgian.ttf
curl -fsSL "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifgeorgian/OFL.txt" -o app/assets/fonts/OFL.txt
ls -l app/assets/fonts
```
Expected: both files exist and are not empty.

- [ ] **Step 4: Register the font in `app/pubspec.yaml`**

Under the existing `flutter:` key, after `uses-material-design: true`, add:

```yaml
  fonts:
    - family: NotoSerifGeorgian
      fonts:
        - asset: assets/fonts/NotoSerifGeorgian.ttf
```

- [ ] **Step 5: Allow cleartext HTTP in debug builds**

Android 9+ blocks `http://` by default, and the dev server has no TLS. Open `app/android/app/src/debug/AndroidManifest.xml`. Add an `<application>` element with the flag inside `<manifest>`. Keep the `INTERNET` permission line that Flutter generated:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <application android:usesCleartextTraffic="true"/>
</manifest>
```

- [ ] **Step 6: Create `app/lib/shared/theme.dart`**

```dart
import 'package:flutter/material.dart';

ThemeData buildTheme() {
  return ThemeData(
    fontFamily: 'NotoSerifGeorgian',
    colorSchemeSeed: Colors.indigo,
    useMaterial3: true,
  );
}
```

- [ ] **Step 7: Remove the generated counter test and check the project**

Run: `rm app/test/widget_test.dart && cd app && flutter analyze`
Expected: `flutter analyze` reports no errors. Warnings about the unused default `main.dart` content are fine, because Task 8 replaces it.

- [ ] **Step 8: Commit**

```bash
git add app
git commit -m "chore(app): scaffold Flutter app with font and dependencies"
```

---

### Task 7: Data layer (API client, repository, progress store)

**Files:**
- Create: `app/lib/data/puzzle_models.dart`, `app/lib/data/puzzle_api.dart`, `app/lib/data/puzzle_repository.dart`, `app/lib/data/progress_store.dart`
- Test: `app/test/data/puzzle_api_test.dart`, `app/test/data/puzzle_repository_test.dart`, `app/test/data/progress_store_test.dart`

**Interfaces:**
- Produces:
  - `class PuzzleSummary { const PuzzleSummary({required int id, required String title}); factory PuzzleSummary.fromJson(Map<String, dynamic>) }`
  - `class PuzzleListItem { const PuzzleListItem({required int id, required String title, required bool downloaded}) }`
  - `abstract interface class PuzzleApi { Future<List<PuzzleSummary>> list(); Future<String> fetch(int id); }`
  - `class PuzzleApiException implements Exception`
  - `class HttpPuzzleApi implements PuzzleApi { HttpPuzzleApi({required http.Client client, required String baseUrl}) }`
  - `class PuzzleRepository { PuzzleRepository({required PuzzleApi api, required Directory directory}); Future<String> load(int id); Future<List<PuzzleListItem>> list(); }`
  - `class PuzzleProgress { const PuzzleProgress({required Map<String, String> cells, required int elapsedSeconds}) }`
  - `abstract interface class ProgressStore { Future<PuzzleProgress?> load(int puzzleId); Future<void> save(int puzzleId, PuzzleProgress progress); }`
  - `class SharedPreferencesProgressStore implements ProgressStore { SharedPreferencesProgressStore(SharedPreferences prefs) }`

- [ ] **Step 1: Write the failing API client tests**

Create `app/test/data/puzzle_api_test.dart`:

```dart
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ujredi/data/puzzle_api.dart';

http.Response _json(String body, [int status = 200]) => http.Response.bytes(
      utf8.encode(body),
      status,
      headers: {'content-type': 'application/json'},
    );

void main() {
  test('list decodes Georgian text as UTF-8 when the response has no charset', () async {
    final client = MockClient((_) async => _json('[{"id":1,"title":"კროსვორდი"}]'));
    final api = HttpPuzzleApi(client: client, baseUrl: 'http://server');

    final list = await api.list();

    expect(list.single.id, 1);
    expect(list.single.title, 'კროსვორდი');
  });

  test('fetch returns the raw puzzle JSON and keeps Georgian text', () async {
    late Uri requested;
    final client = MockClient((request) async {
      requested = request.url;
      return _json('{"title":"კროსვორდი"}');
    });
    final api = HttpPuzzleApi(client: client, baseUrl: 'http://server');

    final body = await api.fetch(7);

    expect(requested.toString(), 'http://server/api/puzzles/7');
    expect(jsonDecode(body)['title'], 'კროსვორდი');
  });

  test('a non-200 response throws PuzzleApiException', () async {
    final client = MockClient((_) async => _json('{"error":"puzzle not found"}', 404));
    final api = HttpPuzzleApi(client: client, baseUrl: 'http://server');

    expect(api.fetch(1), throwsA(isA<PuzzleApiException>()));
    expect(api.list(), throwsA(isA<PuzzleApiException>()));
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && flutter test test/data/puzzle_api_test.dart`
Expected: FAIL. The file `package:ujredi/data/puzzle_api.dart` does not exist.

- [ ] **Step 3: Create `app/lib/data/puzzle_models.dart`**

```dart
class PuzzleSummary {
  const PuzzleSummary({required this.id, required this.title});

  final int id;
  final String title;

  factory PuzzleSummary.fromJson(Map<String, dynamic> json) {
    return PuzzleSummary(id: json['id'] as int, title: json['title'] as String);
  }
}

class PuzzleListItem {
  const PuzzleListItem({
    required this.id,
    required this.title,
    required this.downloaded,
  });

  final int id;
  final String title;
  final bool downloaded;
}
```

- [ ] **Step 4: Create `app/lib/data/puzzle_api.dart`**

```dart
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'puzzle_models.dart';

abstract interface class PuzzleApi {
  Future<List<PuzzleSummary>> list();
  Future<String> fetch(int id);
}

class PuzzleApiException implements Exception {
  PuzzleApiException(this.message);

  final String message;

  @override
  String toString() => 'PuzzleApiException: $message';
}

class HttpPuzzleApi implements PuzzleApi {
  HttpPuzzleApi({required http.Client client, required String baseUrl})
      : _client = client,
        _baseUrl = baseUrl;

  final http.Client _client;
  final String _baseUrl;

  Future<String> _get(String path) async {
    final response = await _client
        .get(Uri.parse('$_baseUrl$path'))
        .timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) {
      throw PuzzleApiException('GET $path failed with ${response.statusCode}');
    }
    // The server sends application/json without a charset, so decode the bytes as UTF-8.
    return utf8.decode(response.bodyBytes);
  }

  @override
  Future<List<PuzzleSummary>> list() async {
    final items = jsonDecode(await _get('/api/puzzles')) as List<dynamic>;
    return [
      for (final item in items)
        PuzzleSummary.fromJson(item as Map<String, dynamic>),
    ];
  }

  @override
  Future<String> fetch(int id) => _get('/api/puzzles/$id');
}
```

- [ ] **Step 5: Run the API tests to verify they pass**

Run: `cd app && flutter test test/data/puzzle_api_test.dart`
Expected: PASS, 3 tests.

- [ ] **Step 6: Write the failing repository tests**

Create `app/test/data/puzzle_repository_test.dart`:

```dart
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ujredi/data/puzzle_api.dart';
import 'package:ujredi/data/puzzle_models.dart';
import 'package:ujredi/data/puzzle_repository.dart';

class FakeApi implements PuzzleApi {
  FakeApi({this.summaries = const [], this.puzzles = const {}});

  final List<PuzzleSummary> summaries;
  final Map<int, String> puzzles;
  bool failing = false;
  int fetchCount = 0;

  @override
  Future<List<PuzzleSummary>> list() async {
    if (failing) throw PuzzleApiException('offline');
    return summaries;
  }

  @override
  Future<String> fetch(int id) async {
    fetchCount++;
    if (failing) throw PuzzleApiException('offline');
    return puzzles[id]!;
  }
}

String _puzzle(String title) => jsonEncode({'title': title, 'cells': []});

void main() {
  late Directory root;
  late Directory dir;

  setUp(() {
    root = Directory.systemTemp.createTempSync('ujredi_test');
    dir = Directory('${root.path}/puzzles');
  });

  tearDown(() => root.deleteSync(recursive: true));

  test('load downloads once and then reads from disk', () async {
    final api = FakeApi(puzzles: {1: _puzzle('ა')});
    final repo = PuzzleRepository(api: api, directory: dir);

    final first = await repo.load(1);
    api.failing = true;
    final second = await repo.load(1);

    expect(second, first);
    expect(api.fetchCount, 1);
    expect(File('${dir.path}/1.json').existsSync(), isTrue);
  });

  test('load does not save invalid JSON', () async {
    final api = FakeApi(puzzles: {1: '{"title": "cut off'});
    final repo = PuzzleRepository(api: api, directory: dir);

    await expectLater(repo.load(1), throwsFormatException);

    expect(File('${dir.path}/1.json').existsSync(), isFalse);
    expect(dir.existsSync() ? dir.listSync() : <FileSystemEntity>[], isEmpty);
  });

  test('list online marks downloaded puzzles', () async {
    final api = FakeApi(
      summaries: const [
        PuzzleSummary(id: 2, title: 'ბ'),
        PuzzleSummary(id: 1, title: 'ა'),
      ],
      puzzles: {1: _puzzle('ა')},
    );
    final repo = PuzzleRepository(api: api, directory: dir);
    await repo.load(1);

    final items = await repo.list();

    expect(items.map((i) => i.id), [2, 1]);
    expect(items.map((i) => i.downloaded), [false, true]);
  });

  test('list offline returns downloaded puzzles with titles, newest first', () async {
    final api = FakeApi(puzzles: {1: _puzzle('ა'), 3: _puzzle('გ')});
    final repo = PuzzleRepository(api: api, directory: dir);
    await repo.load(1);
    await repo.load(3);
    api.failing = true;

    final items = await repo.list();

    expect(items.map((i) => i.id), [3, 1]);
    expect(items.map((i) => i.title), ['გ', 'ა']);
    expect(items.every((i) => i.downloaded), isTrue);
  });

  test('list offline with nothing downloaded rethrows the error', () async {
    final api = FakeApi()..failing = true;
    final repo = PuzzleRepository(api: api, directory: dir);

    await expectLater(repo.list(), throwsA(isA<PuzzleApiException>()));
  });

  test('list offline skips corrupt files and temp files', () async {
    final api = FakeApi(puzzles: {1: _puzzle('ა')});
    final repo = PuzzleRepository(api: api, directory: dir);
    await repo.load(1);
    File('${dir.path}/2.json').writeAsStringSync('not json');
    File('${dir.path}/3.json.tmp').writeAsStringSync(_puzzle('გ'));
    api.failing = true;

    final items = await repo.list();

    expect(items.map((i) => i.id), [1]);
  });
}
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `cd app && flutter test test/data/puzzle_repository_test.dart`
Expected: FAIL. `package:ujredi/data/puzzle_repository.dart` does not exist.

- [ ] **Step 8: Create `app/lib/data/puzzle_repository.dart`**

```dart
import 'dart:convert';
import 'dart:io';

import 'puzzle_api.dart';
import 'puzzle_models.dart';

class PuzzleRepository {
  PuzzleRepository({required PuzzleApi api, required Directory directory})
      : _api = api,
        _directory = directory;

  final PuzzleApi _api;
  final Directory _directory;

  File _file(int id) => File('${_directory.path}/$id.json');

  /// Returns the puzzle JSON. Reads the saved file if there is one, otherwise
  /// downloads the puzzle and saves it.
  Future<String> load(int id) async {
    final file = _file(id);
    if (await file.exists()) return file.readAsString();

    final json = await _api.fetch(id);
    jsonDecode(json); // Throws FormatException if the download is not valid JSON.

    await _directory.create(recursive: true);
    final temp = File('${file.path}.tmp');
    await temp.writeAsString(json, flush: true);
    await temp.rename(file.path);
    return json;
  }

  /// Returns the server list. If the server cannot be reached, returns the
  /// downloaded puzzles. If there are none, rethrows the error.
  Future<List<PuzzleListItem>> list() async {
    final local = await _localTitles();
    try {
      final remote = await _api.list();
      return [
        for (final summary in remote)
          PuzzleListItem(
            id: summary.id,
            title: summary.title,
            downloaded: local.containsKey(summary.id),
          ),
      ];
    } on Exception {
      if (local.isEmpty) rethrow;
      final ids = local.keys.toList()..sort((a, b) => b.compareTo(a));
      return [
        for (final id in ids)
          PuzzleListItem(id: id, title: local[id]!, downloaded: true),
      ];
    }
  }

  Future<Map<int, String>> _localTitles() async {
    if (!await _directory.exists()) return {};
    final titles = <int, String>{};
    await for (final entity in _directory.list()) {
      if (entity is! File) continue;
      final name = entity.uri.pathSegments.last;
      if (!name.endsWith('.json')) continue;
      final id = int.tryParse(name.substring(0, name.length - '.json'.length));
      if (id == null) continue;
      try {
        final data = jsonDecode(await entity.readAsString());
        final title = data is Map ? data['title'] : null;
        titles[id] = title is String && title.isNotEmpty ? title : 'Untitled';
      } on FormatException {
        continue;
      }
    }
    return titles;
  }
}
```

- [ ] **Step 9: Run the repository tests to verify they pass**

Run: `cd app && flutter test test/data/puzzle_repository_test.dart`
Expected: PASS, 6 tests.

- [ ] **Step 10: Write the failing progress store tests**

Create `app/test/data/progress_store_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ujredi/data/progress_store.dart';

Future<SharedPreferencesProgressStore> _store(Map<String, Object> initial) async {
  SharedPreferences.setMockInitialValues(initial);
  return SharedPreferencesProgressStore(await SharedPreferences.getInstance());
}

void main() {
  test('load returns null when nothing is saved', () async {
    final store = await _store({});
    expect(await store.load(1), isNull);
  });

  test('save then load returns the same progress', () async {
    final store = await _store({});
    await store.save(
      1,
      const PuzzleProgress(cells: {'0,1': 'ა', '2,3': 'ბ'}, elapsedSeconds: 95),
    );

    final loaded = await store.load(1);

    expect(loaded!.cells, {'0,1': 'ა', '2,3': 'ბ'});
    expect(loaded.elapsedSeconds, 95);
  });

  test('progress is kept per puzzle id', () async {
    final store = await _store({});
    await store.save(1, const PuzzleProgress(cells: {'0,0': 'ა'}, elapsedSeconds: 1));
    await store.save(2, const PuzzleProgress(cells: {}, elapsedSeconds: 2));

    expect((await store.load(1))!.elapsedSeconds, 1);
    expect((await store.load(2))!.elapsedSeconds, 2);
  });

  test('corrupt saved progress loads as null', () async {
    final store = await _store({'progress.1': 'not json', 'progress.2': '{"cells": 5}'});

    expect(await store.load(1), isNull);
    expect(await store.load(2), isNull);
  });
}
```

- [ ] **Step 11: Run the tests to verify they fail**

Run: `cd app && flutter test test/data/progress_store_test.dart`
Expected: FAIL. `package:ujredi/data/progress_store.dart` does not exist.

- [ ] **Step 12: Create `app/lib/data/progress_store.dart`**

```dart
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class PuzzleProgress {
  const PuzzleProgress({required this.cells, required this.elapsedSeconds});

  /// Filled cells. The key format (for example "row,col") is defined with the
  /// puzzle JSON schema. The value is the letter in the cell.
  final Map<String, String> cells;
  final int elapsedSeconds;
}

abstract interface class ProgressStore {
  Future<PuzzleProgress?> load(int puzzleId);
  Future<void> save(int puzzleId, PuzzleProgress progress);
}

class SharedPreferencesProgressStore implements ProgressStore {
  SharedPreferencesProgressStore(this._prefs);

  final SharedPreferences _prefs;

  String _key(int puzzleId) => 'progress.$puzzleId';

  @override
  Future<PuzzleProgress?> load(int puzzleId) async {
    final raw = _prefs.getString(_key(puzzleId));
    if (raw == null) return null;
    try {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      return PuzzleProgress(
        cells: Map<String, String>.from(data['cells'] as Map),
        elapsedSeconds: data['elapsedSeconds'] as int,
      );
    } on FormatException {
      return null;
    } on TypeError {
      return null;
    }
  }

  @override
  Future<void> save(int puzzleId, PuzzleProgress progress) async {
    await _prefs.setString(
      _key(puzzleId),
      jsonEncode({
        'cells': progress.cells,
        'elapsedSeconds': progress.elapsedSeconds,
      }),
    );
  }
}
```

- [ ] **Step 13: Run all data tests to verify they pass**

Run: `cd app && flutter test test/data`
Expected: PASS, 13 tests.

- [ ] **Step 14: Commit**

```bash
git add app
git commit -m "feat(app): add API client, puzzle repository and progress store"
```

---

### Task 8: Providers, shared widgets and screens

**Files:**
- Create: `app/lib/data/providers.dart`, `app/lib/shared/error_retry.dart`, `app/lib/shared/puzzle_tile.dart`, `app/lib/features/puzzle_list/puzzle_list_screen.dart`, `app/lib/features/puzzle/puzzle_screen.dart`, `app/lib/app.dart`
- Modify: `app/lib/main.dart` (replace the generated content)
- Test: `app/test/features/puzzle_list_screen_test.dart`, `app/test/shared/puzzle_tile_test.dart`

**Interfaces:**
- Consumes: everything from Task 7, and `buildTheme()` from Task 6.
- Produces:
  - `puzzleRepositoryProvider` (`Provider<PuzzleRepository>`, throws until overridden), `progressStoreProvider` (`Provider<ProgressStore>`, throws until overridden)
  - `puzzleListProvider` (`FutureProvider<List<PuzzleListItem>>`), `puzzleJsonProvider` (`FutureProvider.family<String, int>`)
  - `ErrorRetry({required String message, required VoidCallback onRetry})`
  - `PuzzleTile({required PuzzleListItem item, required VoidCallback onTap})`
  - `PuzzleListScreen`, `PuzzleScreen({required PuzzleListItem item})`, `UjrediApp`

- [ ] **Step 1: Write the failing widget tests**

Create `app/test/shared/puzzle_tile_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ujredi/data/puzzle_models.dart';
import 'package:ujredi/shared/puzzle_tile.dart';

Widget _wrap(PuzzleListItem item) => MaterialApp(
      home: Scaffold(body: PuzzleTile(item: item, onTap: () {})),
    );

void main() {
  testWidgets('shows the title and a download icon for a new puzzle', (tester) async {
    await tester.pumpWidget(_wrap(const PuzzleListItem(id: 1, title: 'კროსვორდი', downloaded: false)));

    expect(find.text('კროსვორდი'), findsOneWidget);
    expect(find.byIcon(Icons.cloud_download_outlined), findsOneWidget);
    expect(find.byIcon(Icons.download_done), findsNothing);
  });

  testWidgets('shows a done icon for a downloaded puzzle', (tester) async {
    await tester.pumpWidget(_wrap(const PuzzleListItem(id: 1, title: 'ა', downloaded: true)));

    expect(find.byIcon(Icons.download_done), findsOneWidget);
  });
}
```

Create `app/test/features/puzzle_list_screen_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ujredi/data/providers.dart';
import 'package:ujredi/data/puzzle_models.dart';
import 'package:ujredi/data/puzzle_repository.dart';
import 'package:ujredi/features/puzzle_list/puzzle_list_screen.dart';

class FakeRepository implements PuzzleRepository {
  FakeRepository({this.items = const [], this.failuresBeforeSuccess = 0});

  final List<PuzzleListItem> items;
  int failuresBeforeSuccess;
  final loaded = <int>[];

  @override
  Future<List<PuzzleListItem>> list() async {
    if (failuresBeforeSuccess > 0) {
      failuresBeforeSuccess--;
      throw Exception('offline');
    }
    return items;
  }

  @override
  Future<String> load(int id) async {
    loaded.add(id);
    return '{"title":"x"}';
  }
}

Widget _app(FakeRepository repository) => ProviderScope(
      retry: (retryCount, error) => null,
      overrides: [puzzleRepositoryProvider.overrideWithValue(repository)],
      child: const MaterialApp(home: PuzzleListScreen()),
    );

void main() {
  testWidgets('shows the puzzles from the repository', (tester) async {
    final repository = FakeRepository(items: const [
      PuzzleListItem(id: 2, title: 'ბ', downloaded: false),
      PuzzleListItem(id: 1, title: 'ა', downloaded: true),
    ]);

    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();

    expect(find.text('ა'), findsOneWidget);
    expect(find.text('ბ'), findsOneWidget);
  });

  testWidgets('shows a message when there are no puzzles', (tester) async {
    await tester.pumpWidget(_app(FakeRepository()));
    await tester.pumpAndSettle();

    expect(find.text('No puzzles yet'), findsOneWidget);
  });

  testWidgets('shows an error and loads the list again on retry', (tester) async {
    final repository = FakeRepository(
      items: const [PuzzleListItem(id: 1, title: 'ა', downloaded: false)],
      failuresBeforeSuccess: 1,
    );

    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    expect(find.text('Could not load puzzles'), findsOneWidget);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    expect(find.text('ა'), findsOneWidget);
  });

  testWidgets('tapping a puzzle opens it', (tester) async {
    final repository = FakeRepository(items: const [
      PuzzleListItem(id: 1, title: 'ა', downloaded: false),
    ]);

    await tester.pumpWidget(_app(repository));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ა'));
    await tester.pumpAndSettle();

    expect(repository.loaded, [1]);
    expect(find.text('Puzzle ready'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && flutter test test/shared test/features`
Expected: FAIL. The imported files do not exist.

- [ ] **Step 3: Create `app/lib/data/providers.dart`**

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'progress_store.dart';
import 'puzzle_models.dart';
import 'puzzle_repository.dart';

/// Overridden in `main()` and in tests.
final puzzleRepositoryProvider = Provider<PuzzleRepository>(
  (ref) => throw UnimplementedError('Override puzzleRepositoryProvider'),
);

/// Overridden in `main()` and in tests.
final progressStoreProvider = Provider<ProgressStore>(
  (ref) => throw UnimplementedError('Override progressStoreProvider'),
);

final puzzleListProvider = FutureProvider<List<PuzzleListItem>>(
  (ref) => ref.watch(puzzleRepositoryProvider).list(),
);

final puzzleJsonProvider = FutureProvider.family<String, int>(
  (ref, id) => ref.watch(puzzleRepositoryProvider).load(id),
);
```

- [ ] **Step 4: Create `app/lib/shared/error_retry.dart`**

```dart
import 'package:flutter/material.dart';

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
```

- [ ] **Step 5: Create `app/lib/shared/puzzle_tile.dart`**

```dart
import 'package:flutter/material.dart';

import '../data/puzzle_models.dart';

class PuzzleTile extends StatelessWidget {
  const PuzzleTile({super.key, required this.item, required this.onTap});

  final PuzzleListItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(item.title),
      trailing: Icon(
        item.downloaded ? Icons.download_done : Icons.cloud_download_outlined,
      ),
      onTap: onTap,
    );
  }
}
```

- [ ] **Step 6: Create `app/lib/features/puzzle/puzzle_screen.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../../data/puzzle_models.dart';
import '../../shared/error_retry.dart';

/// Placeholder. The grid, clues and timer are built after the puzzle JSON
/// schema is defined.
class PuzzleScreen extends ConsumerWidget {
  const PuzzleScreen({super.key, required this.item});

  final PuzzleListItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final puzzle = ref.watch(puzzleJsonProvider(item.id));
    return Scaffold(
      appBar: AppBar(title: Text(item.title)),
      body: puzzle.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorRetry(
          message: 'Could not download puzzle',
          onRetry: () => ref.invalidate(puzzleJsonProvider(item.id)),
        ),
        data: (_) => const Center(child: Text('Puzzle ready')),
      ),
    );
  }
}
```

- [ ] **Step 7: Create `app/lib/features/puzzle_list/puzzle_list_screen.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/providers.dart';
import '../../shared/error_retry.dart';
import '../../shared/puzzle_tile.dart';
import '../puzzle/puzzle_screen.dart';

class PuzzleListScreen extends ConsumerWidget {
  const PuzzleListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final puzzles = ref.watch(puzzleListProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Ujredi')),
      body: puzzles.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ErrorRetry(
          message: 'Could not load puzzles',
          onRetry: () => ref.invalidate(puzzleListProvider),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('No puzzles yet'));
          }
          return ListView(
            children: [
              for (final item in items)
                PuzzleTile(
                  item: item,
                  onTap: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => PuzzleScreen(item: item),
                      ),
                    );
                    ref.invalidate(puzzleListProvider);
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 8: Create `app/lib/app.dart`**

```dart
import 'package:flutter/material.dart';

import 'features/puzzle_list/puzzle_list_screen.dart';
import 'shared/theme.dart';

class UjrediApp extends StatelessWidget {
  const UjrediApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ujredi',
      theme: buildTheme(),
      home: const PuzzleListScreen(),
    );
  }
}
```

- [ ] **Step 9: Replace `app/lib/main.dart`**

```dart
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'data/progress_store.dart';
import 'data/providers.dart';
import 'data/puzzle_api.dart';
import 'data/puzzle_repository.dart';

const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:8080',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final documents = await getApplicationDocumentsDirectory();
  final prefs = await SharedPreferences.getInstance();

  final repository = PuzzleRepository(
    api: HttpPuzzleApi(client: http.Client(), baseUrl: _apiBaseUrl),
    directory: Directory('${documents.path}/puzzles'),
  );

  runApp(
    ProviderScope(
      retry: (retryCount, error) => null,
      overrides: [
        puzzleRepositoryProvider.overrideWithValue(repository),
        progressStoreProvider.overrideWithValue(SharedPreferencesProgressStore(prefs)),
      ],
      child: const UjrediApp(),
    ),
  );
}
```

- [ ] **Step 10: Run all app tests and analyze**

Run: `cd app && flutter test && flutter analyze`
Expected: all tests PASS (13 data tests plus 6 widget tests) and `flutter analyze` reports no issues.

- [ ] **Step 11: Commit**

```bash
git add app
git commit -m "feat(app): add providers, puzzle list and placeholder puzzle screen"
```

---

### Task 9: End-to-end check on a simulator

**Files:** none changed. This task verifies the whole stack.

- [ ] **Step 1: Start the server with a published Georgian puzzle**

Run: `make dev` in the background. Then:
```bash
curl -s -X POST localhost:8080/api/puzzles -d '{"title":"კროსვორდი","cells":[]}'
curl -s -X PATCH localhost:8080/admin/puzzles/1 -d 'status=published' >/dev/null
```
Use the id from the first response if it is not 1.
Expected: `curl -s localhost:8080/api/puzzles` returns the puzzle.

- [ ] **Step 2: Run the app on the iOS simulator**

Run: `open -a Simulator`, then `cd app && flutter run -d <ios-simulator-id> --dart-define=API_BASE_URL=http://localhost:8080`. Find the id with `flutter devices`.
Expected: the list shows "კროსვორდი" in Noto Serif Georgian with a cloud-download icon. To see the screen, run `xcrun simctl io booted screenshot <scratchpad>/list.png` and read the image.

- [ ] **Step 3: Check the download and the offline list**

Tap the puzzle. Expected: the placeholder screen shows "Puzzle ready". Go back. Expected: the icon changes to the done icon. Stop the server. Pull to restart the app (hot restart with `R`). Expected: the list still shows the puzzle, because it is downloaded. Tap it. Expected: "Puzzle ready" shows without the server.

- [ ] **Step 4: Check the Android emulator**

Run: `flutter run -d <android-emulator-id> --dart-define=API_BASE_URL=http://10.0.2.2:8080` with the server running.
Expected: the same list as on iOS. If no emulator is installed, say that this check was skipped. Do not claim it passed.

- [ ] **Step 5: Report**

Report which of steps 2 to 4 you ran and what you saw. If you could not see the simulator screen, ask the user to confirm steps 2 and 3.
