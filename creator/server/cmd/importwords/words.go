package main

import (
	"bufio"
	"io"
	"strings"
	"unicode/utf8"
)

const (
	minLength = 3
	maxLength = 13
)

// accept reports whether word can go into a 13x13 grid: Georgian letters only,
// 3 to 13 letters. This also rejects multi-word forms, digits and punctuation.
func accept(word string) bool {
	n := utf8.RuneCountInString(word)
	if n < minLength || n > maxLength {
		return false
	}
	for _, r := range word {
		if r < 'ა' || r > 'ჰ' {
			return false
		}
	}
	return true
}

// UPOS tags in the treebank that never make crossword answers.
var skippedTags = map[string]bool{"PUNCT": true, "NUM": true, "SYM": true, "X": true}

// conlluWords returns the FORM and LEMMA of every token line in a CoNLL-U file.
func conlluWords(r io.Reader) ([]string, error) {
	var words []string
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" || line[0] == '#' {
			continue
		}
		cols := strings.Split(line, "\t")
		if len(cols) < 4 || strings.ContainsAny(cols[0], "-.") || skippedTags[cols[3]] {
			continue
		}
		words = append(words, cols[1], cols[2])
	}
	return words, scanner.Err()
}

// unimorphWords returns the lemma and the inflected form of every line in a
// UniMorph file (`lemma<TAB>form<TAB>tags`).
func unimorphWords(r io.Reader) ([]string, error) {
	var words []string
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		cols := strings.Split(scanner.Text(), "\t")
		if len(cols) < 2 {
			continue
		}
		words = append(words, cols[0], cols[1])
	}
	return words, scanner.Err()
}

// csvWords returns the first column of each line of a CSV file.
func csvWords(r io.Reader) ([]string, error) {
	var words []string
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		word, _, _ := strings.Cut(scanner.Text(), ",")
		words = append(words, word)
	}
	return words, scanner.Err()
}
