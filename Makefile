GOBIN := $(shell go env GOPATH)/bin
GOOSE := $(GOBIN)/goose
SQLC := $(GOBIN)/sqlc
AIR := $(GOBIN)/air

DATABASE_URL ?= postgres://ujredi:ujredi@localhost:5432/ujredi?sslmode=disable

.PHONY: tools db-up db-down migrate sqlc dev test-server test-app perf-app dev-creator build-creator

tools:
	go install github.com/pressly/goose/v3/cmd/goose@latest
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/air-verse/air@latest

db-up:
	docker compose up -d --wait db

db-down:
	docker compose down

migrate: db-up
	$(GOOSE) -dir server/migrations postgres "$(DATABASE_URL)" up

sqlc:
	cd server && $(SQLC) generate

dev: db-up
	cd server && $(AIR)

test-server:
	cd server && go test ./...

test-app:
	cd app && flutter test

perf-app:
	cd app && flutter drive --driver=test_driver/perf_driver.dart --target=integration_test/grid_perf_test.dart --profile --no-dds

dev-creator:
	cd creator && pnpm dev

build-creator:
	cd creator && pnpm build
