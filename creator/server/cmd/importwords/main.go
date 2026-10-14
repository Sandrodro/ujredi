// importwords rebuilds data/words.db from the source files in data/raw and
// data/sources. Run it through `make words`.
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"unicode/utf8"

	_ "modernc.org/sqlite"
)

type source struct {
	name  string
	files []string
	read  func(io.Reader) ([]string, error)
}

func main() {
	dataDir := flag.String("data", "data", "data directory")
	flag.Parse()

	// A word keeps the first source that adds it, so the order matters.
	sources := []source{
		{"zigzagi", []string{"sources/zigzagi_lemmas.csv"}, csvWords},
		{"gnc", []string{"raw/ka_gnc-ud-train.conllu", "raw/ka_gnc-ud-dev.conllu", "raw/ka_gnc-ud-test.conllu"}, conlluWords},
		{"unimorph", []string{"raw/unimorph_kat.tsv"}, unimorphWords},
	}

	out := filepath.Join(*dataDir, "words.db")
	if err := os.Remove(out); err != nil && !os.IsNotExist(err) {
		log.Fatal(err)
	}
	db, err := sql.Open("sqlite", out)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	_, err = db.Exec(`
		CREATE TABLE words (
			word   TEXT PRIMARY KEY,
			length INTEGER NOT NULL,
			source TEXT NOT NULL
		);
		CREATE INDEX words_length_idx ON words (length);`)
	if err != nil {
		log.Fatal(err)
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	insert, err := tx.Prepare("INSERT OR IGNORE INTO words (word, length, source) VALUES (?, ?, ?)")
	if err != nil {
		log.Fatal(err)
	}

	for _, src := range sources {
		added := 0
		for _, file := range src.files {
			f, err := os.Open(filepath.Join(*dataDir, file))
			if err != nil {
				log.Fatal(err)
			}
			words, err := src.read(f)
			f.Close()
			if err != nil {
				log.Fatalf("%s: %v", file, err)
			}
			for _, w := range words {
				if !accept(w) {
					continue
				}
				res, err := insert.Exec(w, utf8.RuneCountInString(w), src.name)
				if err != nil {
					log.Fatal(err)
				}
				if n, _ := res.RowsAffected(); n > 0 {
					added++
				}
			}
		}
		fmt.Printf("%-9s +%d new words\n", src.name, added)
	}
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}

	var total int
	if err := db.QueryRow("SELECT count(*) FROM words").Scan(&total); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("total     %d words\n", total)
}
