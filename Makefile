.PHONY: help install run chrome-debug chrome-restart check-chrome clean kill-chrome backup-tabs restore-tabs restore-history full-workflow organize-domain organize-category organize-interactive

# Default target
help:
	@echo "Chrome Tab Consolidator - Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  make install              - Install dependencies using uv"
	@echo "  make backup-tabs          - Backup tabs from your current Chrome session"
	@echo "  make chrome-restart       - Quit Chrome and restart with remote debugging"
	@echo "  make restore-tabs         - Restore backed-up tabs into debug Chrome"
	@echo "  make restore-history      - Restore tabs from Chrome browsing history"
	@echo "  make run                  - Run the tab consolidator (deduplicate)"
	@echo "  make organize-domain      - Analyze and report tabs grouped by domain"
	@echo "  make organize-interactive - Interactive guide to group tabs step-by-step"
	@echo "  make organize-category    - Organize tabs by category (coming soon)"
	@echo "  make full-workflow        - Complete workflow: backup -> restart -> restore -> dedupe"
	@echo "  make check-chrome         - Check if Chrome debugging is accessible"
	@echo "  make kill-chrome          - Kill all Chrome processes"
	@echo "  make clean                - Remove virtual environment and backups"
	@echo ""
	@echo "Recommended workflow:"
	@echo "  1. make install"
	@echo "  2. make full-workflow (does everything automatically)"
	@echo "  3. make organize-domain (analyze tab organization)"
	@echo ""
	@echo "Or step by step:"
	@echo "  1. make backup-tabs"
	@echo "  2. make chrome-restart"
	@echo "  3. make restore-tabs"
	@echo "  4. make run"
	@echo "  5. make organize-domain"

# Install dependencies using uv
install:
	@echo "Installing dependencies with uv..."
	@command -v uv >/dev/null 2>&1 || { echo "Error: uv is not installed. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
	uv venv
	uv pip install -r requirements.txt
	@echo ""
	@echo "Installation complete!"
	@echo "Run 'make chrome-debug' to start Chrome, then 'make run' to consolidate tabs"

# Kill all Chrome processes
kill-chrome:
	@echo "Killing all Chrome processes..."
	@pkill -9 "Google Chrome" 2>/dev/null || echo "No Chrome processes found"
	@sleep 1
	@echo "Chrome processes terminated"

# Restart Chrome with remote debugging (kills existing Chrome first)
chrome-restart:
	@echo "⚠️  WARNING: Chrome remote debugging limitation!"
	@echo ""
	@echo "Chrome requires a separate user data directory for remote debugging."
	@echo "This means Chrome will start with a FRESH PROFILE (no existing tabs/bookmarks)."
	@echo ""
	@echo "To consolidate tabs from your main Chrome profile, you would need to:"
	@echo "  1. Use a Chrome extension instead of this script, OR"
	@echo "  2. Manually export/import tab lists"
	@echo ""
	@echo "This script is best for managing tabs in a debug Chrome instance."
	@echo ""
	@read -p "Continue with fresh Chrome profile? [y/N] " -n 1 -r; \
	echo ""; \
	if [[ ! $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "Cancelled."; \
		exit 1; \
	fi
	@$(MAKE) kill-chrome
	@echo ""
	@echo "Starting Chrome with remote debugging on port 9222..."
	@echo "Creating temporary user data directory..."
	@mkdir -p /tmp/chrome-debug-profile
	@echo "Waiting for Chrome to start..."
	@/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
		--remote-debugging-port=9222 \
		--user-data-dir=/tmp/chrome-debug-profile \
		--remote-allow-origins=http://localhost:9222,http://127.0.0.1:9222 \
		> /dev/null 2>&1 &
	@sleep 5
	@echo "Checking debug server..."
	@RETRIES=0; \
	while [ $$RETRIES -lt 10 ]; do \
		if curl -s http://localhost:9222/json/version > /dev/null 2>&1; then \
			echo "✓ Chrome started successfully with remote debugging"; \
			echo "✓ Debug server is accessible on port 9222"; \
			echo ""; \
			echo "You can now run 'make run' to consolidate tabs"; \
			exit 0; \
		fi; \
		RETRIES=$$((RETRIES + 1)); \
		echo "  Waiting for debug server... (attempt $$RETRIES/10)"; \
		sleep 2; \
	done; \
	echo ""; \
	echo "✗ ERROR: Chrome started but debug server is not responding"; \
	echo ""; \
	echo "Troubleshooting:"; \
	echo "  1. Try manually: Quit Chrome (Cmd+Q), then run:"; \
	echo "     /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"; \
	echo "  2. Check if another process is using port 9222: lsof -i :9222"; \
	echo "  3. Try a different port: python consolidate_tabs.py --port 9223"; \
	exit 1

# Start Chrome with remote debugging (only if not already running)
chrome-debug:
	@echo "Starting Chrome with remote debugging on port 9222..."
	@echo "Note: If Chrome is already running, use 'make chrome-restart' instead"
	@if pgrep "Google Chrome" > /dev/null; then \
		echo ""; \
		echo "⚠️  Chrome is already running!"; \
		echo "   The --remote-debugging-port flag only works when Chrome starts fresh."; \
		echo ""; \
		echo "   Please run 'make chrome-restart' to quit and restart Chrome properly."; \
		exit 1; \
	else \
		/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 > /dev/null 2>&1 & \
		sleep 3; \
		echo "Chrome started. You can now run 'make run'"; \
	fi

# Check if Chrome remote debugging is accessible
check-chrome:
	@echo "Checking Chrome remote debugging connection..."
	@curl -s http://localhost:9222/json/version > /dev/null 2>&1 && \
		echo "✓ Chrome remote debugging is accessible" || \
		echo "✗ Chrome remote debugging is not accessible. Run 'make chrome-debug' first"

# Run the consolidator script
run: check-chrome
	@echo "Running tab consolidator..."
	@if [ -d ".venv" ]; then \
		.venv/bin/python consolidate_tabs.py; \
	else \
		echo "Error: Virtual environment not found. Run 'make install' first"; \
		exit 1; \
	fi

# Backup tabs from current Chrome session
backup-tabs:
	@echo "Backing up tabs from your current Chrome session..."
	@if [ -d ".venv" ]; then \
		.venv/bin/python backup_tabs.py; \
	else \
		echo "Error: Virtual environment not found. Run 'make install' first"; \
		exit 1; \
	fi

# Restore tabs into debug Chrome instance
restore-tabs: check-chrome
	@echo "Restoring tabs into debug Chrome instance..."
	@if [ ! -f "chrome_tabs_backup.json" ]; then \
		echo "Error: No backup file found. Run 'make backup-tabs' first"; \
		exit 1; \
	fi
	@if [ -d ".venv" ]; then \
		.venv/bin/python restore_tabs.py; \
	else \
		echo "Error: Virtual environment not found. Run 'make install' first"; \
		exit 1; \
	fi

# Restore tabs from Chrome history
restore-history: check-chrome
	@echo "Restoring tabs from Chrome browsing history..."
	@echo "This will restore the last 7 days of browsing history (max 200 URLs)"
	@command -v uv >/dev/null 2>&1 || { echo "Error: uv is not installed. Run 'make install' first"; exit 1; }
	uv run restore_from_history.py

# Complete workflow: backup -> restart -> restore -> dedupe
full-workflow:
	@echo "Starting full tab consolidation workflow..."
	@echo ""
	@echo "Step 1/4: Backing up current tabs..."
	@$(MAKE) backup-tabs
	@echo ""
	@echo "Step 2/4: Restarting Chrome with debugging..."
	@$(MAKE) chrome-restart
	@echo ""
	@echo "Step 3/4: Restoring tabs..."
	@$(MAKE) restore-tabs
	@echo ""
	@echo "Step 4/4: Removing duplicates..."
	@$(MAKE) run
	@echo ""
	@echo "✓ Workflow complete!"
	@echo ""
	@echo "Your tabs are now consolidated in the debug Chrome instance."
	@echo "To return to your normal Chrome, quit this instance and restart Chrome normally."

# Organize tabs by domain
organize-domain: check-chrome
	@echo "Analyzing tabs by domain..."
	@if [ -d ".venv" ]; then \
		.venv/bin/python organize_tabs.py --mode domain; \
	else \
		echo "Error: Virtual environment not found. Run 'make install' first"; \
		exit 1; \
	fi

# Interactive guide to organize tabs
organize-interactive: check-chrome
	@echo "Starting interactive tab organization..."
	@if [ -d ".venv" ]; then \
		.venv/bin/python organize_tabs.py --mode interactive; \
	else \
		echo "Error: Virtual environment not found. Run 'make install' first"; \
		exit 1; \
	fi

# Organize tabs by category (coming soon)
organize-category: check-chrome
	@echo "Organizing tabs by category..."
	@if [ -d ".venv" ]; then \
		.venv/bin/python organize_tabs.py --mode category; \
	else \
		echo "Error: Virtual environment not found. Run 'make install' first"; \
		exit 1; \
	fi

# Clean up virtual environment
clean:
	@echo "Removing virtual environment and backup files..."
	rm -rf .venv
	rm -f chrome_tabs_backup.json tabs_by_domain_report.json
	@echo "Clean complete"
