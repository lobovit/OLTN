# OLTN — build and publish shortcuts
# `make publish` builds and pushes the static site to oltnclient.github.io.

.DEFAULT_GOAL := help
.PHONY: help dev build test typecheck publish

help:
	@echo "Targets:"
	@echo "  make dev        start the dev server (http://localhost:5173)"
	@echo "  make build      typecheck and build into dist/"
	@echo "  make test       run the full test suite"
	@echo "  make typecheck  tsc --noEmit"
	@echo "  make publish    build and publish to https://oltnclient.github.io"

dev:
	npm run dev

build:
	npm run build

test:
	npm test

typecheck:
	npm run typecheck

publish: build
	node scripts/deploy-pages.mjs
