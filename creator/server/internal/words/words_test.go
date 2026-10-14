package words

import (
	"context"
	"database/sql"
	"path/filepath"
	"reflect"
	"testing"

	_ "modernc.org/sqlite"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "words.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	_, err = db.Exec(`
		CREATE TABLE words (word TEXT PRIMARY KEY, length INTEGER NOT NULL, source TEXT NOT NULL);
		INSERT INTO words VALUES
			('მგელი', 5, 'unimorph'),
			('მგლის', 5, 'gnc'),
			('მაგარი', 6, 'zigzagi'),
			('მგელთა', 6, 'unimorph'),
			('კვერი', 5, 'zigzagi');`)
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func TestCandidates(t *testing.T) {
	db := testDB(t)
	cases := map[string][]string{
		"მგ...": {"მგლის", "მგელი"}, // gnc before unimorph
		"..ე.ი": {"კვერი", "მგელი"}, // zigzagi before unimorph
		"კვერი": {"კვერი"},
		"ზზზზზ": {},
	}

	for pattern, want := range cases {
		got, err := Candidates(context.Background(), db, pattern)
		if err != nil {
			t.Fatal(err)
		}
		words := []string{}
		for _, w := range got {
			words = append(words, w.Word)
		}
		if !reflect.DeepEqual(words, want) {
			t.Errorf("Candidates(%q) = %v, want %v", pattern, words, want)
		}
	}
}

func TestValidPattern(t *testing.T) {
	cases := map[string]bool{
		"მგ...": true,
		"აბგ":   true,
		"აბ":    false,
		"ააააააააააააა":  true,
		"აააააააააააააა": false,
		"მგ%..": false,
		"მგ_..": false,
		"abc":   false,
	}
	for pattern, want := range cases {
		if got := ValidPattern(pattern); got != want {
			t.Errorf("ValidPattern(%q) = %v, want %v", pattern, got, want)
		}
	}
}
