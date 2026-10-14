package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"ujredi/creator/server/internal/api"
	"ujredi/creator/server/internal/fill"
	"ujredi/creator/server/internal/words"

	_ "modernc.org/sqlite"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	ctx := context.Background()
	path := getenv("WORDS_DB", "data/words.db")
	db, err := sql.Open("sqlite", "file:"+path+"?mode=ro")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	all, err := words.All(ctx, db)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("loaded %d words from %s", len(all), path)

	timeout, err := time.ParseDuration(getenv("FILL_TIMEOUT", "20s"))
	if err != nil {
		log.Fatalf("FILL_TIMEOUT: %v", err)
	}
	handlers := &api.API{DB: db, FillTimeout: timeout}
	if bin, err := fill.FindBinary(os.Getenv("INGRID_BIN")); err != nil {
		log.Printf("warning: ingrid_core not found, /api/fill is disabled (cargo install ingrid_core): %v", err)
	} else {
		log.Printf("filling with %s, timeout %s", bin, timeout)
		handlers.Filler = &fill.Filler{Bin: bin, Words: all}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			http.Error(w, "db unavailable", http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte("ok"))
	})
	handlers.Register(mux)

	addr := ":" + getenv("PORT", "8081")
	log.Printf("listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}
