package fill

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"ujredi/creator/server/internal/words"

	_ "modernc.org/sqlite"
)

const dotRow = "............."

func dotGrid() []string {
	rows := make([]string, GridSize)
	for i := range rows {
		rows[i] = dotRow
	}
	return rows
}

// stub writes a shell script that stands in for ingrid_core.
func stub(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "ingrid_core")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"+body), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

func filledGrid() string {
	return strings.Repeat("ააააააააააააა\n", GridSize)
}

func TestFillSuccess(t *testing.T) {
	seen := filepath.Join(t.TempDir(), "seen.txt")
	bin := stub(t, `cp "$2" "`+seen+"\"\ncat <<'EOF'\n"+filledGrid()+"EOF\n")
	f := &Filler{Bin: bin, Words: []words.Word{
		{Word: "მგელი", Source: "zigzagi"},
		{Word: "მგლის", Source: "gnc"},
		{Word: "მგელთა", Source: "unimorph"},
	}}

	got, err := f.Fill(context.Background(), dotGrid())
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != GridSize || got[0] != "ააააააააააააა" {
		t.Errorf("unexpected grid %v", got)
	}

	data, err := os.ReadFile(seen)
	if err != nil {
		t.Fatal(err)
	}
	bands := map[string][2]int{"მგელი": {70, 79}, "მგლის": {60, 69}, "მგელთა": {50, 59}}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 3 {
		t.Fatalf("wordlist has %d lines, want 3", len(lines))
	}
	for _, line := range lines {
		word, score, _ := strings.Cut(line, ";")
		n, err := strconv.Atoi(score)
		band := bands[word]
		if err != nil || n < band[0] || n > band[1] {
			t.Errorf("%q has score %q, want %d to %d", word, score, band[0], band[1])
		}
	}
}

func TestFillUnfillable(t *testing.T) {
	f := &Filler{Bin: stub(t, "echo 'Error: Unfillable grid' >&2\nexit 1\n")}
	if _, err := f.Fill(context.Background(), dotGrid()); !errors.Is(err, ErrUnfillable) {
		t.Errorf("got %v, want ErrUnfillable", err)
	}
}

func TestFillTimeout(t *testing.T) {
	f := &Filler{Bin: stub(t, "exec sleep 10\n")}
	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := f.Fill(ctx, dotGrid())
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("got %v, want DeadlineExceeded", err)
	}
	if time.Since(start) > 3*time.Second {
		t.Errorf("took %v, the process was not killed", time.Since(start))
	}
}

func TestFillOtherError(t *testing.T) {
	f := &Filler{Bin: stub(t, "echo boom >&2\nexit 2\n")}
	_, err := f.Fill(context.Background(), dotGrid())
	if err == nil || errors.Is(err, ErrUnfillable) || !strings.Contains(err.Error(), "boom") {
		t.Errorf("got %v, want an error containing the stderr text", err)
	}
}

func TestValidateGrid(t *testing.T) {
	if err := ValidateGrid(dotGrid()); err != nil {
		t.Errorf("valid grid: %v", err)
	}
	bad := map[string][]string{
		"too few rows":  dotGrid()[:12],
		"short row":     append(dotGrid()[:12], "..........."),
		"latin letter":  append(dotGrid()[:12], "abcdefghijklm"),
		"digit":         append(dotGrid()[:12], "1............"),
		"too many rows": append(dotGrid(), dotRow),
	}
	for name, rows := range bad {
		if err := ValidateGrid(rows); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

// The real binary and the real word list, with a word typed into the grid.
// Skipped when ingrid_core or words.db is missing.
func TestFillRealBinary(t *testing.T) {
	bin, err := FindBinary("")
	if err != nil {
		t.Skip("ingrid_core not installed")
	}
	db, err := sql.Open("sqlite", "file:../../data/words.db?mode=ro")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	all, err := words.All(context.Background(), db)
	if err != nil || len(all) == 0 {
		t.Skip("words.db not available")
	}

	// A loose grid with the word კავად typed into its first slot in row 1.
	rows := []string{
		"#...###......", "#კავად#......", "......#......", "...#...#....#",
		".....#....###", "....##...#...", "....#...#....", "...#...##....",
		"###....#.....", "#....#...#...", "......#......", "......#.....#",
		"......###...#",
	}
	f := &Filler{Bin: bin, Words: all}
	got, err := f.Fill(context.Background(), rows)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(got[1], "#კავად#") {
		t.Errorf("typed word was not kept: %q", got[1])
	}
	for i, row := range got {
		want, have := []rune(rows[i]), []rune(row)
		for j := range have {
			if (want[j] == '#') != (have[j] == '#') {
				t.Fatalf("black cells changed at row %d", i)
			}
		}
	}
	for _, row := range got {
		if strings.Contains(row, ".") {
			t.Errorf("grid still has empty cells: %q", row)
		}
	}
}
