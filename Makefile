# Variables
APP_NAME  := ksau-ts
VERSION   ?= $(shell cat VERSION)
COMMIT    := $(shell git rev-parse --short HEAD)
DATE      := $(shell date -u +%Y-%m-%d)

DEFINE_FLAGS := \
	--define BUILD_VERSION='"$(VERSION)"' \
	--define BUILD_COMMIT='"$(COMMIT)"' \
	--define BUILD_DATE='"$(DATE)"'

ASSET_FLAGS := \
	--asset src/crypto/privkey.pem \
	--asset src/crypto/passphrase.txt

# Default target
all: build

# Local dev build (current platform)
build:
	@echo "Building $(APP_NAME)..."
	bun build src/main.ts \
		--compile \
		--minify \
		$(DEFINE_FLAGS) \
		$(ASSET_FLAGS) \
		--outfile $(APP_NAME)

# Only to be used in GitHub Actions
build_gh_actions:
	@echo "notice: this is meant to be used in workflows"
	bun build src/main.ts --compile --minify $(DEFINE_FLAGS) $(ASSET_FLAGS) --target bun-linux-x64    --outfile $(APP_NAME)-linux-x64
	bun build src/main.ts --compile --minify $(DEFINE_FLAGS) $(ASSET_FLAGS) --target bun-linux-arm64  --outfile $(APP_NAME)-linux-arm64
	bun build src/main.ts --compile --minify $(DEFINE_FLAGS) $(ASSET_FLAGS) --target bun-windows-x64  --outfile $(APP_NAME)-windows-x64.exe
	bun build src/main.ts --compile --minify $(DEFINE_FLAGS) $(ASSET_FLAGS) --target bun-darwin-x64   --outfile $(APP_NAME)-darwin-x64
	bun build src/main.ts --compile --minify $(DEFINE_FLAGS) $(ASSET_FLAGS) --target bun-darwin-arm64 --outfile $(APP_NAME)-darwin-arm64

# Display version information
version:
	@echo "Version: $(VERSION)"
	@echo "Commit:  $(COMMIT)"
	@echo "Date:    $(DATE)"

# Clean up binaries
clean:
	@echo "Cleaning up..."
	rm -f $(APP_NAME) \
		$(APP_NAME)-linux-x64 \
		$(APP_NAME)-linux-arm64 \
		$(APP_NAME)-windows-x64.exe \
		$(APP_NAME)-darwin-x64 \
		$(APP_NAME)-darwin-arm64

# Help
help:
	@echo "Makefile Commands:"
	@echo "  all               - Build the application (default target)"
	@echo "  build             - Build for the current platform"
	@echo "  build_gh_actions  - Build all 5 Bun targets (intended for GitHub Actions)"
	@echo "  version           - Show version, commit, and date info"
	@echo "  clean             - Remove built binaries"
	@echo "  help              - Show this help message"

.PHONY: all build build_gh_actions version clean help
