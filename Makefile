.PHONY: help install setup test coverage install-hooks restore-history lint clean

# Default target
help:
	@echo "Chrome Tab Manager - Makefile"
	@echo ""
	@echo "Primary Tool:"
	@echo "  Chrome Extension - One-click organize & dedupe (see chrome-extension/README.md)"
	@echo ""
	@echo "Chrome Extension Development:"
	@echo "  make setup           - Install npm dependencies (Jest for testing)"
	@echo "  make test            - Run Jest unit tests"
	@echo "  make coverage        - Run Jest tests with code coverage report"
	@echo "  make install-hooks   - Install Git pre-commit hooks"
	@echo ""
	@echo "Command-Line Tools:"
	@echo "  make install         - Install dependencies using uv"
	@echo "  make restore-history - Restore tabs from Chrome browsing history"
	@echo "  make lint            - Run pylint on Python code"
	@echo "  make clean           - Remove virtual environment"
	@echo ""
	@echo "Recommended workflow:"
	@echo "  1. Install the Chrome Extension (chrome-extension/)"
	@echo "  2. Click 'Organize by Domain' to group tabs"
	@echo "  3. Click 'Remove Duplicates' to dedupe"
	@echo "  4. Use 'make restore-history' to recover lost tabs if needed"

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

# Install dependencies using uv
install:
	@echo "Installing dependencies with uv..."
	@command -v uv >/dev/null 2>&1 || { echo "Error: uv is not installed. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
	uv venv
	uv pip install -r requirements.txt
	@echo ""
	@echo "Installation complete!"
	@echo ""
	@echo "Next step: Install Chrome Extension from chrome-extension/ directory"
	@echo "See chrome-extension/README.md for instructions"

# Restore tabs from Chrome history
restore-history:
	@echo "Restoring tabs from Chrome browsing history..."
	@echo "This will restore the last 7 days of browsing history (max 200 URLs)"
	@echo ""
	@echo "Note: Chrome must be running with remote debugging for this to work."
	@echo "If this fails, use the Chrome Extension instead."
	@echo ""
	@command -v uv >/dev/null 2>&1 || { echo "Error: uv is not installed. Run 'make install' first"; exit 1; }
	uv run restore_from_history.py

# Run pylint on Python code
lint:
	@echo "Running pylint on Python code..."
	@command -v uv >/dev/null 2>&1 || { echo "Error: uv is not installed. Run 'make install' first"; exit 1; }
	uv run pylint restore_from_history.py

# Clean up virtual environment
clean:
	@echo "Removing virtual environment..."
	rm -rf .venv
	@echo "Clean complete"
