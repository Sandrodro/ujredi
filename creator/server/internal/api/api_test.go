package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"ujredi/creator/server/internal/fill"

	_ "modernc.org/sqlite"
)

func newAPI(t *testing.T, stubBody string) *API {
	t.Helper()
	dir := t.TempDir()
	db, err := sql.Open("sqlite", filepath.Join(dir, "words.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	_, err = db.Exec(`
		CREATE TABLE words (word TEXT PRIMARY KEY, length INTEGER NOT NULL, source TEXT NOT NULL);
		INSERT INTO words VALUES ('მგელი', 5, 'gnc'), ('მგლის', 5, 'unimorph');`)
	if err != nil {
		t.Fatal(err)
	}

	a := &API{DB: db, FillTimeout: time.Second}
	if stubBody != "" {
		bin := filepath.Join(dir, "ingrid_core")
		if err := os.WriteFile(bin, []byte("#!/bin/sh\n"+stubBody), 0o755); err != nil {
			t.Fatal(err)
		}
		a.Filler = &fill.Filler{Bin: bin}
	}
	return a
}

func gridJSON(rows []string) string {
	data, _ := json.Marshal(map[string][]string{"rows": rows})
	return string(data)
}

func dotRows() []string {
	rows := make([]string, 13)
	for i := range rows {
		rows[i] = strings.Repeat(".", 13)
	}
	return rows
}

func do(a *API, method, target, body string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	a.Register(mux)
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	return rec
}

func TestFill(t *testing.T) {
	filled := strings.Repeat("ააააააააააააა\n", 13)
	cases := []struct {
		name   string
		stub   string
		body   string
		status int
		error  string
	}{
		{"ok", "cat <<'EOF'\n" + filled + "EOF\n", gridJSON(dotRows()), 200, ""},
		{"unfillable", "echo 'Error: Unfillable grid' >&2\nexit 1\n", gridJSON(dotRows()), 422, "unfillable"},
		{"timeout", "exec sleep 10\n", gridJSON(dotRows()), 504, "timeout"},
		{"no binary", "", gridJSON(dotRows()), 503, "unavailable"},
		{"bad json", "exit 0\n", "not json", 400, "invalid JSON"},
		{"bad grid", "exit 0\n", gridJSON(dotRows()[:5]), 400, ""},
		{"latin letter", "exit 0\n", gridJSON(append(dotRows()[:12], "abcdefghijklm")), 400, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := do(newAPI(t, c.stub), "POST", "/api/fill", c.body)
			if rec.Code != c.status {
				t.Fatalf("status %d, want %d: %s", rec.Code, c.status, rec.Body)
			}
			var got struct {
				Rows  []string `json:"rows"`
				Error string   `json:"error"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if c.status == 200 && len(got.Rows) != 13 {
				t.Errorf("got %d rows, want 13", len(got.Rows))
			}
			if c.error != "" && got.Error != c.error {
				t.Errorf("error %q, want %q", got.Error, c.error)
			}
		})
	}
}

func TestCandidates(t *testing.T) {
	a := newAPI(t, "")
	rec := do(a, "GET", "/api/candidates?pattern="+url.QueryEscape("მგ..."), "")
	if rec.Code != 200 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var got struct {
		Words []struct{ Word, Source string } `json:"words"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Words) != 2 || got.Words[0].Word != "მგელი" || got.Words[0].Source != "gnc" {
		t.Errorf("unexpected words %+v", got.Words)
	}

	for _, pattern := range []string{"", "აბ", "abc", "მგ%.."} {
		rec := do(a, "GET", "/api/candidates?pattern="+url.QueryEscape(pattern), "")
		if rec.Code != 400 {
			t.Errorf("pattern %q: status %d, want 400", pattern, rec.Code)
		}
	}
}
