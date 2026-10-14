// Package fill fills crossword grids by running the ingrid_core CLI.
package fill

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math/rand/v2"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"ujredi/creator/server/internal/words"
)

// Grids are square, from MinGridSize to MaxGridSize cells per side.
const (
	MinGridSize = 3
	MaxGridSize = 14
)

var ErrUnfillable = errors.New("grid is unfillable")

// Each source has a band of 10 scores. Words from better sources always score
// higher than words from worse ones, so ingrid_core prefers them. The random
// offset inside a band gives a different fill on every call.
var sourceScore = map[string]int{"zigzagi": 70, "gnc": 60, "unimorph": 50}

type Filler struct {
	Bin   string
	Words []words.Word
}

// FindBinary returns the path of the ingrid_core binary. It uses configured
// when set, then PATH, then ~/.cargo/bin.
func FindBinary(configured string) (string, error) {
	if configured != "" {
		return exec.LookPath(configured)
	}
	if path, err := exec.LookPath("ingrid_core"); err == nil {
		return path, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return exec.LookPath(filepath.Join(home, ".cargo", "bin", "ingrid_core"))
}

// ValidateGrid checks that rows is a square grid of `#`, `.` and Georgian letters.
func ValidateGrid(rows []string) error {
	size := len(rows)
	if size < MinGridSize || size > MaxGridSize {
		return fmt.Errorf("grid must have %d to %d rows", MinGridSize, MaxGridSize)
	}
	for i, row := range rows {
		if utf8.RuneCountInString(row) != size {
			return fmt.Errorf("row %d must have %d cells", i, size)
		}
		for _, r := range row {
			if r != '#' && r != '.' && !words.IsGeorgianLetter(r) {
				return fmt.Errorf("row %d has an invalid cell %q", i, r)
			}
		}
	}
	return nil
}

// Fill fills the `.` cells of rows. Letters already in rows stay as they are.
// It returns ErrUnfillable when no fill exists, and the context error when ctx
// ends first.
func (f *Filler) Fill(ctx context.Context, rows []string) ([]string, error) {
	dir, err := os.MkdirTemp("", "fill-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)

	wordlist := filepath.Join(dir, "words.txt")
	grid := filepath.Join(dir, "grid.txt")
	if err := os.WriteFile(wordlist, f.wordlist(), 0o600); err != nil {
		return nil, err
	}
	if err := os.WriteFile(grid, []byte(strings.Join(rows, "\n")+"\n"), 0o600); err != nil {
		return nil, err
	}

	cmd := exec.CommandContext(ctx, f.Bin, "--wordlist", wordlist, grid)
	cmd.WaitDelay = time.Second
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	err = cmd.Run()

	if ctxErr := ctx.Err(); ctxErr != nil {
		return nil, ctxErr
	}
	if err != nil {
		if strings.Contains(stderr.String()+stdout.String(), "Unfillable") {
			return nil, ErrUnfillable
		}
		return nil, fmt.Errorf("ingrid_core: %w: %s", err, strings.TrimSpace(stderr.String()))
	}

	filled := strings.Fields(stdout.String())
	if err := ValidateGrid(filled); err != nil {
		return nil, fmt.Errorf("ingrid_core output: %w", err)
	}
	return filled, nil
}

// wordlist returns the word list in ingrid_core format, `word;score` per line.
func (f *Filler) wordlist() []byte {
	var b bytes.Buffer
	for _, w := range f.Words {
		fmt.Fprintf(&b, "%s;%d\n", w.Word, sourceScore[w.Source]+rand.IntN(10))
	}
	return b.Bytes()
}
