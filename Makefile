.PHONY: help setup test test-e2e test-e2e-headless coverage install-hooks

# Default target
help:
	@echo "Chrome Tab Manager - Makefile"
	@echo ""
	@echo "Chrome Extension Development:"
	@echo "  make setup           - Install npm dependencies (Jest for testing)"
	@echo "  make test            - Run Jest unit tests"
	@echo "  make test-e2e        - Run Puppeteer E2E tests (headed - visible browser)"
	@echo "  make test-e2e-headless - Run Puppeteer E2E tests (headless - no browser window)"
	@echo "  make coverage        - Run Jest tests with code coverage report"
	@echo "  make install-hooks   - Install Git pre-commit hooks"
	@echo ""
	@echo "Recommended workflow:"
	@echo "  1. Install the Chrome Extension (chrome-extension/)"
	@echo "  2. Click 'Organize by Domain' to group tabs"
	@echo "  3. Click 'Remove Duplicates' to dedupe"

# Install npm dependencies for Chrome Extension development
setup:
	@echo "Installing npm dependencies for Chrome Extension..."
	@command -v npm >/dev/null 2>&1 || { echo "Error: npm is not installed. Install Node.js from: https://nodejs.org/"; exit 1; }
	cd chrome-extension && npm install
	@echo ""
	@echo "Setup complete!"
	@echo ""
	@echo "Run 'make test' to run unit tests"

# Run Jest unit tests
test:
	@echo "Running Jest unit tests..."
	@command -v npm >/dev/null 2>&1 || { echo "Error: npm is not installed. Run 'make setup' first"; exit 1; }
	cd chrome-extension && npm test

# Run Puppeteer end-to-end tests (headed - visible browser)
test-e2e:
	@echo "Running Puppeteer end-to-end tests (headed mode - browser visible)..."
	@command -v npm >/dev/null 2>&1 || { echo "Error: npm is not installed. Run 'make setup' first"; exit 1; }
	cd chrome-extension && npm run test:e2e

# Run Puppeteer end-to-end tests (headless - no browser window)
test-e2e-headless:
	@echo "Running Puppeteer end-to-end tests (headless mode - no browser window)..."
	@command -v npm >/dev/null 2>&1 || { echo "Error: npm is not installed. Run 'make setup' first"; exit 1; }
	cd chrome-extension && HEADLESS=true npm run test:e2e

# Run Jest tests with code coverage
coverage:
	@echo "Running Jest tests with code coverage..."
	@command -v npm >/dev/null 2>&1 || { echo "Error: npm is not installed. Run 'make setup' first"; exit 1; }
	cd chrome-extension && npm run coverage
	@echo ""
	@echo "Coverage report generated in chrome-extension/coverage/"
	@echo "  - HTML report: chrome-extension/coverage/lcov-report/index.html"
	@echo "  - LCOV data:   chrome-extension/coverage/lcov.info"

# Install Git pre-commit hooks
install-hooks:
	@echo "Installing Git pre-commit hooks..."
	@./scripts/install-hooks.sh
