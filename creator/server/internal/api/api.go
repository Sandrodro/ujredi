// Package api serves the creator's HTTP endpoints.
package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"ujredi/creator/server/internal/fill"
	"ujredi/creator/server/internal/words"
)

type API struct {
	DB *sql.DB
	// Filler is nil when the ingrid_core binary was not found.
	Filler      *fill.Filler
	FillTimeout time.Duration
}

func (a *API) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/fill", a.fill)
	mux.HandleFunc("GET /api/candidates", a.candidates)
}

type errorBody struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("write response: %v", err)
	}
}

func (a *API) fill(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Rows []string `json:"rows"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody{"invalid JSON"})
		return
	}
	if err := fill.ValidateGrid(body.Rows); err != nil {
		writeJSON(w, http.StatusBadRequest, errorBody{err.Error()})
		return
	}
	if a.Filler == nil {
		writeJSON(w, http.StatusServiceUnavailable, errorBody{"unavailable"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), a.FillTimeout)
	defer cancel()
	filled, err := a.Filler.Fill(ctx, body.Rows)
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, map[string][]string{"rows": filled})
	case errors.Is(err, fill.ErrUnfillable):
		writeJSON(w, http.StatusUnprocessableEntity, errorBody{"unfillable"})
	case errors.Is(err, context.DeadlineExceeded):
		writeJSON(w, http.StatusGatewayTimeout, errorBody{"timeout"})
	case errors.Is(err, context.Canceled):
		// The client left. Nothing to answer.
	default:
		log.Printf("fill: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody{"internal"})
	}
}

func (a *API) candidates(w http.ResponseWriter, r *http.Request) {
	pattern := r.URL.Query().Get("pattern")
	if !words.ValidPattern(pattern) {
		writeJSON(w, http.StatusBadRequest, errorBody{"pattern must be 3 to 13 Georgian letters or dots"})
		return
	}
	found, err := words.Candidates(r.Context(), a.DB, pattern)
	if err != nil {
		log.Printf("candidates: %v", err)
		writeJSON(w, http.StatusInternalServerError, errorBody{"internal"})
		return
	}
	writeJSON(w, http.StatusOK, map[string][]words.Word{"words": found})
}
