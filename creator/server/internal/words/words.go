// Package words reads the word list in words.db.
package words

import (
	"context"
	"database/sql"
	"strings"
	"unicode/utf8"
)

const (
	MinLength  = 3
	MaxLength  = 13
	maxResults = 200
)

type Word struct {
	Word   string `json:"word"`
	Source string `json:"source"`
}

// IsGeorgianLetter reports whether r is a letter of the modern Georgian alphabet.
func IsGeorgianLetter(r rune) bool { return r >= 'ა' && r <= 'ჰ' }

// All returns every word in the list.
func All(ctx context.Context, db *sql.DB) ([]Word, error) {
	rows, err := db.QueryContext(ctx, "SELECT word, source FROM words")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var all []Word
	for rows.Next() {
		var w Word
		if err := rows.Scan(&w.Word, &w.Source); err != nil {
			return nil, err
		}
		all = append(all, w)
	}
	return all, rows.Err()
}

// ValidPattern reports whether pattern is 3 to 13 characters, each a Georgian
// letter or `.` (any letter).
func ValidPattern(pattern string) bool {
	n := utf8.RuneCountInString(pattern)
	if n < MinLength || n > MaxLength {
		return false
	}
	for _, r := range pattern {
		if r != '.' && !IsGeorgianLetter(r) {
			return false
		}
	}
	return true
}

// Candidates returns the words that match pattern, best source first. The
// caller must check pattern with ValidPattern.
func Candidates(ctx context.Context, db *sql.DB, pattern string) ([]Word, error) {
	like := strings.ReplaceAll(pattern, ".", "_")
	rows, err := db.QueryContext(ctx, `
		SELECT word, source FROM words
		WHERE length = ? AND word LIKE ?
		ORDER BY CASE source WHEN 'zigzagi' THEN 0 WHEN 'gnc' THEN 1 ELSE 2 END, word
		LIMIT ?`, utf8.RuneCountInString(pattern), like, maxResults)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	found := []Word{}
	for rows.Next() {
		var w Word
		if err := rows.Scan(&w.Word, &w.Source); err != nil {
			return nil, err
		}
		found = append(found, w)
	}
	return found, rows.Err()
}
