package main

import (
	"reflect"
	"strings"
	"testing"
)

func TestAccept(t *testing.T) {
	cases := map[string]bool{
		"მგელი": true,
		"აა":    false, // too short
		"ააა":   true,
		"ააააააააააააა":   true,  // 13 letters
		"აააააააააააააა":  false, // 14 letters
		"გამარჯობა ყველა": false, // two words
		"abcდ":   false,
		"მგელი2": false,
		"მგელი.": false,
		"":       false,
	}
	for word, want := range cases {
		if got := accept(word); got != want {
			t.Errorf("accept(%q) = %v, want %v", word, got, want)
		}
	}
}

func TestConlluWords(t *testing.T) {
	input := strings.Join([]string{
		"# sent_id = 1",
		"1\tცილი\tცილი\tNOUN\tN_Nom_Sg\t_\t0\troot\t_\t_",
		"2\t,\t,\tPUNCT\tPunct\t_\t1\tpunct\t_\t_",
		"3\t12\t12\tNUM\tNum\t_\t1\tnmod\t_\t_",
		"4-5\tშემიძლია\t_\t_\t_\t_\t_\t_\t_\t_",
		"4\tშემიძლია\tშეძლება\tVERB\tV\t_\t1\tacl\t_\t_",
		"",
	}, "\n")
	got, err := conlluWords(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"ცილი", "ცილი", "შემიძლია", "შეძლება"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestUnimorphWords(t *testing.T) {
	got, err := unimorphWords(strings.NewReader("შეუძლია\tშემიძლია\tV;ARGNO1S\nbad line\n"))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"შეუძლია", "შემიძლია"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}
